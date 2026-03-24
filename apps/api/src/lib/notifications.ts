import { prisma } from "./prisma.js";
import { createMemoryNotification, isMemoryMode, memoryStore } from "./memory-store.js";

export async function notifyUsers(
  app: { get: (key: string) => any },
  userIds: number[],
  payload: { title: string; body: string; type: string; entityId?: number }
) {
  const io = app.get("io");

  const dedupedUserIds = Array.from(new Set(userIds));
  if (!dedupedUserIds.length) return;

  if (isMemoryMode) {
    dedupedUserIds.forEach((userId) => {
      const notification = createMemoryNotification({
        userId,
        title: payload.title,
        body: payload.body,
        type: payload.type,
        entityId: payload.entityId
      });
      io.to(`user:${userId}`).emit("notifications:new", notification);
    });
    return;
  }

  await Promise.all(
    dedupedUserIds.map(async (userId) => {
      const notification = await prisma.notification.create({
        data: {
          userId,
          title: payload.title,
          body: payload.body,
          type: payload.type,
          entityId: payload.entityId
        }
      });
      io.to(`user:${userId}`).emit("notifications:new", notification);
    })
  );
}

export async function allUserIds() {
  if (isMemoryMode) {
    return memoryStore.users.map((user) => user.id);
  }

  const users = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true }
  });

  return users.map((user: { id: number }) => user.id);
}
