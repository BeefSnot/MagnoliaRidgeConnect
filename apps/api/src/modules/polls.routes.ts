import { Router } from "express";
import { z } from "zod";
import { isMemoryMode, memoryStore } from "../lib/memory-store.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const createPollSchema = z.object({
  question: z.string().min(3),
  options: z.array(z.string().min(1)).min(2),
  closesAt: z.string().datetime().optional()
});

const voteSchema = z.object({
  optionId: z.coerce.number().int().positive()
});

export const pollsRouter = Router();

pollsRouter.use(requireAuth);

pollsRouter.get("/", async (_req, res) => {
  if (isMemoryMode) {
    const polls = memoryStore.polls
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((poll) => ({
        ...poll,
        options: memoryStore.pollOptions.filter((option) => option.pollId === poll.id),
        votes: memoryStore.pollVotes.filter((vote) => vote.pollId === poll.id),
        createdBy: memoryStore.users.find((user) => user.id === poll.createdById)
      }));
    return res.json({ polls });
  }

  const polls = await prisma.poll.findMany({
    include: {
      options: true,
      votes: true,
      createdBy: {
        select: {
          id: true,
          fullName: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return res.json({ polls });
});

pollsRouter.post("/", requirePermission("polls.create"), async (req, res) => {
  const body = createPollSchema.parse(req.body);

  if (isMemoryMode) {
    const poll = {
      id: ++memoryStore.counters.poll,
      question: body.question,
      createdById: req.user!.id,
      closesAt: body.closesAt,
      createdAt: new Date().toISOString(),
      options: body.options.map((label) => {
        const option = { id: ++memoryStore.counters.pollOption, pollId: memoryStore.counters.poll, label };
        memoryStore.pollOptions.push(option);
        return option;
      })
    };
    memoryStore.polls.push({
      id: poll.id,
      question: poll.question,
      createdById: poll.createdById,
      closesAt: poll.closesAt,
      createdAt: poll.createdAt
    });
    return res.status(201).json({ poll });
  }

  const poll = await prisma.poll.create({
    data: {
      question: body.question,
      createdById: req.user!.id,
      closesAt: body.closesAt ? new Date(body.closesAt) : undefined,
      options: {
        create: body.options.map((label) => ({ label }))
      }
    },
    include: {
      options: true
    }
  });

  return res.status(201).json({ poll });
});

pollsRouter.post("/:id/vote", requirePermission("polls.vote"), async (req, res) => {
  const pollId = Number(req.params.id);
  const body = voteSchema.parse(req.body);

  if (isMemoryMode) {
    const poll = memoryStore.polls.find((item) => item.id === pollId);
    if (!poll) return res.status(404).json({ message: "Poll not found" });

    const voteIndex = memoryStore.pollVotes.findIndex(
      (vote) => vote.pollId === pollId && vote.userId === req.user!.id
    );
    if (voteIndex >= 0) {
      memoryStore.pollVotes[voteIndex].optionId = body.optionId;
    } else {
      memoryStore.pollVotes.push({
        pollId,
        optionId: body.optionId,
        userId: req.user!.id,
        createdAt: new Date().toISOString()
      });
    }

    return res.json({ message: "Vote submitted" });
  }

  const existingVote = await prisma.pollVote.findUnique({
    where: {
      pollId_userId: {
        pollId,
        userId: req.user!.id
      }
    }
  });

  if (existingVote) {
    await prisma.pollVote.update({
      where: {
        pollId_userId: {
          pollId,
          userId: req.user!.id
        }
      },
      data: {
        optionId: body.optionId
      }
    });
  } else {
    await prisma.pollVote.create({
      data: {
        pollId,
        optionId: body.optionId,
        userId: req.user!.id
      }
    });
  }

  return res.json({ message: "Vote submitted" });
});
