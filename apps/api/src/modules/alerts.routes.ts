import { Router } from "express";
import { z } from "zod";
import { allUserIds, notifyUsers } from "../lib/notifications.js";
import { isMemoryMode, memoryStore } from "../lib/memory-store.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const createAlertSchema = z.object({
  title: z.string().min(3),
  message: z.string().min(5),
  level: z.enum(["info", "warning", "critical"]).default("info")
});

export const alertsRouter = Router();

alertsRouter.use(requireAuth);

alertsRouter.get("/", requirePermission("alerts.read"), async (_req, res) => {
  if (isMemoryMode) {
    const alerts = memoryStore.alerts.map((alert) => {
      const read = memoryStore.alertReads.find((item) => item.alertId === alert.id && item.userId === _req.user!.id);
      return {
        ...alert,
        readAt: read?.readAt
      };
    });

    return res.json({ alerts });
  }

  const alerts = await prisma.emergencyAlert.findMany({
    include: {
      reads: {
        where: { userId: _req.user!.id },
        select: { readAt: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return res.json({
    alerts: alerts.map((alert: { reads: Array<{ readAt: Date }>; [key: string]: unknown }) => ({
      ...alert,
      readAt: alert.reads[0]?.readAt ?? null
    }))
  });
});

alertsRouter.post("/", requirePermission("alerts.create"), async (req, res) => {
  const parsed = createAlertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid alert payload",
      issues: parsed.error.issues
    });
  }

  const body = parsed.data;

  if (isMemoryMode) {
    const alert = {
      id: ++memoryStore.counters.alert,
      title: body.title,
      message: body.message,
      level: body.level,
      createdById: req.user!.id,
      createdAt: new Date().toISOString()
    };
    memoryStore.alerts.unshift(alert);

    const io = req.app.get("io");
    io.emit("alerts:new", alert);

    await notifyUsers(req.app, memoryStore.users.filter((user) => user.status === "ACTIVE").map((user) => user.id), {
      title: `Emergency Alert: ${body.title}`,
      body: body.message,
      type: "alert",
      entityId: alert.id
    });

    return res.status(201).json({ alert });
  }

  const alert = await prisma.emergencyAlert.create({
    data: {
      title: body.title,
      message: body.message,
      level: body.level,
      createdById: req.user!.id
    }
  });

  const io = req.app.get("io");
  io.emit("alerts:new", alert);

  await notifyUsers(req.app, await allUserIds(), {
    title: `Emergency Alert: ${body.title}`,
    body: body.message,
    type: "alert",
    entityId: alert.id
  });

  return res.status(201).json({ alert });
});

alertsRouter.post("/:id/read", requirePermission("alerts.read"), async (req, res) => {
  const alertId = Number(req.params.id);

  if (isMemoryMode) {
    const existing = memoryStore.alertReads.find((item) => item.alertId === alertId && item.userId === req.user!.id);
    if (!existing) {
      memoryStore.alertReads.push({
        alertId,
        userId: req.user!.id,
        readAt: new Date().toISOString()
      });
    }
    return res.json({ message: "Read receipt recorded" });
  }

  await prisma.emergencyAlertRead.upsert({
    where: {
      alertId_userId: {
        alertId,
        userId: req.user!.id
      }
    },
    update: {},
    create: {
      alertId,
      userId: req.user!.id
    }
  });

  return res.json({ message: "Read receipt recorded" });
});
