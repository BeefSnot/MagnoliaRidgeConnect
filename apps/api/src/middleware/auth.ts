import { NextFunction, Request, Response } from "express";
import { getMemoryUserById, isMemoryMode } from "../lib/memory-store.js";
import { prisma } from "../lib/prisma.js";
import { verifyAuthToken } from "../lib/auth.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");
    const payload = verifyAuthToken(token);

    if (isMemoryMode) {
      const user = getMemoryUserById(payload.userId);
      if (!user || user.status !== "ACTIVE") {
        return res.status(401).json({ message: "Unauthorized" });
      }

      req.user = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        status: user.status,
        roles: user.roles,
        permissions: user.permissions
      };

      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
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

    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const roles = user.userRoles.map((item: { role: { name: string } }) => item.role.name);
    const permissions = user.userRoles.flatMap((item: { role: { rolePermissions: Array<{ permission: { key: string } }> } }) =>
      item.role.rolePermissions.map((rolePermission: { permission: { key: string } }) => rolePermission.permission.key)
    );

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      roles,
      permissions: Array.from(new Set(permissions))
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

export function requirePermission(permissionKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!req.user.permissions.includes(permissionKey)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
}
