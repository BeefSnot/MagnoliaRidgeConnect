import { Router } from "express";
import { z } from "zod";
import { allUserIds, notifyUsers } from "../lib/notifications.js";
import { isMemoryMode, memoryStore } from "../lib/memory-store.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const eventSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  location: z.string().optional(),
  syncToGoogle: z.boolean().optional()
});

export const eventsRouter = Router();

eventsRouter.use(requireAuth);

eventsRouter.get("/", async (_req, res) => {
  if (isMemoryMode) {
    const events = memoryStore.events
      .slice()
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((event) => ({
        ...event,
        createdBy: memoryStore.users.find((user) => user.id === event.createdById)
      }));
    return res.json({ events });
  }

  const events = await prisma.event.findMany({
    include: {
      createdBy: {
        select: {
          id: true,
          fullName: true
        }
      }
    },
    orderBy: {
      startsAt: "asc"
    }
  });

  return res.json({ events });
});

eventsRouter.post("/", requirePermission("events.create"), async (req, res) => {
  const body = eventSchema.parse(req.body);

  if (isMemoryMode) {
    const event = {
      id: ++memoryStore.counters.event,
      title: body.title,
      description: body.description,
      startsAt: new Date(body.startsAt).toISOString(),
      endsAt: new Date(body.endsAt).toISOString(),
      location: body.location,
      createdById: req.user!.id,
      googleEventId: body.syncToGoogle ? `memory-google-${Date.now()}` : undefined
    };
    memoryStore.events.push(event);

    await notifyUsers(req.app, memoryStore.users.map((user) => user.id), {
      title: "New community event",
      body: `${event.title} is now on the calendar`,
      type: "event",
      entityId: event.id
    });

    return res.status(201).json({ event });
  }

  const event = await prisma.event.create({
    data: {
      title: body.title,
      description: body.description,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      location: body.location,
      createdById: req.user!.id
    }
  });

  if (body.syncToGoogle) {
    // Hook point: sync event to Google Calendar using integration token for user/admin.
  }

  await notifyUsers(req.app, await allUserIds(), {
    title: "New community event",
    body: `${event.title} is now on the calendar`,
    type: "event",
    entityId: event.id
  });

  return res.status(201).json({ event });
});
