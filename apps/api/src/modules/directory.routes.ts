import { Router } from "express";
import { z } from "zod";
import { isMemoryMode, memoryStore } from "../lib/memory-store.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const profileSchema = z.object({
  about: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  showInDirectory: z.boolean().default(true)
});

export const directoryRouter = Router();

directoryRouter.use(requireAuth);

directoryRouter.get("/", async (_req, res) => {
  if (isMemoryMode) {
    const residents = memoryStore.residentProfiles
      .filter((profile) => profile.showInDirectory)
      .map((profile) => ({
        ...profile,
        user: memoryStore.users.find((user) => user.id === profile.userId)
      }));

    return res.json({ residents });
  }

  const residents = await prisma.residentProfile.findMany({
    where: { showInDirectory: true },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          unitNumber: true
        }
      }
    }
  });

  return res.json({ residents });
});

directoryRouter.put("/me", async (req, res) => {
  const body = profileSchema.parse(req.body);

  if (isMemoryMode) {
    const existing = memoryStore.residentProfiles.find((profile) => profile.userId === req.user!.id);
    if (existing) {
      existing.about = body.about;
      existing.contactEmail = body.contactEmail;
      existing.contactPhone = body.contactPhone;
      existing.showInDirectory = body.showInDirectory;
      return res.json({ profile: existing });
    }

    const profile = {
      userId: req.user!.id,
      about: body.about,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      showInDirectory: body.showInDirectory
    };
    memoryStore.residentProfiles.push(profile);
    return res.json({ profile });
  }

  const profile = await prisma.residentProfile.upsert({
    where: { userId: req.user!.id },
    update: body,
    create: {
      userId: req.user!.id,
      ...body
    }
  });

  return res.json({ profile });
});

directoryRouter.patch("/:userId/visibility", requirePermission("directory.manage"), async (req, res) => {
  const userId = Number(req.params.userId);
  const visible = Boolean(req.body.showInDirectory);

  if (isMemoryMode) {
    const profile = memoryStore.residentProfiles.find((item) => item.userId === userId);
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    profile.showInDirectory = visible;
    return res.json({ profile });
  }

  const profile = await prisma.residentProfile.update({
    where: { userId },
    data: { showInDirectory: visible }
  });

  return res.json({ profile });
});
