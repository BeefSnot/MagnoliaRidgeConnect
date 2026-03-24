import { createServer } from "http";
import { Server } from "socket.io";
import { app } from "./app.js";
import { env } from "./config/env.js";

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.CLIENT_ORIGIN,
    methods: ["GET", "POST"]
  }
});

const onlineUsers = new Map<number, number>();
const lastSeenByUserId = new Map<number, string>();

function emitPresence() {
  io.emit("presence:update", {
    onlineUserIds: Array.from(onlineUsers.keys()),
    lastSeenByUserId: Object.fromEntries(lastSeenByUserId.entries())
  });
}

io.on("connection", (socket) => {
  socket.on("join:user", (userId: number) => {
    const existingUserId = socket.data.userId as number | undefined;
    if (existingUserId && existingUserId !== userId) {
      const existingCount = onlineUsers.get(existingUserId) ?? 0;
      if (existingCount <= 1) {
        onlineUsers.delete(existingUserId);
      } else {
        onlineUsers.set(existingUserId, existingCount - 1);
      }
    }

    socket.data.userId = userId;
    lastSeenByUserId.delete(userId);
    onlineUsers.set(userId, (onlineUsers.get(userId) ?? 0) + 1);
    socket.join(`user:${userId}`);
    emitPresence();
  });

  socket.on("join:conversation", (conversationId: number) => {
    socket.join(`conversation:${conversationId}`);
  });

  socket.on("typing:start", (payload: { conversationId: number; userId: number; fullName: string }) => {
    socket.to(`conversation:${payload.conversationId}`).emit("typing:update", {
      conversationId: payload.conversationId,
      userId: payload.userId,
      fullName: payload.fullName,
      isTyping: true
    });
  });

  socket.on("typing:stop", (payload: { conversationId: number; userId: number }) => {
    socket.to(`conversation:${payload.conversationId}`).emit("typing:update", {
      conversationId: payload.conversationId,
      userId: payload.userId,
      isTyping: false
    });
  });

  socket.on("disconnect", () => {
    const userId = socket.data.userId as number | undefined;
    if (!userId) return;

    const count = onlineUsers.get(userId) ?? 0;
    if (count <= 1) {
      onlineUsers.delete(userId);
    } else {
      onlineUsers.set(userId, count - 1);
    }

    lastSeenByUserId.set(userId, new Date().toISOString());

    emitPresence();
  });
});

app.set("io", io);

httpServer.listen(env.PORT, () => {
  console.log(`MRC API running on port ${env.PORT}`);
});
