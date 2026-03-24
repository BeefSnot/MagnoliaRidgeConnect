import { Router } from "express";
import { z } from "zod";
import { isMemoryMode, memoryStore } from "../lib/memory-store.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const createReportSchema = z.object({
  targetType: z.enum(["post", "comment", "user"]),
  targetId: z.number().int().positive(),
  reason: z.string().min(3),
  details: z.string().optional()
});

const resolveSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED"]).default("RESOLVED")
});

export const moderationRouter = Router();

moderationRouter.use(requireAuth);

moderationRouter.post("/reports", requirePermission("posts.report"), async (req, res) => {
  const body = createReportSchema.parse(req.body);

  if (isMemoryMode) {
    const report = {
      id: ++memoryStore.counters.report,
      targetType: body.targetType,
      targetId: body.targetId,
      reason: body.reason,
      details: body.details,
      status: "OPEN" as const,
      createdById: req.user!.id,
      createdAt: new Date().toISOString()
    };
    memoryStore.reports.unshift(report);
    return res.status(201).json({ report });
  }

  const report = await prisma.moderationReport.create({
    data: {
      targetType: body.targetType,
      targetId: body.targetId,
      reason: body.reason,
      details: body.details,
      status: "OPEN",
      createdById: req.user!.id
    }
  });

  return res.status(201).json({ report });
});

moderationRouter.get("/reports", requirePermission("moderation.manage"), async (_req, res) => {
  if (isMemoryMode) {
    return res.json({ reports: memoryStore.reports });
  }

  const reports = await prisma.moderationReport.findMany({
    orderBy: { createdAt: "desc" }
  });
  return res.json({ reports });
});

moderationRouter.patch("/reports/:id", requirePermission("moderation.manage"), async (req, res) => {
  const id = Number(req.params.id);
  const body = resolveSchema.parse(req.body);

  if (isMemoryMode) {
    const report = memoryStore.reports.find((item) => item.id === id);
    if (!report) return res.status(404).json({ message: "Report not found" });

    report.status = body.status;
    report.resolvedById = req.user!.id;
    report.resolvedAt = new Date().toISOString();
    return res.json({ report });
  }

  const report = await prisma.moderationReport.update({
    where: { id },
    data: {
      status: body.status,
      resolvedById: req.user!.id,
      resolvedAt: new Date()
    }
  });

  return res.json({ report });
});
