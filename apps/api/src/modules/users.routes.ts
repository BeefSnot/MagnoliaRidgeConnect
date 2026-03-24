import { Router } from "express";
import { z } from "zod";
import { isMemoryMode, memoryStore } from "../lib/memory-store.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";

const assignRoleSchema = z.object({
  roleId: z.coerce.number().int().positive()
});

const updatePermissionSchema = z.object({
  roleId: z.coerce.number().int().positive(),
  permissionId: z.coerce.number().int().positive(),
  enabled: z.boolean()
});

const roleSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional()
});

const permissionSchema = z.object({
  key: z.string().min(3),
  description: z.string().optional()
});

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/pending", requirePermission("users.approve"), async (_req, res) => {
  if (isMemoryMode) {
    const users = memoryStore.users
      .filter((user) => user.status === "PENDING")
      .map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        unitNumber: user.unitNumber,
        status: user.status,
        createdAt: new Date().toISOString()
      }));
    return res.json({ users });
  }

  const users = await prisma.user.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      unitNumber: true,
      status: true,
      createdAt: true
    }
  });

  return res.json({ users });
});

usersRouter.post("/:id/approve", requirePermission("users.approve"), async (req, res) => {
  const id = Number(req.params.id);

  if (isMemoryMode) {
    const user = memoryStore.users.find((item) => item.id === id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.status = "ACTIVE";
    if (!user.roles.includes("resident")) {
      user.roles.push("resident");
    }
    user.permissions = Array.from(new Set(user.roles.flatMap((role) => memoryStore.rolePermissions[role] ?? [])));
    memoryStore.approvals.push({ userId: id, approvedBy: req.user!.id, approvedAt: new Date().toISOString() });

    return res.json({ message: "User approved", user });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { status: "ACTIVE" }
  });

  const defaultRole = await prisma.role.findUnique({ where: { name: "resident" } });
  if (defaultRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: id, roleId: defaultRole.id } },
      update: {},
      create: { userId: id, roleId: defaultRole.id }
    });
  }

  await prisma.approval.create({
    data: {
      userId: id,
      approvedBy: req.user!.id
    }
  });

  return res.json({ message: "User approved", user });
});

usersRouter.post("/:id/reject", requirePermission("users.approve"), async (req, res) => {
  const id = Number(req.params.id);
  if (isMemoryMode) {
    const user = memoryStore.users.find((item) => item.id === id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.status = "REJECTED";
    return res.json({ message: "User rejected", user });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { status: "REJECTED" }
  });
  return res.json({ message: "User rejected", user });
});

usersRouter.get("/roles", requirePermission("roles.manage"), async (_req, res) => {
  if (isMemoryMode) {
    const roles = memoryStore.roles.map((role) => ({
      ...role,
      rolePermissions: (memoryStore.rolePermissions[role.name] ?? []).map((key) => ({
        permission: memoryStore.permissions.find((permission) => permission.key === key)
      }))
    }));
    return res.json({ roles });
  }

  const roles = await prisma.role.findMany({
    include: {
      rolePermissions: {
        include: {
          permission: true
        }
      }
    }
  });
  return res.json({ roles });
});

usersRouter.post("/roles", requirePermission("roles.manage"), async (req, res) => {
  const body = roleSchema.parse(req.body);
  if (isMemoryMode) {
    const existing = memoryStore.roles.find((role) => role.name === body.name);
    if (existing) return res.status(400).json({ message: "Role already exists" });
    const role = { id: memoryStore.roles.length + 1, name: body.name, description: body.description };
    memoryStore.roles.push(role);
    memoryStore.rolePermissions[body.name] = [];
    return res.status(201).json({ role });
  }

  const role = await prisma.role.create({ data: body });
  return res.status(201).json({ role });
});

usersRouter.get("/permissions", requirePermission("roles.manage"), async (_req, res) => {
  if (isMemoryMode) {
    return res.json({ permissions: memoryStore.permissions });
  }

  const permissions = await prisma.permission.findMany({ orderBy: { key: "asc" } });
  return res.json({ permissions });
});

usersRouter.post("/permissions", requirePermission("roles.manage"), async (req, res) => {
  const body = permissionSchema.parse(req.body);
  if (isMemoryMode) {
    const existing = memoryStore.permissions.find((permission) => permission.key === body.key);
    if (existing) return res.status(400).json({ message: "Permission already exists" });
    const permission = {
      id: memoryStore.permissions.length + 1,
      key: body.key,
      description: body.description
    };
    memoryStore.permissions.push(permission);
    return res.status(201).json({ permission });
  }

  const permission = await prisma.permission.create({ data: body });
  return res.status(201).json({ permission });
});

usersRouter.post("/role-permissions", requirePermission("roles.manage"), async (req, res) => {
  const body = updatePermissionSchema.parse(req.body);

  if (isMemoryMode) {
    const role = memoryStore.roles.find((item) => item.id === body.roleId);
    const permission = memoryStore.permissions.find((item) => item.id === body.permissionId);
    if (!role || !permission) return res.status(404).json({ message: "Role or permission not found" });

    const current = new Set(memoryStore.rolePermissions[role.name] ?? []);
    if (body.enabled) {
      current.add(permission.key);
    } else {
      current.delete(permission.key);
    }
    memoryStore.rolePermissions[role.name] = Array.from(current);

    memoryStore.users.forEach((user) => {
      user.permissions = Array.from(new Set(user.roles.flatMap((roleName) => memoryStore.rolePermissions[roleName] ?? [])));
    });

    return res.json({ message: "Role permission updated" });
  }

  if (body.enabled) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: body.roleId, permissionId: body.permissionId } },
      update: {},
      create: { roleId: body.roleId, permissionId: body.permissionId }
    });
  } else {
    await prisma.rolePermission.deleteMany({
      where: { roleId: body.roleId, permissionId: body.permissionId }
    });
  }

  return res.json({ message: "Role permission updated" });
});

usersRouter.post("/:id/roles", requirePermission("users.manage"), async (req, res) => {
  const userId = Number(req.params.id);
  const body = assignRoleSchema.parse(req.body);

  if (isMemoryMode) {
    const user = memoryStore.users.find((item) => item.id === userId);
    const role = memoryStore.roles.find((item) => item.id === body.roleId);
    if (!user || !role) return res.status(404).json({ message: "User or role not found" });

    if (!user.roles.includes(role.name)) {
      user.roles.push(role.name);
    }
    user.permissions = Array.from(new Set(user.roles.flatMap((roleName) => memoryStore.rolePermissions[roleName] ?? [])));

    return res.json({ message: "Role assigned" });
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId: body.roleId
      }
    },
    update: {},
    create: {
      userId,
      roleId: body.roleId
    }
  });

  return res.json({ message: "Role assigned" });
});

usersRouter.get("/all", requirePermission("users.manage"), async (_req, res) => {
  if (isMemoryMode) {
    const users = memoryStore.users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      unitNumber: user.unitNumber,
      status: user.status,
      userRoles: user.roles.map((roleName) => ({
        role: memoryStore.roles.find((role) => role.name === roleName)
      }))
    }));
    return res.json({ users });
  }

  const users = await prisma.user.findMany({
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return res.json({ users });
});
