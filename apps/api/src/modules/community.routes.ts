import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import { allUserIds, notifyUsers } from "../lib/notifications.js";
import { isMemoryMode, memoryStore } from "../lib/memory-store.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

type CommunityChannel = "pets" | "gardening";
type ReactionType = "like" | "love" | "wow" | "helpful";

type RuntimeReaction = {
  channel: CommunityChannel;
  postId: number;
  userId: number;
  reaction: ReactionType;
};

const runtimeReactions: RuntimeReaction[] = [];

const channelSchema = z.enum(["pets", "gardening"]);

const createPostSchema = z.object({
  content: z.string().min(1).max(5000),
  imageUrl: z.string().url().optional(),
  isQuestion: z.boolean().default(false)
});

const uploadPostSchema = z.object({
  content: z.string().max(5000).optional(),
  isQuestion: z.coerce.boolean().default(false)
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(2000)
});

const reactionSchema = z.object({
  reaction: z.enum(["like", "love", "wow", "helpful"]) 
});

function channelLabel(channel: CommunityChannel) {
  return channel === "pets" ? "Pets" : "Plants & Gardening";
}

function toDecoratedContent(payload: { channel: CommunityChannel; isQuestion: boolean; imageUrl?: string; content: string }) {
  const imagePart = payload.imageUrl ? `;image=${encodeURIComponent(payload.imageUrl)}` : "";
  const questionPart = payload.isQuestion ? ";question=1" : ";question=0";
  return `[MRC:channel=${payload.channel}${questionPart}${imagePart}]\n${payload.content}`;
}

function parseDecoratedContent(content: string) {
  const firstBreak = content.indexOf("\n");
  const header = firstBreak >= 0 ? content.slice(0, firstBreak) : "";
  const body = firstBreak >= 0 ? content.slice(firstBreak + 1) : content;

  const match = header.match(/^\[MRC:channel=(pets|gardening);question=(0|1)(;image=([^\]]+))?\]$/);
  if (!match) {
    return {
      channel: undefined as CommunityChannel | undefined,
      isQuestion: false,
      imageUrl: undefined as string | undefined,
      content: body
    };
  }

  return {
    channel: match[1] as CommunityChannel,
    isQuestion: match[2] === "1",
    imageUrl: match[4] ? decodeURIComponent(match[4]) : undefined,
    content: body
  };
}

export const communityRouter = Router();

const communityUploadsDir = path.resolve(process.cwd(), "uploads", "community");
if (!fs.existsSync(communityUploadsDir)) {
  fs.mkdirSync(communityUploadsDir, { recursive: true });
}

const communityStorage = multer.diskStorage({
  destination: (_req: unknown, _file: unknown, callback: (error: Error | null, destination: string) => void) => {
    callback(null, communityUploadsDir);
  },
  filename: (_req: unknown, file: { originalname: string }, callback: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, "-");
    callback(null, `${Date.now()}-${base}${ext}`);
  }
});

const uploadCommunityImage = multer({ storage: communityStorage });

communityRouter.use(requireAuth);

communityRouter.get("/:channel/posts", async (req, res) => {
  const channel = channelSchema.parse(req.params.channel) as CommunityChannel;

  if (isMemoryMode) {
    const posts = memoryStore.posts
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((post) => {
        const parsed = parseDecoratedContent(post.content);
        return {
          ...post,
          parsed,
          author: memoryStore.users.find((user) => user.id === post.authorId),
          comments: memoryStore.comments
            .filter((comment) => comment.postId === post.id)
            .map((comment) => ({
              ...comment,
              author: memoryStore.users.find((user) => user.id === comment.authorId)
            }))
        };
      })
      .filter((post) => post.parsed.channel === channel)
      .map((post) => {
        const reactions = runtimeReactions.filter((reaction) => reaction.channel === channel && reaction.postId === post.id);
        const counts = reactions.reduce<Record<string, number>>((acc, reaction) => {
          acc[reaction.reaction] = (acc[reaction.reaction] ?? 0) + 1;
          return acc;
        }, {});

        return {
          id: post.id,
          content: post.parsed.content,
          imageUrl: post.parsed.imageUrl,
          isQuestion: post.parsed.isQuestion,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
          author: post.author,
          comments: post.comments,
          reactions: counts,
          myReaction: reactions.find((reaction) => reaction.userId === req.user!.id)?.reaction
        };
      });

    return res.json({ posts });
  }

  const allPosts = await prisma.post.findMany({
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
    take: 80
  });

  const posts = allPosts
    .map((post: { id: number; content: string; createdAt: Date; updatedAt: Date; author: { id: number; fullName: string; unitNumber: string }; comments: Array<{ id: number; content: string; createdAt: Date; author: { id: number; fullName: string } }> }) => ({
      ...post,
      parsed: parseDecoratedContent(post.content)
    }))
    .filter((post: { parsed: { channel?: CommunityChannel } }) => post.parsed.channel === channel)
    .map((post: { id: number; parsed: { content: string; imageUrl?: string; isQuestion: boolean }; createdAt: Date; updatedAt: Date; author: { id: number; fullName: string; unitNumber: string }; comments: Array<{ id: number; content: string; createdAt: Date; author: { id: number; fullName: string } }> }) => {
      const reactions = runtimeReactions.filter((reaction) => reaction.channel === channel && reaction.postId === post.id);
      const counts = reactions.reduce<Record<string, number>>((acc, reaction) => {
        acc[reaction.reaction] = (acc[reaction.reaction] ?? 0) + 1;
        return acc;
      }, {});

      return {
        id: post.id,
        content: post.parsed.content,
        imageUrl: post.parsed.imageUrl,
        isQuestion: post.parsed.isQuestion,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        author: post.author,
        comments: post.comments,
        reactions: counts,
        myReaction: reactions.find((reaction) => reaction.userId === req.user!.id)?.reaction
      };
    });

  return res.json({ posts });
});

