import { Router } from "express";
import { env } from "../config/env.js";
import { isMemoryMode, memoryStore } from "../lib/memory-store.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

export const calendarRouter = Router();

calendarRouter.use(requireAuth);

calendarRouter.get("/google/auth-url", requirePermission("events.create"), (req, res) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
    return res.status(400).json({ message: "Google OAuth is not configured" });
  }

  const scope = encodeURIComponent("https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly");
  const redirectUri = encodeURIComponent(env.GOOGLE_REDIRECT_URI);
  const state = encodeURIComponent(req.user!.id.toString());

  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;
  return res.json({ url });
});

calendarRouter.get("/google/callback", async (req, res) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    return res.status(400).json({ message: "Google OAuth is not configured" });
  }

  const code = String(req.query.code ?? "");
  const state = String(req.query.state ?? "");
  if (!code) {
    return res.status(400).json({ message: "Missing authorization code" });
  }

  const userId = Number(state);
  if (!userId) {
    return res.status(400).json({ message: "Invalid callback state" });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code"
    })
  });

  if (!tokenResponse.ok) {
    return res.status(400).json({ message: "Failed to exchange Google code" });
  }

  const tokenJson = await tokenResponse.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (isMemoryMode) {
    const existing = memoryStore.googleIntegrations.find((item) => item.userId === userId);
    const tokenExpiresAt = tokenJson.expires_in
      ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
      : undefined;

    if (existing) {
      existing.accessToken = tokenJson.access_token;
      existing.refreshToken = tokenJson.refresh_token ?? existing.refreshToken;
      existing.tokenExpiresAt = tokenExpiresAt;
    } else {
      memoryStore.googleIntegrations.push({
        userId,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token,
        tokenExpiresAt
      });
    }

    return res.json({ connected: true });
  }

  await prisma.googleIntegration.upsert({
    where: { userId },
    update: {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token,
      tokenExpiresAt: tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000) : undefined
    },
    create: {
      userId,
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token,
      tokenExpiresAt: tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000) : undefined
    }
  });

  return res.json({ connected: true });
});

calendarRouter.post("/google/disconnect", requirePermission("events.create"), async (req, res) => {
  if (isMemoryMode) {
    memoryStore.googleIntegrations = memoryStore.googleIntegrations.filter((item) => item.userId !== req.user!.id);
    return res.json({ message: "Google Calendar disconnected" });
  }

  await prisma.googleIntegration.deleteMany({ where: { userId: req.user!.id } });
  return res.json({ message: "Google Calendar disconnected" });
});

calendarRouter.get("/google/status", requirePermission("events.create"), async (req, res) => {
  if (isMemoryMode) {
    const integration = memoryStore.googleIntegrations.find((item) => item.userId === req.user!.id);
    return res.json({ connected: Boolean(integration?.refreshToken) });
  }

  const integration = await prisma.googleIntegration.findUnique({
    where: { userId: req.user!.id }
  });

  return res.json({ connected: Boolean(integration?.refreshToken) });
});

calendarRouter.get("/feed", async (_req, res) => {
  if (isMemoryMode) {
    const events = memoryStore.events
      .slice()
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: event.location
      }));
    return res.json({ events });
  }

  const events = await prisma.event.findMany({
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      location: true
    }
  });

  return res.json({ events });
});
