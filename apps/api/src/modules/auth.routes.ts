import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { getMemoryUserByEmail, isMemoryMode, memoryStore } from "../lib/memory-store.js";
import { hashPassword, signAuthToken, verifyPassword } from "../lib/auth.js";
import { sendRegistrationEmails } from "../lib/mailer.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  unitNumber: z.string().min(1)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const body = registerSchema.parse(req.body);

  if (isMemoryMode) {
    const existing = getMemoryUserByEmail(body.email);
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const passwordHash = await hashPassword(body.password);
    const autoApprove = env.AUTO_APPROVE_REGISTRATION;
    const defaultRoles = autoApprove ? ["resident"] : [];

    const status: "ACTIVE" | "PENDING" = autoApprove ? "ACTIVE" : "PENDING";

    const user = {
      id: ++memoryStore.counters.user,
      email: body.email,
      passwordHash,
      fullName: body.fullName,
      unitNumber: body.unitNumber,
      status,
      roles: defaultRoles,
      permissions: Array.from(new Set(defaultRoles.flatMap((roleName) => memoryStore.rolePermissions[roleName] ?? [])))
    };

    memoryStore.users.push(user);

    if (autoApprove) {
      memoryStore.approvals.push({
        userId: user.id,
        approvedBy: 1,
        approvedAt: new Date().toISOString(),
        note: "Auto-approved in memory mode for local testing"
      });
    }

    await sendRegistrationEmails({
      fullName: body.fullName,
      email: body.email,
      unitNumber: body.unitNumber,
      isAutoApproved: autoApprove
    });

    return res.status(201).json({
      message: autoApprove
        ? "Registration completed. Account is active for local testing."
        : "Registration submitted. Account is pending approval.",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        unitNumber: user.unitNumber,
        status: user.status
      }
    });
  }

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    return res.status(400).json({ message: "Email already registered" });
  }

  const passwordHash = await hashPassword(body.password);

  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash,
      fullName: body.fullName,
      unitNumber: body.unitNumber,
      status: "PENDING"
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      unitNumber: true,
      status: true
    }
  });

  await sendRegistrationEmails({
    fullName: user.fullName,
    email: user.email,
    unitNumber: user.unitNumber,
    isAutoApproved: false
  });

  return res.status(201).json({
    message: "Registration submitted. Account is pending approval.",
    user
  });
});

authRouter.post("/login", async (req, res) => {
  const body = loginSchema.parse(req.body);

  if (isMemoryMode) {
    const user = getMemoryUserByEmail(body.email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValidPassword = await verifyPassword(body.password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({ message: "Account is not approved yet" });
    }

    const token = signAuthToken({ userId: user.id });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        unitNumber: user.unitNumber,
        status: user.status,
        roles: user.roles,
        permissions: user.permissions
      }
    });
  }

  const user = await prisma.user.findUnique({
    where: { email: body.email },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isValidPassword = await verifyPassword(body.password, user.passwordHash);
  if (!isValidPassword) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (user.status !== "ACTIVE") {
    return res.status(403).json({ message: "Account is not approved yet" });
  }

  const roles = user.userRoles.map((item: { role: { name: string } }) => item.role.name);
  const permissions = Array.from(
    new Set(
      user.userRoles.flatMap((item: { role: { rolePermissions: Array<{ permission: { key: string } }> } }) =>
        item.role.rolePermissions.map((rp: { permission: { key: string } }) => rp.permission.key)
      )
    )
  );

  const token = signAuthToken({ userId: user.id });

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      unitNumber: user.unitNumber,
      status: user.status,
      roles,
      permissions
    }
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  return res.json({ user: req.user });
});