communityRouter.post("/:channel/posts", requirePermission("posts.create"), async (req, res) => {
  const channel = channelSchema.parse(req.params.channel) as CommunityChannel;
  const body = createPostSchema.parse(req.body);

  const encodedContent = toDecoratedContent({
    channel,
    content: body.content,
    imageUrl: body.imageUrl,
    isQuestion: body.isQuestion
  });

  if (isMemoryMode) {
    const post = {
      id: ++memoryStore.counters.post,
      authorId: req.user!.id,
      content: encodedContent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: memoryStore.users.find((user) => user.id === req.user!.id)
    };

    memoryStore.posts.push(post);

    const io = req.app.get("io");
    io.emit("community:new", { channel, postId: post.id });

    const targetUserIds = memoryStore.users.filter((user) => user.id !== req.user!.id).map((user) => user.id);
    await notifyUsers(req.app, targetUserIds, {
      title: `New ${channelLabel(channel)} post`,
      body: `${req.user!.fullName} shared an update`,
      type: "community",
      entityId: post.id
    });

    return res.status(201).json({ message: "Post created" });
  }

  const post = await prisma.post.create({
    data: {
      content: encodedContent,
      authorId: req.user!.id
    }
  });

  const io = req.app.get("io");
  io.emit("community:new", { channel, postId: post.id });

  await notifyUsers(req.app, await allUserIds(), {
    title: `New ${channelLabel(channel)} post`,
    body: `${req.user!.fullName} shared an update`,
    type: "community",
    entityId: post.id
  });

  return res.status(201).json({ message: "Post created" });
});

communityRouter.post(
  "/:channel/posts/upload",
  requirePermission("posts.create"),
  uploadCommunityImage.single("file"),
  async (req, res) => {
    const channel = channelSchema.parse(req.params.channel) as CommunityChannel;
    const parsed = uploadPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Invalid upload payload",
        issues: parsed.error.issues
      });
    }

    const uploadedFile = (req as typeof req & { file?: { filename: string } }).file;
    if (!uploadedFile) {
      return res.status(400).json({ message: "No file provided" });
    }

    const imageUrl = `/uploads/community/${uploadedFile.filename}`;
    const encodedContent = toDecoratedContent({
      channel,
      content: parsed.data.content?.trim() || "Photo post",
      imageUrl,
      isQuestion: parsed.data.isQuestion
    });

    if (isMemoryMode) {
      const post = {
        id: ++memoryStore.counters.post,
        authorId: req.user!.id,
        content: encodedContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: memoryStore.users.find((user) => user.id === req.user!.id)
      };

      memoryStore.posts.push(post);

      const io = req.app.get("io");
      io.emit("community:new", { channel, postId: post.id });

      const targetUserIds = memoryStore.users.filter((user) => user.id !== req.user!.id).map((user) => user.id);
      await notifyUsers(req.app, targetUserIds, {
        title: `New ${channelLabel(channel)} photo post`,
        body: `${req.user!.fullName} shared a photo`,
        type: "community",
        entityId: post.id
      });

      return res.status(201).json({ message: "Photo post created", imageUrl });
    }

    const post = await prisma.post.create({
      data: {
        content: encodedContent,
        authorId: req.user!.id
      }
    });

    const io = req.app.get("io");
    io.emit("community:new", { channel, postId: post.id });

    await notifyUsers(req.app, await allUserIds(), {
      title: `New ${channelLabel(channel)} photo post`,
      body: `${req.user!.fullName} shared a photo`,
      type: "community",
      entityId: post.id
    });

    return res.status(201).json({ message: "Photo post created", imageUrl });
  }
);

communityRouter.post("/:channel/posts/:id/comments", requirePermission("posts.comment"), async (req, res) => {
  const channel = channelSchema.parse(req.params.channel) as CommunityChannel;
  const postId = Number(req.params.id);
  const body = createCommentSchema.parse(req.body);

  if (isMemoryMode) {
    const post = memoryStore.posts.find((item) => item.id === postId);
    if (!post || parseDecoratedContent(post.content).channel !== channel) {
      return res.status(404).json({ message: "Post not found" });
    }

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

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || parseDecoratedContent(post.content).channel !== channel) {
    return res.status(404).json({ message: "Post not found" });
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

communityRouter.post("/:channel/posts/:id/reactions", requirePermission("posts.comment"), async (req, res) => {
  const channel = channelSchema.parse(req.params.channel) as CommunityChannel;
  const postId = Number(req.params.id);
  const body = reactionSchema.parse(req.body);

  const existingIndex = runtimeReactions.findIndex(
    (reaction) => reaction.channel === channel && reaction.postId === postId && reaction.userId === req.user!.id
  );

  if (existingIndex >= 0) {
    runtimeReactions[existingIndex].reaction = body.reaction;
  } else {
    runtimeReactions.push({
      channel,
      postId,
      userId: req.user!.id,
      reaction: body.reaction
    });
  }

  return res.json({ message: "Reaction saved" });
});
