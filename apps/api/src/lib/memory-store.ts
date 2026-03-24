import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

export const isMemoryMode = env.DATA_MODE === "memory";

type UserStatus = "PENDING" | "ACTIVE" | "REJECTED";

type MemoryUser = {
  id: number;
  email: string;
  passwordHash: string;
  fullName: string;
  unitNumber: string;
  status: UserStatus;
  roles: string[];
  permissions: string[];
};

type MemoryRole = {
  id: number;
  name: string;
  description?: string;
};

type MemoryPermission = {
  id: number;
  key: string;
  description?: string;
};

type MemoryConversation = {
  id: number;
  title?: string;
  isGroup: boolean;
  participantIds: number[];
};

type MemoryMessage = {
  id: number;
  conversationId: number;
  senderId: number;
  body: string;
  createdAt: string;
};

type MemoryPost = {
  id: number;
  authorId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type MemoryComment = {
  id: number;
  postId: number;
  authorId: number;
  content: string;
  createdAt: string;
};

type MemoryEvent = {
  id: number;
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  createdById: number;
  googleEventId?: string;
};

type MemoryPoll = {
  id: number;
  question: string;
  createdById: number;
  closesAt?: string;
  createdAt: string;
};

type MemoryPollOption = {
  id: number;
  pollId: number;
  label: string;
};

type MemoryPollVote = {
  pollId: number;
  optionId: number;
  userId: number;
  createdAt: string;
};

type MemoryReport = {
  id: number;
  targetType: "post" | "comment" | "user";
  targetId: number;
  reason: string;
  details?: string;
  status: "OPEN" | "RESOLVED";
  createdById: number;
  resolvedById?: number;
  createdAt: string;
  resolvedAt?: string;
};

type MemoryResidentProfile = {
  userId: number;
  about?: string;
  contactEmail?: string;
  contactPhone?: string;
  showInDirectory: boolean;
};

type MemoryDocument = {
  id: number;
  title: string;
  body: string;
  category?: string;
  createdById: number;
  createdAt: string;
};

type MemoryDocumentAck = {
  documentId: number;
  userId: number;
  acknowledgedAt: string;
};

type MemoryEmergencyAlert = {
  id: number;
  title: string;
  message: string;
  level: "info" | "warning" | "critical";
  createdById: number;
  createdAt: string;
};

type MemoryEmergencyAlertRead = {
  alertId: number;
  userId: number;
  readAt: string;
};

type MemoryPushToken = {
  id: number;
  userId: number;
  token: string;
  platform: string;
  createdAt: string;
};

type MemoryNotification = {
  id: number;
  userId: number;
  title: string;
  body: string;
  type: string;
  entityId?: number;
  readAt?: string;
  createdAt: string;
};

const permissionDefs: Array<[string, string]> = [
  ["users.approve", "Approve or reject resident registrations"],
  ["users.manage", "Manage residents and assign roles"],
  ["roles.manage", "Create roles and edit permissions"],
  ["posts.create", "Create community posts"],
  ["posts.comment", "Comment on posts"],
  ["posts.report", "Report inappropriate posts/comments/users"],
  ["messages.read", "Read private and group messages"],
  ["messages.create", "Send private and group messages"],
  ["events.create", "Create and manage community events"],
  ["polls.create", "Create polls"],
  ["polls.vote", "Vote on polls"],
  ["moderation.manage", "Review and resolve moderation reports"],
  ["directory.manage", "Manage resident directory visibility"],
  ["documents.manage", "Create and update community documents"],
  ["documents.read", "Read and acknowledge documents"],
  ["alerts.create", "Create emergency alerts"],
  ["alerts.read", "Read emergency alerts"],
  ["notifications.manage", "Manage push tokens and notifications"]
];

const roles: MemoryRole[] = [
  { id: 1, name: "admin", description: "Property manager" },
  { id: 2, name: "community_manager", description: "Community manager" },
  { id: 3, name: "resident", description: "Approved resident" }
];

const permissions: MemoryPermission[] = permissionDefs.map(([key, description], index) => ({
  id: index + 1,
  key,
  description
}));

const rolePermissions: Record<string, string[]> = {
  admin: permissions.map((permission) => permission.key),
  community_manager: [
    "users.approve",
    "posts.create",
    "posts.comment",
    "posts.report",
    "messages.read",
    "messages.create",
    "events.create",
    "polls.create",
    "polls.vote",
    "moderation.manage",
    "documents.manage",
    "documents.read",
    "alerts.create",
    "alerts.read",
    "notifications.manage"
  ],
  resident: [
    "posts.create",
    "posts.comment",
    "posts.report",
    "messages.read",
    "messages.create",
    "polls.vote",
    "documents.read",
    "alerts.read"
  ]
};

const now = () => new Date().toISOString();

const adminHash = bcrypt.hashSync("ChangeMeNow123!", 12);

export const memoryStore = {
  counters: {
    user: 2,
    post: 1,
    comment: 1,
    conversation: 1,
    message: 1,
    event: 1,
    poll: 1,
    pollOption: 2,
    report: 1,
    document: 1,
    alert: 1,
    pushToken: 1,
    notification: 1
  },
  roles,
  permissions,
  rolePermissions,
  users: [
    {
      id: 1,
      email: "admin@mrc.local",
      passwordHash: adminHash,
      fullName: "MRC Property Manager",
      unitNumber: "OFFICE",
      status: "ACTIVE",
      roles: ["admin"],
      permissions: rolePermissions.admin
    },
    {
      id: 2,
      email: "resident@mrc.local",
      passwordHash: adminHash,
      fullName: "Sample Resident",
      unitNumber: "12A",
      status: "ACTIVE",
      roles: ["resident"],
      permissions: rolePermissions.resident
    }
  ] as MemoryUser[],
  approvals: [] as Array<{ userId: number; approvedBy: number; approvedAt: string; note?: string }>,
  posts: [
    {
      id: 1,
      authorId: 1,
      content: "Welcome to Magnolia Ridge Connect!",
      createdAt: now(),
      updatedAt: now()
    }
  ] as MemoryPost[],
  comments: [] as MemoryComment[],
  conversations: [
    {
      id: 1,
      title: "Community Managers",
      isGroup: true,
      participantIds: [1, 2]
    }
  ] as MemoryConversation[],
  messages: [
    {
      id: 1,
      conversationId: 1,
      senderId: 1,
      body: "Hello neighbors!",
      createdAt: now()
    }
  ] as MemoryMessage[],
  events: [
    {
      id: 1,
      title: "Community Meeting",
      description: "Monthly neighborhood meeting",
      startsAt: now(),
      endsAt: now(),
      location: "Clubhouse",
      createdById: 1
    }
  ] as MemoryEvent[],
  polls: [
    {
      id: 1,
      question: "Best day for movie night?",
      createdById: 1,
      createdAt: now()
    }
  ] as MemoryPoll[],
  pollOptions: [
    { id: 1, pollId: 1, label: "Friday" },
    { id: 2, pollId: 1, label: "Saturday" }
  ] as MemoryPollOption[],
  pollVotes: [] as MemoryPollVote[],
  googleIntegrations: [] as Array<{ userId: number; refreshToken?: string; accessToken?: string; tokenExpiresAt?: string; email?: string }>,
  reports: [] as MemoryReport[],
  residentProfiles: [
    {
      userId: 1,
      about: "Property manager",
      contactEmail: "admin@mrc.local",
      showInDirectory: true
    },
    {
      userId: 2,
      about: "Happy to be here",
      contactEmail: "resident@mrc.local",
      showInDirectory: true
    }
  ] as MemoryResidentProfile[],
  documents: [
    {
      id: 1,
      title: "Community Guidelines",
      body: "Be respectful, keep common areas clean, and look out for your neighbors.",
      category: "Rules",
      createdById: 1,
      createdAt: now()
    }
  ] as MemoryDocument[],
  documentAcks: [] as MemoryDocumentAck[],
  alerts: [] as MemoryEmergencyAlert[],
  alertReads: [] as MemoryEmergencyAlertRead[],
  pushTokens: [] as MemoryPushToken[],
  notifications: [] as MemoryNotification[]
};

export function getMemoryUserById(id: number) {
  return memoryStore.users.find((user) => user.id === id);
}

export function getMemoryUserByEmail(email: string) {
  return memoryStore.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

export function createMemoryNotification(payload: Omit<MemoryNotification, "id" | "createdAt">) {
  const notification: MemoryNotification = {
    id: ++memoryStore.counters.notification,
    createdAt: now(),
    ...payload
  };

  memoryStore.notifications.unshift(notification);
  return notification;
}
