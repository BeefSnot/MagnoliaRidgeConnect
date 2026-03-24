import { Router } from "express";
import { z } from "zod";
import { allUserIds, notifyUsers } from "../lib/notifications.js";
import { isMemoryMode, memoryStore } from "../lib/memory-store.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const createPostSchema = z.object({
  content: z.string().min(1).max(5000)
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(2000)
});

export const postsRouter = Router();

postsRouter.use(requireAuth);

postsRouter.get("/", async (_req, res) => {
  if (isMemoryMode) {
    const posts = memoryStore.posts
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((post) => ({
        ...post,
        author: memoryStore.users.find((user) => user.id === post.authorId),
        comments: memoryStore.comments
          .filter((comment) => comment.postId === post.id)
          .map((comment) => ({
            ...comment,
            author: memoryStore.users.find((user) => user.id === comment.authorId)
          }))
      }));
    return res.json({ posts });
  }

  const posts = await prisma.post.findMany({
    include: {
      author: {
        select: {
          id: true,
          fullName: true,
          unitNumber: true
        }
      },
      comments: {
        include: {
          author: {
            select: {
              id: true,
              fullName: true
            }
          }
        },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return res.json({ posts });
});

postsRouter.post("/", requirePermission("posts.create"), async (req, res) => {
  const body = createPostSchema.parse(req.body);

  if (isMemoryMode) {
    const post = {
      id: ++memoryStore.counters.post,
      authorId: req.user!.id,
      content: body.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: memoryStore.users.find((user) => user.id === req.user!.id)
    };

    memoryStore.posts.push(post);

    const io = req.app.get("io");
    io.emit("posts:new", post);

    const targetUserIds = memoryStore.users.filter((user) => user.id !== req.user!.id).map((user) => user.id);
    await notifyUsers(req.app, targetUserIds, {
      title: "New community post",
      body: `${req.user!.fullName} shared an update`,
      type: "post",
      entityId: post.id
    });

    return res.status(201).json({ post });
  }

  const post = await prisma.post.create({
    data: {
      content: body.content,
      authorId: req.user!.id
    },
    include: {
      author: {
        select: {
          id: true,
          fullName: true,
          unitNumber: true
        }
      }
    }
  });

  const io = req.app.get("io");
  io.emit("posts:new", post);

  await notifyUsers(req.app, await allUserIds(), {
    title: "New community post",
    body: `${req.user!.fullName} shared an update`,
    type: "post",
    entityId: post.id
  });

  return res.status(201).json({ post });
});

postsRouter.post("/:id/comments", requirePermission("posts.comment"), async (req, res) => {
  const postId = Number(req.params.id);
  const body = createCommentSchema.parse(req.body);

  if (isMemoryMode) {
    const comment = {
      id: ++memoryStore.counters.comment,
      postId,
      authorId: req.user!.id,
      content: body.content,
      createdAt: new Date().toISOString(),
      author: memoryStore.users.find((user) => user.id === req.user!.id)
    };
    memoryStore.comments.push(comment);
    return res.status(201).json({ comment });
  }

  const comment = await prisma.comment.create({
    data: {
      postId,
      authorId: req.user!.id,
      content: body.content
    },
    include: {
      author: {
        select: {
          id: true,
          fullName: true
        }
      }
    }
  });

  return res.status(201).json({ comment });
});
