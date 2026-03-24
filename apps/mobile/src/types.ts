export type AuthUser = {
  id: number;
  email: string;
  fullName: string;
  unitNumber?: string;
  status: string;
  roles: string[];
  permissions: string[];
};

export type Post = {
  id: number;
  content: string;
  createdAt: string;
  author: {
    id: number;
    fullName: string;
    unitNumber?: string;
  };
  comments: Array<{
    id: number;
    content: string;
    createdAt: string;
    author: {
      id: number;
      fullName: string;
    };
  }>;
};

export type Conversation = {
  id: number;
  title?: string;
  isGroup: boolean;
  participants: Array<{
    user: {
      id: number;
      fullName: string;
      unitNumber?: string;
    };
  }>;
};

export type Message = {
  id: number;
  body: string;
  createdAt: string;
  sender: {
    id: number;
    fullName: string;
  };
};

export type MessageUser = {
  id: number;
  fullName: string;
  unitNumber?: string;
  roles?: string[];
};

export type EventItem = {
  id: number;
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  location?: string;
};

export type Poll = {
  id: number;
  question: string;
  closesAt?: string;
  options: Array<{
    id: number;
    label: string;
    votes?: unknown[];
  }>;
  votes: Array<{
    pollId: number;
    userId: number;
    optionId: number;
  }>;
};

export type ResidentDirectoryEntry = {
  userId: number;
  about?: string;
  contactEmail?: string;
  contactPhone?: string;
  showInDirectory: boolean;
  user: {
    id: number;
    fullName: string;
    unitNumber?: string;
  };
};

export type DocumentItem = {
  id: number;
  title: string;
  body: string;
  category?: string;
  createdAt: string;
  acknowledged?: boolean;
};

export type AlertItem = {
  id: number;
  title: string;
  message: string;
  level: "info" | "warning" | "critical";
  createdAt: string;
  readAt?: string | null;
};

export type NotificationItem = {
  id: number;
  userId: number;
  title: string;
  body: string;
  type: string;
  entityId?: number;
  readAt?: string;
  createdAt: string;
};

export type ModerationReport = {
  id: number;
  targetType: "post" | "comment" | "user";
  targetId: number;
  reason: string;
  details?: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
};

export type CommunityReaction = "like" | "love" | "wow" | "helpful";

export type CommunityPost = {
  id: number;
  content: string;
  imageUrl?: string;
  isQuestion: boolean;
  createdAt: string;
  updatedAt?: string;
  author: {
    id: number;
    fullName: string;
    unitNumber?: string;
  };
  comments: Array<{
    id: number;
    content: string;
    createdAt: string;
    author: {
      id: number;
      fullName: string;
    };
  }>;
  reactions: Record<string, number>;
  myReaction?: CommunityReaction;
};
