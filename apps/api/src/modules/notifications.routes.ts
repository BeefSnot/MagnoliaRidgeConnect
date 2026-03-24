import { Router } from "express";
import { z } from "zod";
import { isMemoryMode, memoryStore } from "../lib/memory-store.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const pushTokenSchema = z.object({
  token: z.string().min(10),
  platform: z.string().min(2)
});

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res) => {
  if (isMemoryMode) {
    const notifications = memoryStore.notifications
      .filter((notification) => notification.userId === req.user!.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json({ notifications });
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" }
  });

  return res.json({ notifications });
});

notificationsRouter.post("/push-token", requirePermission("notifications.manage"), async (req, res) => {
  const parsed = pushTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid push token payload",
      issues: parsed.error.issues
    });
  }

  const body = parsed.data;

  if (isMemoryMode) {
    const existing = memoryStore.pushTokens.find(
      (token) => token.userId === req.user!.id && token.token === body.token
    );

    if (!existing) {
      memoryStore.pushTokens.push({
        id: ++memoryStore.counters.pushToken,
        userId: req.user!.id,
        token: body.token,
        platform: body.platform,
        createdAt: new Date().toISOString()
      });
    }

    return res.status(201).json({ message: "Push token saved" });
  }

  await prisma.pushToken.upsert({
    where: { token: body.token },
    update: {
      userId: req.user!.id,
      platform: body.platform
    },
    create: {
      userId: req.user!.id,
      token: body.token,
      platform: body.platform
    }
  });

  return res.status(201).json({ message: "Push token saved" });
});

notificationsRouter.post("/:id/read", async (req, res) => {
  const id = Number(req.params.id);

  if (isMemoryMode) {
    const notification = memoryStore.notifications.find(
      (item) => item.id === id && item.userId === req.user!.id
    );
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    notification.readAt = new Date().toISOString();
    return res.json({ message: "Notification marked read" });
  }

  await prisma.notification.updateMany({
    where: { id, userId: req.user!.id },
    data: { readAt: new Date() }
  });

  return res.json({ message: "Notification marked read" });
});
