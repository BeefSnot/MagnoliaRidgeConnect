import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import { notifyUsers } from "../lib/notifications.js";
import { isMemoryMode, memoryStore } from "../lib/memory-store.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const createConversationSchema = z.object({
  title: z.string().optional(),
  participantIds: z.array(z.number().int().positive()).min(1),
  isGroup: z.boolean().default(false)
});

const sendMessageSchema = z.object({
  body: z.string().min(1).max(5000)
});

const sendImageSchema = z.object({
  caption: z.string().max(1000).optional()
});

const chatUploadsDir = path.resolve(process.cwd(), "uploads", "chat");
if (!fs.existsSync(chatUploadsDir)) {
  fs.mkdirSync(chatUploadsDir, { recursive: true });
}

const chatStorage = multer.diskStorage({
  destination: (_req: unknown, _file: unknown, callback: (error: Error | null, destination: string) => void) => {
    callback(null, chatUploadsDir);
  },
  filename: (_req: unknown, file: { originalname: string }, callback: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, "-");
    callback(null, `${Date.now()}-${base}${ext}`);
  }
});

const uploadChatImage = multer({ storage: chatStorage });

export const messagesRouter = Router();

messagesRouter.use(requireAuth);

messagesRouter.get("/users", requirePermission("messages.create"), async (req, res) => {
  if (isMemoryMode) {
    const users = memoryStore.users
      .filter((user) => user.id !== req.user!.id && user.status === "ACTIVE")
      .map((user) => ({
        id: user.id,
        fullName: user.fullName,
        unitNumber: user.unitNumber,
        roles: user.roles
      }));

    return res.json({ users });
  }

  const users = await prisma.user.findMany({
    where: {
      id: { not: req.user!.id },
      status: "ACTIVE"
    },
    select: {
      id: true,
      fullName: true,
      unitNumber: true,
      userRoles: {
        include: {
          role: {
            select: {
              name: true
            }
          }
        }
      }
    },
    orderBy: { fullName: "asc" }
  });

  return res.json({
    users: users.map((user: { id: number; fullName: string; unitNumber: string; userRoles: Array<{ role: { name: string } }> }) => ({
      id: user.id,
      fullName: user.fullName,
      unitNumber: user.unitNumber,
      roles: user.userRoles.map((entry: { role: { name: string } }) => entry.role.name)
    }))
  });
});

messagesRouter.get("/conversations", requirePermission("messages.read"), async (req, res) => {
  if (isMemoryMode) {
    const conversations = memoryStore.conversations
      .filter((conversation) => conversation.participantIds.includes(req.user!.id))
      .map((conversation) => ({
        ...conversation,
        participants: conversation.participantIds.map((userId) => ({
          user: memoryStore.users.find((user) => user.id === userId)
        })),
        messages: memoryStore.messages
          .filter((message) => message.conversationId === conversation.id)
          .slice(-1)
      }));
    return res.json({ conversations });
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: {
        some: {
          userId: req.user!.id
        }
      }
    },
    include: {
      participants: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              unitNumber: true
            }
          }
        }
      },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return res.json({ conversations });
});

messagesRouter.post("/conversations", requirePermission("messages.create"), async (req, res) => {
  const body = createConversationSchema.parse(req.body);
  const participantIds = Array.from(new Set([...body.participantIds, req.user!.id]));
  const isDirectMessage = !body.isGroup && participantIds.length === 2;

  if (isMemoryMode) {
    if (isDirectMessage) {
      const existing = memoryStore.conversations.find((conversation) => {
        if (conversation.isGroup || conversation.participantIds.length !== 2) return false;
        const participants = new Set(conversation.participantIds);
        return participantIds.every((participantId) => participants.has(participantId));
      });

      if (existing) {
        return res.json({ conversation: existing });
      }
    }

    const conversation = {
      id: ++memoryStore.counters.conversation,
      title: body.title,
      isGroup: body.isGroup,
      participantIds
    };
    memoryStore.conversations.push(conversation);
    return res.status(201).json({ conversation });
  }

  if (isDirectMessage) {
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        participants: {
          every: {
            userId: {
              in: participantIds
            }
          }
        }
      },
      include: {
        participants: true
      }
    });

    if (existingConversation && existingConversation.participants.length === 2) {
      return res.json({ conversation: existingConversation });
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      title: body.title,
      isGroup: body.isGroup,
      participants: {
        create: participantIds.map((userId) => ({ userId }))
      }
    }
  });

  return res.status(201).json({ conversation });
});

