import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import { isMemoryMode, memoryStore } from "../lib/memory-store.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const createDocumentSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(10),
  category: z.string().optional()
});

const uploadDocumentSchema = z.object({
  title: z.string().min(3),
  category: z.string().optional()
});

export const documentsRouter = Router();

const uploadsDir = path.resolve(process.cwd(), "uploads", "docs");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: unknown, _file: unknown, callback: (error: Error | null, destination: string) => void) => {
    callback(null, uploadsDir);
  },
  filename: (_req: unknown, file: { originalname: string }, callback: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, "-");
    callback(null, `${Date.now()}-${base}${ext}`);
  }
});

const upload = multer({ storage });

documentsRouter.use(requireAuth);

documentsRouter.get("/", requirePermission("documents.read"), async (req, res) => {
  if (isMemoryMode) {
    const documents = memoryStore.documents.map((document) => ({
      ...document,
      acknowledged: memoryStore.documentAcks.some(
        (ack) => ack.documentId === document.id && ack.userId === req.user!.id
      )
    }));

    return res.json({ documents });
  }

  const documents = await prisma.document.findMany({
    include: {
      acknowledgements: {
        where: { userId: req.user!.id }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return res.json({
    documents: documents.map((document: { acknowledgements: Array<unknown> }) => ({
      ...document,
      acknowledged: document.acknowledgements.length > 0
    }))
  });
});

documentsRouter.post("/", requirePermission("documents.manage"), async (req, res) => {
  const body = createDocumentSchema.parse(req.body);

  if (isMemoryMode) {
    const document = {
      id: ++memoryStore.counters.document,
      title: body.title,
      body: body.body,
      category: body.category,
      createdById: req.user!.id,
      createdAt: new Date().toISOString()
    };
    memoryStore.documents.unshift(document);
    return res.status(201).json({ document });
  }

  const document = await prisma.document.create({
    data: {
      title: body.title,
      body: body.body,
      category: body.category,
      createdById: req.user!.id
    }
  });

  return res.status(201).json({ document });
});

documentsRouter.post("/upload", requirePermission("documents.manage"), upload.single("file"), async (req, res) => {
  const parsed = uploadDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid upload payload",
      issues: parsed.error.issues
    });
  }

  const uploadedFile = (req as typeof req & { file?: { filename: string; originalname: string } }).file;
  if (!uploadedFile) {
    return res.status(400).json({ message: "No file provided" });
  }

  const fileUrl = `/uploads/docs/${uploadedFile.filename}`;
  const body = `Uploaded file: ${uploadedFile.originalname}\nURL: ${fileUrl}`;

  if (isMemoryMode) {
    const document = {
      id: ++memoryStore.counters.document,
      title: parsed.data.title,
      body,
      category: parsed.data.category,
      createdById: req.user!.id,
      createdAt: new Date().toISOString()
    };
    memoryStore.documents.unshift(document);
    return res.status(201).json({ document, fileUrl });
  }

  const document = await prisma.document.create({
    data: {
      title: parsed.data.title,
      body,
      category: parsed.data.category,
      createdById: req.user!.id
    }
  });

  return res.status(201).json({ document, fileUrl });
});

documentsRouter.post("/:id/acknowledge", requirePermission("documents.read"), async (req, res) => {
  const documentId = Number(req.params.id);

  if (isMemoryMode) {
    const existing = memoryStore.documentAcks.find(
      (ack) => ack.documentId === documentId && ack.userId === req.user!.id
    );
    if (!existing) {
      memoryStore.documentAcks.push({
        documentId,
        userId: req.user!.id,
        acknowledgedAt: new Date().toISOString()
      });
    }
    return res.json({ message: "Acknowledged" });
  }

  await prisma.documentAcknowledgement.upsert({
    where: {
      documentId_userId: {
        documentId,
        userId: req.user!.id
      }
    },
    update: {},
    create: {
      documentId,
      userId: req.user!.id
    }
  });

  return res.json({ message: "Acknowledged" });
});