messagesRouter.get("/conversations/:id/messages", requirePermission("messages.read"), async (req, res) => {
  const conversationId = Number(req.params.id);
  const io = req.app.get("io");

  if (isMemoryMode) {
    const conversation = memoryStore.conversations.find((item) => item.id === conversationId);
    if (!conversation || !conversation.participantIds.includes(req.user!.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const messages = memoryStore.messages
      .filter((item) => item.conversationId === conversationId)
      .map((message) => ({
        ...message,
        sender: memoryStore.users.find((user) => user.id === message.senderId)
      }));

    const readMessageIds = messages
      .filter((message) => message.senderId !== req.user!.id)
      .map((message) => message.id);

    if (readMessageIds.length) {
      io.to(`conversation:${conversationId}`).emit("messages:read", {
        conversationId,
        userId: req.user!.id,
        readMessageIds,
        readAt: new Date().toISOString()
      });
    }

    return res.json({ messages });
  }

  const canRead = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: req.user!.id }
  });

  if (!canRead) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    include: {
      sender: {
        select: {
          id: true,
          fullName: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  const readMessageIds = messages
    .filter((message: { senderId: number }) => message.senderId !== req.user!.id)
    .map((message: { id: number }) => message.id);

  if (readMessageIds.length) {
    io.to(`conversation:${conversationId}`).emit("messages:read", {
      conversationId,
      userId: req.user!.id,
      readMessageIds,
      readAt: new Date().toISOString()
    });
  }

  return res.json({ messages });
});

messagesRouter.post("/conversations/:id/messages", requirePermission("messages.create"), async (req, res) => {
  const conversationId = Number(req.params.id);
  const body = sendMessageSchema.parse(req.body);

  if (isMemoryMode) {
    const conversation = memoryStore.conversations.find((item) => item.id === conversationId);
    if (!conversation || !conversation.participantIds.includes(req.user!.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const message = {
      id: ++memoryStore.counters.message,
      conversationId,
      senderId: req.user!.id,
      body: body.body,
      createdAt: new Date().toISOString(),
      sender: memoryStore.users.find((user) => user.id === req.user!.id)
    };

    memoryStore.messages.push(message);

    const io = req.app.get("io");
    io.to(`conversation:${conversationId}`).emit("messages:new", message);

    const recipients = conversation.participantIds.filter((userId) => userId !== req.user!.id);
    await notifyUsers(req.app, recipients, {
      title: "New direct message",
      body: `${req.user!.fullName}: ${body.body.slice(0, 70)}`,
      type: "message",
      entityId: conversationId
    });

    return res.status(201).json({ message });
  }

  const canWrite = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: req.user!.id }
  });

  if (!canWrite) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: req.user!.id,
      body: body.body
    },
    include: {
      sender: {
        select: {
          id: true,
          fullName: true
        }
      }
    }
  });

  const io = req.app.get("io");
  io.to(`conversation:${conversationId}`).emit("messages:new", message);

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true }
  });
  await notifyUsers(
    req.app,
    participants.map((item: { userId: number }) => item.userId).filter((userId: number) => userId !== req.user!.id),
    {
      title: "New direct message",
      body: `${req.user!.fullName}: ${body.body.slice(0, 70)}`,
      type: "message",
      entityId: conversationId
    }
  );

  return res.status(201).json({ message });
});

messagesRouter.post("/conversations/:id/images", requirePermission("messages.create"), uploadChatImage.single("file"), async (req, res) => {
  const conversationId = Number(req.params.id);
  const parsed = sendImageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid image payload", issues: parsed.error.issues });
  }

  const uploadedFile = (req as typeof req & { file?: { filename: string; originalname: string } }).file;
  if (!uploadedFile) {
    return res.status(400).json({ message: "No image file provided" });
  }

  const imageUrl = `/uploads/chat/${uploadedFile.filename}`;
  const bodyText = `${parsed.data.caption?.trim() ? `${parsed.data.caption.trim()}\n` : ""}${imageUrl}`;

  if (isMemoryMode) {
    const conversation = memoryStore.conversations.find((item) => item.id === conversationId);
    if (!conversation || !conversation.participantIds.includes(req.user!.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const message = {
      id: ++memoryStore.counters.message,
      conversationId,
      senderId: req.user!.id,
      body: bodyText,
      createdAt: new Date().toISOString(),
      sender: memoryStore.users.find((user) => user.id === req.user!.id)
    };

    memoryStore.messages.push(message);

    const io = req.app.get("io");
    io.to(`conversation:${conversationId}`).emit("messages:new", message);

    const recipients = conversation.participantIds.filter((userId) => userId !== req.user!.id);
    await notifyUsers(req.app, recipients, {
      title: "New image message",
      body: `${req.user!.fullName} shared an image`,
      type: "message",
      entityId: conversationId
    });

    return res.status(201).json({ message });
  }

  const canWrite = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: req.user!.id }
  });

  if (!canWrite) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: req.user!.id,
      body: bodyText
    },
    include: {
      sender: {
        select: {
          id: true,
          fullName: true
        }
      }
    }
  });

  const io = req.app.get("io");
  io.to(`conversation:${conversationId}`).emit("messages:new", message);

  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true }
  });

  await notifyUsers(
    req.app,
    participants.map((item: { userId: number }) => item.userId).filter((userId: number) => userId !== req.user!.id),
    {
      title: "New image message",
      body: `${req.user!.fullName} shared an image`,
      type: "message",
      entityId: conversationId
    }
  );

  return res.status(201).json({ message });
});
