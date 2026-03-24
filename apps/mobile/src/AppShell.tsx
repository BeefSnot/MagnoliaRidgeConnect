import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { io, Socket } from "socket.io-client";
import { API_BASE, apiRequest } from "./api";
import { theme } from "./theme";
import {
  AlertItem,
  AuthUser,
  Conversation,
  DocumentItem,
  EventItem,
  Message,
  MessageUser,
  ModerationReport,
  NotificationItem,
  Poll,
  Post,
  CommunityPost,
  CommunityReaction,
  ResidentDirectoryEntry
} from "./types";

type TabKey =
  | "feed"
  | "messages"
  | "events"
  | "polls"
  | "directory"
  | "pets"
  | "gardening"
  | "documents"
  | "alerts"
  | "notifications"
  | "calendar"
  | "admin";

const tabOptions: Array<{ key: TabKey; label: string }> = [
  { key: "feed", label: "Home Feed" },
  { key: "messages", label: "Messages" },
  { key: "events", label: "Events" },
  { key: "polls", label: "Polls" },
  { key: "directory", label: "Neighbors" },
  { key: "pets", label: "Pets" },
  { key: "gardening", label: "Plants" },
  { key: "documents", label: "Docs" },
  { key: "alerts", label: "Alerts" },
  { key: "notifications", label: "Inbox" },
  { key: "calendar", label: "Calendar" },
  { key: "admin", label: "Admin" }
];

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PillButton({ text, onPress, type = "primary" }: { text: string; onPress: () => void; type?: "primary" | "ghost" }) {
  return (
    <Pressable onPress={onPress} style={[styles.button, type === "ghost" ? styles.buttonGhost : styles.buttonPrimary]}>
      <Text style={[styles.buttonText, type === "ghost" && styles.buttonGhostText]}>{text}</Text>
    </Pressable>
  );
}

export default function AppShell() {
  const { width } = useWindowDimensions();
  const isWideWeb = Platform.OS === "web" && width >= 1080;

  const [token, setToken] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<TabKey>("feed");

  const [loginEmail, setLoginEmail] = useState("admin@mrc.local");
  const [loginPassword, setLoginPassword] = useState("ChangeMeNow123!");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerUnit, setRegisterUnit] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState("");
  const [reportReason, setReportReason] = useState("Inappropriate content");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messageUsers, setMessageUsers] = useState<MessageUser[]>([]);
  const [messageSearch, setMessageSearch] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<number[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [onlineUserIds, setOnlineUserIds] = useState<number[]>([]);
  const [lastSeenByUserId, setLastSeenByUserId] = useState<Record<number, string>>({});
  const [typingByConversation, setTypingByConversation] = useState<Record<number, Array<{ userId: number; fullName: string }>>>({});
  const [readByMessage, setReadByMessage] = useState<Record<number, number[]>>({});

  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [eventLocation, setEventLocation] = useState("");

  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState("Option 1, Option 2");

  const [directory, setDirectory] = useState<ResidentDirectoryEntry[]>([]);
    const [petPosts, setPetPosts] = useState<CommunityPost[]>([]);
    const [petPostText, setPetPostText] = useState("");
    const [petImageUrl, setPetImageUrl] = useState("");
    const [petIsQuestion, setPetIsQuestion] = useState(false);
    const [petQuestionsOnly, setPetQuestionsOnly] = useState(false);
    const [petCommentByPost, setPetCommentByPost] = useState<Record<number, string>>({});

    const [gardenPosts, setGardenPosts] = useState<CommunityPost[]>([]);
    const [gardenPostText, setGardenPostText] = useState("");
    const [gardenImageUrl, setGardenImageUrl] = useState("");
    const [gardenIsQuestion, setGardenIsQuestion] = useState(false);
    const [gardenQuestionsOnly, setGardenQuestionsOnly] = useState(false);
    const [gardenCommentByPost, setGardenCommentByPost] = useState<Record<number, string>>({});
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [about, setAbout] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docTitle, setDocTitle] = useState("");
  const [docBody, setDocBody] = useState("");
  const [docCategory, setDocCategory] = useState("");

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pushTokenInput, setPushTokenInput] = useState("");

  const [pendingUsers, setPendingUsers] = useState<Array<{ id: number; fullName: string; unitNumber: string; email: string }>>([]);
  const [roles, setRoles] = useState<Array<{ id: number; name: string; rolePermissions?: Array<{ permission?: { id: number; key: string } }> }>>([]);
  const [permissions, setPermissions] = useState<Array<{ id: number; key: string; description?: string }>>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [users, setUsers] = useState<Array<{ id: number; fullName: string; email: string; userRoles: Array<{ role: { id: number; name: string } }> }>>([]);
  const [reports, setReports] = useState<ModerationReport[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canApprove = user?.permissions.includes("users.approve") ?? false;
  const canManageUsers = user?.permissions.includes("users.manage") ?? false;
  const canManageRoles = user?.permissions.includes("roles.manage") ?? false;
  const canCreateEvents = user?.permissions.includes("events.create") ?? false;
  const canCreatePosts = user?.permissions.includes("posts.create") ?? false;
  const canCreatePolls = user?.permissions.includes("polls.create") ?? false;
  const canManageModeration = user?.permissions.includes("moderation.manage") ?? false;
  const canManageDocuments = user?.permissions.includes("documents.manage") ?? false;
  const canReadDocuments = user?.permissions.includes("documents.read") ?? false;
  const canCreateAlerts = user?.permissions.includes("alerts.create") ?? false;
  const canReadAlerts = user?.permissions.includes("alerts.read") ?? false;
  const canManageNotifications = user?.permissions.includes("notifications.manage") ?? false;

  const roleSummary = useMemo(() => user?.roles.join(", ") ?? "resident", [user?.roles]);

  const filteredMessageUsers = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    if (!query) return messageUsers;
    return messageUsers.filter((messageUser) =>
      `${messageUser.fullName} ${messageUser.unitNumber ?? ""}`.toLowerCase().includes(query)
    );
  }, [messageSearch, messageUsers]);

  const filteredConversations = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => {
      const label = (conversation.title || conversation.participants.map((participant) => participant.user.fullName).join(", ")).toLowerCase();
      return label.includes(query);
    });
  }, [messageSearch, conversations]);

  const filteredGroupCandidates = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    if (!query) return messageUsers;
    return messageUsers.filter((messageUser) =>
      `${messageUser.fullName} ${messageUser.unitNumber ?? ""}`.toLowerCase().includes(query)
    );
  }, [groupSearch, messageUsers]);

  const displayedPetPosts = useMemo(() => {
    if (!petQuestionsOnly) return petPosts;
    return petPosts.filter((post) => post.isQuestion);
  }, [petPosts, petQuestionsOnly]);

  const displayedGardenPosts = useMemo(() => {
    if (!gardenQuestionsOnly) return gardenPosts;
    return gardenPosts.filter((post) => post.isQuestion);
  }, [gardenPosts, gardenQuestionsOnly]);

  const unreadMessageCounts = useMemo(() => {
    const counts = new Map<number, number>();
    notifications
      .filter((notification) => !notification.readAt && notification.type === "message" && typeof notification.entityId === "number")
      .forEach((notification) => {
        const conversationId = notification.entityId as number;
        counts.set(conversationId, (counts.get(conversationId) ?? 0) + 1);
      });
    return counts;
  }, [notifications]);

  const onlineUserIdSet = useMemo(() => new Set(onlineUserIds), [onlineUserIds]);
  const activeTypingUsers = useMemo(() => {
    if (!selectedConversationId) return [] as Array<{ userId: number; fullName: string }>;
    return typingByConversation[selectedConversationId] ?? [];
  }, [selectedConversationId, typingByConversation]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const petImageGallery = useMemo(
    () => petPosts.map((post) => post.imageUrl).filter((imageUrl): imageUrl is string => Boolean(imageUrl)).map((imageUrl) => resolveMediaUrl(imageUrl)),
    [petPosts]
  );

  const gardenImageGallery = useMemo(
    () => gardenPosts.map((post) => post.imageUrl).filter((imageUrl): imageUrl is string => Boolean(imageUrl)).map((imageUrl) => resolveMediaUrl(imageUrl)),
    [gardenPosts]
  );

  const activeLightboxImage = useMemo(() => {
    if (!lightboxImages.length) return null;
    if (lightboxIndex < 0 || lightboxIndex >= lightboxImages.length) return null;
    return lightboxImages[lightboxIndex] ?? null;
  }, [lightboxImages, lightboxIndex]);

  function formatLastSeen(timestamp?: string) {
    if (!timestamp) return "Offline";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "Offline";
    return `Last seen ${date.toLocaleString()}`;
  }

  function isImageUrl(url: string) {
    return /\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(url) || url.includes("/uploads/chat/");
  }

  function extractUrls(text: string) {
    const matches = text.match(/https?:\/\/[^\s]+/g) ?? [];
    return Array.from(new Set(matches));
  }

  function openUrl(url: string) {
    void Linking.openURL(url);
  }

  function resolveMediaUrl(url: string) {
    if (/^https?:\/\//i.test(url)) return url;
    const origin = API_BASE.replace(/\/api$/, "");
    return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  function openImageLightbox(url: string, gallery?: string[]) {
    const normalizedUrl = resolveMediaUrl(url);
    const normalizedGallery = (gallery?.length ? gallery : [normalizedUrl]).map((item) => resolveMediaUrl(item));
    const targetIndex = Math.max(0, normalizedGallery.indexOf(normalizedUrl));

    setLightboxImages(normalizedGallery);
    setLightboxIndex(targetIndex);
  }

  function closeLightbox() {
    setLightboxImages([]);
    setLightboxIndex(0);
  }

  function showPreviousLightboxImage() {
    setLightboxIndex((current) => (current > 0 ? current - 1 : current));
  }

  function showNextLightboxImage() {
    setLightboxIndex((current) => (current < lightboxImages.length - 1 ? current + 1 : current));
  }

  function getMessageStatus(message: Message) {
    if (!selectedConversation || message.sender.id !== user?.id) return undefined;

    const readers = readByMessage[message.id] ?? [];
    const otherParticipantIds = selectedConversation.participants
      .map((participant) => participant.user.id)
      .filter((participantId) => participantId !== user?.id);

    const hasRead = readers.some((readerId) => otherParticipantIds.includes(readerId));
    if (hasRead) return "Read";

    const hasDelivered = otherParticipantIds.some((participantId) => onlineUserIdSet.has(participantId));
    if (hasDelivered) return "Delivered";

    return "Sent";
  }

  async function login() {
    try {
      const data = await apiRequest<{ token: string; user: AuthUser }>("/auth/login", {
        method: "POST",
        body: { email: loginEmail, password: loginPassword }
      });
      setToken(data.token);
      setUser(data.user);
      Alert.alert("Welcome", `Logged in as ${data.user.fullName}`);
    } catch (error) {
      Alert.alert("Login failed", error instanceof Error ? error.message : "Unknown error");
    }
  }

  async function register() {
    try {
      await apiRequest("/auth/register", {
        method: "POST",
        body: {
          fullName: registerName,
          email: registerEmail,
          password: registerPassword,
          unitNumber: registerUnit
        }
      });
      Alert.alert("Submitted", "Registration sent for manager approval.");
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterUnit("");
    } catch (error) {
      Alert.alert("Registration failed", error instanceof Error ? error.message : "Unknown error");
    }
  }

  async function loadAll() {
    if (!token) return;
    const [feed, convs, messageUsersResult, evts, pls, dir, notes, pets, gardens] = await Promise.allSettled([
      apiRequest<{ posts: Post[] }>("/posts", { token }),
      apiRequest<{ conversations: Conversation[] }>("/messages/conversations", { token }),
      apiRequest<{ users: MessageUser[] }>("/messages/users", { token }),
      apiRequest<{ events: EventItem[] }>("/events", { token }),
      apiRequest<{ polls: Poll[] }>("/polls", { token }),
      apiRequest<{ residents: ResidentDirectoryEntry[] }>("/directory", { token }),
      apiRequest<{ notifications: NotificationItem[] }>("/notifications", { token }),
      apiRequest<{ posts: CommunityPost[] }>("/community/pets/posts", { token }),
      apiRequest<{ posts: CommunityPost[] }>("/community/gardening/posts", { token })
    ]);

    if (feed.status === "fulfilled") setPosts(feed.value.posts);
    if (convs.status === "fulfilled") setConversations(convs.value.conversations);
    if (messageUsersResult.status === "fulfilled") setMessageUsers(messageUsersResult.value.users);
    if (evts.status === "fulfilled") setEvents(evts.value.events);
    if (pls.status === "fulfilled") setPolls(pls.value.polls);
    if (dir.status === "fulfilled") setDirectory(dir.value.residents);
    if (notes.status === "fulfilled") setNotifications(notes.value.notifications);
    if (pets.status === "fulfilled") setPetPosts(pets.value.posts);
    if (gardens.status === "fulfilled") setGardenPosts(gardens.value.posts);

    if (canReadDocuments) {
      const docs = await apiRequest<{ documents: DocumentItem[] }>("/documents", { token });
      setDocuments(docs.documents);
    }

    if (canReadAlerts) {
      const emergency = await apiRequest<{ alerts: AlertItem[] }>("/alerts", { token });
      setAlerts(emergency.alerts);
    }

    if (canApprove || canManageUsers || canManageRoles || canManageModeration) {
      await loadAdminData();
    }
  }

  async function loadAdminData() {
    if (!token) return;
    const tasks: Array<Promise<void>> = [];

    if (canApprove) {
      tasks.push(
        apiRequest<{ users: Array<{ id: number; fullName: string; unitNumber: string; email: string }> }>("/users/pending", { token })
          .then((pending) => setPendingUsers(pending.users))
      );
    }

    if (canManageUsers) {
      tasks.push(
        apiRequest<{ users: Array<{ id: number; fullName: string; email: string; userRoles: Array<{ role: { id: number; name: string } }> }> }>("/users/all", { token })
          .then((userData) => setUsers(userData.users))
      );
    }

    if (canManageUsers || canManageRoles) {
      tasks.push(
        apiRequest<{ roles: Array<{ id: number; name: string; rolePermissions?: Array<{ permission?: { id: number; key: string } }> }> }>("/users/roles", { token })
          .then((roleData) => setRoles(roleData.roles))
      );
      tasks.push(
        apiRequest<{ permissions: Array<{ id: number; key: string; description?: string }> }>("/users/permissions", { token })
          .then((permissionData) => setPermissions(permissionData.permissions))
      );
    }

    if (canManageModeration) {
      tasks.push(
        apiRequest<{ reports: ModerationReport[] }>("/moderation/reports", { token })
          .then((data) => setReports(data.reports))
      );
    }

    await Promise.allSettled(tasks);
  }

  async function loadConversationMessages(conversationId: number) {
    if (!token) return;
    const data = await apiRequest<{ messages: Message[] }>(`/messages/conversations/${conversationId}/messages`, { token });
    setConversationMessages(data.messages);
    setSelectedConversationId(conversationId);
    socketRef.current?.emit("join:conversation", conversationId);
  }

  async function createPost() {
    await apiRequest("/posts", { method: "POST", token, body: { content: newPost } });
    setNewPost("");
    await loadAll();
  }

  async function reportPost(postId: number) {
    await apiRequest("/moderation/reports", {
      method: "POST",
      token,
      body: { targetType: "post", targetId: postId, reason: reportReason }
    });
    Alert.alert("Submitted", "Report sent to moderators.");
  }

  async function sendMessage() {
    if (!selectedConversationId) return;
    await apiRequest(`/messages/conversations/${selectedConversationId}/messages`, {
      method: "POST",
      token,
      body: { body: newMessage }
    });
    socketRef.current?.emit("typing:stop", {
      conversationId: selectedConversationId,
      userId: user?.id
    });
    setNewMessage("");
  }

  async function createEvent() {
    await apiRequest("/events", {
      method: "POST",
      token,
      body: {
        title: eventTitle,
        startsAt: new Date(eventStart).toISOString(),
        endsAt: new Date(eventEnd).toISOString(),
        location: eventLocation,
        syncToGoogle: true
      }
    });
    setEventTitle("");
    setEventStart("");
    setEventEnd("");
    setEventLocation("");
    await loadAll();
  }

  async function createPoll() {
    await apiRequest("/polls", {
      method: "POST",
      token,
      body: {
        question: pollQuestion,
        options: pollOptions.split(",").map((item) => item.trim()).filter(Boolean)
      }
    });
    setPollQuestion("");
    await loadAll();
  }

  async function vote(pollId: number, optionId: number) {
    await apiRequest(`/polls/${pollId}/vote`, { method: "POST", token, body: { optionId } });
    await loadAll();
  }

  async function saveDirectoryProfile() {
    await apiRequest("/directory/me", {
      method: "PUT",
      token,
      body: {
        about,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        showInDirectory: true
      }
    });
    await loadAll();
  }

  async function createDocument() {
    await apiRequest("/documents", { method: "POST", token, body: { title: docTitle, body: docBody, category: docCategory || undefined } });
    setDocTitle("");
    setDocBody("");
    setDocCategory("");
    await loadAll();
  }

  async function createCommunityPost(channel: "pets" | "gardening") {
    const content = channel === "pets" ? petPostText : gardenPostText;
    const imageUrl = channel === "pets" ? petImageUrl : gardenImageUrl;
    const isQuestion = channel === "pets" ? petIsQuestion : gardenIsQuestion;

    await apiRequest(`/community/${channel}/posts`, {
      method: "POST",
      token,
      body: {
        content,
        imageUrl: imageUrl.trim() || undefined,
        isQuestion
      }
    });

    if (channel === "pets") {
      setPetPostText("");
      setPetImageUrl("");
      setPetIsQuestion(false);
    } else {
      setGardenPostText("");
      setGardenImageUrl("");
      setGardenIsQuestion(false);
    }

    await loadAll();
  }

  async function addCommunityComment(channel: "pets" | "gardening", postId: number) {
    const value = channel === "pets" ? petCommentByPost[postId] : gardenCommentByPost[postId];
    if (!value?.trim()) return;

    await apiRequest(`/community/${channel}/posts/${postId}/comments`, {
      method: "POST",
      token,
      body: { content: value }
    });

    if (channel === "pets") {
      setPetCommentByPost((current) => ({ ...current, [postId]: "" }));
    } else {
      setGardenCommentByPost((current) => ({ ...current, [postId]: "" }));
    }

    await loadAll();
  }

  async function reactCommunityPost(channel: "pets" | "gardening", postId: number, reaction: CommunityReaction) {
    await apiRequest(`/community/${channel}/posts/${postId}/reactions`, {
      method: "POST",
      token,
      body: { reaction }
    });
    await loadAll();
  }

  async function uploadCommunityImageWeb(channel: "pets" | "gardening") {
    if (Platform.OS !== "web") {
      Alert.alert("Unsupported", "Image upload is currently available on web.");
      return;
    }

    if (!token) return;

    const browser = globalThis as typeof globalThis & {
      document?: {
        createElement: (tag: string) => any;
      };
      FormData: {
        new (): {
          append: (key: string, value: unknown, fileName?: string) => void;
        };
      };
    };

    if (!browser.document) {
      Alert.alert("Unavailable", "Could not access browser document API for file picker.");
      return;
    }

    const input = browser.document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const form = new browser.FormData();
      form.append("file", file, file.name);

      const content = channel === "pets" ? petPostText : gardenPostText;
      const isQuestion = channel === "pets" ? petIsQuestion : gardenIsQuestion;
      if (content.trim()) form.append("content", content.trim());
      form.append("isQuestion", String(isQuestion));

      const response = await fetch(`${API_BASE}/community/${channel}/posts/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: form as unknown as BodyInit
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        Alert.alert("Upload failed", data?.message ?? "Could not upload image");
        return;
      }

      if (channel === "pets") {
        setPetPostText("");
        setPetImageUrl(data?.imageUrl ?? "");
        setPetIsQuestion(false);
      } else {
        setGardenPostText("");
        setGardenImageUrl(data?.imageUrl ?? "");
        setGardenIsQuestion(false);
      }

      await loadAll();
      Alert.alert("Uploaded", "Image post created successfully.");
    };

    input.click();
  }

  function toggleGroupMember(userId: number) {
    setGroupMemberIds((current) =>
      current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId]
    );
  }

  async function createGroupConversation() {
    if (groupMemberIds.length < 2) {
      Alert.alert("Need members", "Select at least two neighbors to create a group.");
      return;
    }

    const response = await apiRequest<{ conversation: Conversation }>("/messages/conversations", {
      method: "POST",
      token,
      body: {
        title: groupTitle.trim() || "Resident Group",
        participantIds: groupMemberIds,
        isGroup: true
      }
    });

    setGroupTitle("");
    setGroupSearch("");
    setGroupMemberIds([]);
    await loadAll();
    await loadConversationMessages(response.conversation.id);
  }

  async function uploadChatImageWeb() {
    if (Platform.OS !== "web") {
      Alert.alert("Unsupported", "Chat image upload is currently available on web.");
      return;
    }

    if (!token || !selectedConversationId) {
      Alert.alert("Select conversation", "Open a conversation first.");
      return;
    }

    const browser = globalThis as typeof globalThis & {
      document?: {
        createElement: (tag: string) => any;
      };
      FormData: {
        new (): {
          append: (key: string, value: unknown, fileName?: string) => void;
        };
      };
    };

    if (!browser.document) {
      Alert.alert("Unavailable", "Could not access browser document API for file picker.");
      return;
    }

    const input = browser.document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const form = new browser.FormData();
      form.append("file", file, file.name);
      if (newMessage.trim()) {
        form.append("caption", newMessage.trim());
      }

      const response = await fetch(`${API_BASE}/messages/conversations/${selectedConversationId}/images`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: form as unknown as BodyInit
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        Alert.alert("Upload failed", data?.message ?? "Could not upload image");
        return;
      }

      setNewMessage("");
      await loadConversationMessages(selectedConversationId);
    };

    input.click();
  }

  async function startDirectMessage(userId: number) {
    const response = await apiRequest<{ conversation: Conversation }>("/messages/conversations", {
      method: "POST",
      token,
      body: {
        participantIds: [userId],
        isGroup: false
      }
    });

    await loadAll();
    await loadConversationMessages(response.conversation.id);
  }

  async function uploadDocumentFileWeb() {
    if (Platform.OS !== "web") {
      Alert.alert("Unsupported", "File upload is currently available on web.");
      return;
    }

    if (!token) return;

    const browser = globalThis as typeof globalThis & {
      document?: {
        createElement: (tag: string) => any;
      };
      FormData: {
        new (): {
          append: (key: string, value: unknown, fileName?: string) => void;
        };
      };
    };

    if (!browser.document) {
      Alert.alert("Unavailable", "Could not access browser document API for file picker.");
      return;
    }

    const input = browser.document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const form = new browser.FormData();
      form.append("file", file, file.name);
      form.append("title", docTitle.trim() || file.name);
      if (docCategory.trim()) {
        form.append("category", docCategory.trim());
      }

      const response = await fetch(`${API_BASE}/documents/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: form as unknown as BodyInit
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        Alert.alert("Upload failed", data?.message ?? "Could not upload file");
        return;
      }

      setDocTitle("");
      setDocCategory("");
      await loadAll();
      Alert.alert("Uploaded", "Document file uploaded successfully.");
    };

    input.click();
  }

  async function acknowledgeDocument(id: number) {
    await apiRequest(`/documents/${id}/acknowledge`, { method: "POST", token });
    await loadAll();
  }

  async function createAlert() {
    await apiRequest("/alerts", { method: "POST", token, body: { title: alertTitle, message: alertMessage, level: "critical" } });
    setAlertTitle("");
    setAlertMessage("");
    await loadAll();
  }

  async function markAlertRead(id: number) {
    await apiRequest(`/alerts/${id}/read`, { method: "POST", token });
    await loadAll();
  }

  async function markNotificationRead(id: number) {
    await apiRequest(`/notifications/${id}/read`, { method: "POST", token });
    await loadAll();
  }

  async function savePushToken() {
    await apiRequest("/notifications/push-token", {
      method: "POST",
      token,
      body: { token: pushTokenInput, platform: "expo" }
    });
    Alert.alert("Saved", "Push token registered");
  }

  async function approveUser(id: number) {
    await apiRequest(`/users/${id}/approve`, { method: "POST", token });
    await loadAdminData();
  }

  async function assignRole(userId: number, roleId: number) {
    await apiRequest(`/users/${userId}/roles`, { method: "POST", token, body: { roleId } });
    await loadAdminData();
  }

  async function resolveReport(id: number) {
    await apiRequest(`/moderation/reports/${id}`, { method: "PATCH", token, body: { status: "RESOLVED" } });
    await loadAdminData();
  }

  async function createRole() {
    if (!newRoleName.trim()) return;
    await apiRequest("/users/roles", {
      method: "POST",
      token,
      body: {
        name: newRoleName.trim(),
        description: newRoleDescription.trim() || undefined
      }
    });
    setNewRoleName("");
    setNewRoleDescription("");
    await loadAdminData();
  }

  async function toggleRolePermission(roleId: number, permissionId: number, enabled: boolean) {
    await apiRequest("/users/role-permissions", {
      method: "POST",
      token,
      body: { roleId, permissionId, enabled }
    });
    await loadAdminData();
  }

  useEffect(() => {
    if (!token || !user) return;

    void loadAll();

    const origin = API_BASE.replace(/\/api$/, "");
    const socket = io(origin, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.emit("join:user", user.id);
    if (selectedConversationId) {
      socket.emit("join:conversation", selectedConversationId);
    }

    socket.on("posts:new", (post: Post) => {
      setPosts((current) => [post, ...current]);
    });

    socket.on("messages:new", (message: Message) => {
      setConversationMessages((current) => [...current, message]);
    });

    socket.on("notifications:new", (notification: NotificationItem) => {
      setNotifications((current) => [notification, ...current]);
    });

    socket.on("alerts:new", (alert: AlertItem) => {
      setAlerts((current) => {
        const next = current.filter((item) => item.id !== alert.id);
        return [{ ...alert, readAt: undefined }, ...next];
      });
    });

    socket.on("presence:update", (payload: { onlineUserIds?: number[]; lastSeenByUserId?: Record<string, string> } | number[]) => {
      if (Array.isArray(payload)) {
        setOnlineUserIds(payload);
        return;
      }

      const onlineIds = Array.isArray(payload?.onlineUserIds) ? payload.onlineUserIds : [];
      setOnlineUserIds(onlineIds);

      const nextLastSeen: Record<number, string> = {};
      if (payload?.lastSeenByUserId && typeof payload.lastSeenByUserId === "object") {
        Object.entries(payload.lastSeenByUserId).forEach(([key, value]) => {
          const parsedId = Number(key);
          if (!Number.isNaN(parsedId) && typeof value === "string") {
            nextLastSeen[parsedId] = value;
          }
        });
      }
      setLastSeenByUserId(nextLastSeen);
    });

    socket.on("typing:update", (payload: { conversationId: number; userId: number; fullName?: string; isTyping: boolean }) => {
      setTypingByConversation((current) => {
        const existing = current[payload.conversationId] ?? [];

        if (payload.isTyping) {
          if (existing.some((entry) => entry.userId === payload.userId)) {
            return current;
          }
          return {
            ...current,
            [payload.conversationId]: [...existing, { userId: payload.userId, fullName: payload.fullName ?? "Neighbor" }]
          };
        }

        return {
          ...current,
          [payload.conversationId]: existing.filter((entry) => entry.userId !== payload.userId)
        };
      });
    });

    socket.on("messages:read", (payload: { conversationId: number; userId: number; readMessageIds: number[] }) => {
      if (!Array.isArray(payload.readMessageIds) || typeof payload.userId !== "number") return;

      setReadByMessage((current) => {
        const next = { ...current };
        payload.readMessageIds.forEach((messageId) => {
          const existing = new Set(next[messageId] ?? []);
          existing.add(payload.userId);
          next[messageId] = Array.from(existing);
        });
        return next;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user?.id, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || !socketRef.current || !user) return;

    const trimmed = newMessage.trim();
    if (!trimmed) {
      socketRef.current.emit("typing:stop", {
        conversationId: selectedConversationId,
        userId: user.id
      });
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      return;
    }

    socketRef.current.emit("typing:start", {
      conversationId: selectedConversationId,
      userId: user.id,
      fullName: user.fullName
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("typing:stop", {
        conversationId: selectedConversationId,
        userId: user.id
      });
      typingTimeoutRef.current = null;
    }, 1200);
  }, [newMessage, selectedConversationId, user]);

  if (!token || !user) {
    return (
      <ScrollView contentContainerStyle={styles.authContainer}>
        <Text style={styles.brand}>MRC</Text>
        <Text style={styles.subtitle}>Magnolia Ridge Connect</Text>
        <Text style={styles.smallMuted}>Magnolia Ridge MHC · Van Buren, Arkansas</Text>

        <View style={[styles.authCardStack, isWideWeb && styles.authCardStackWide]}>
          <View style={styles.authCardItem}>
            <Card title="Welcome Back">
              <Text style={styles.smallMuted}>Sign in to jump into your neighborhood feed.</Text>
              <TextInput style={styles.input} placeholder="Email" value={loginEmail} onChangeText={setLoginEmail} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="Password" value={loginPassword} onChangeText={setLoginPassword} secureTextEntry />
              <PillButton text="Sign In" onPress={() => void login()} />
            </Card>
          </View>

          <View style={styles.authCardItem}>
            <Card title="New Here? Join Magnolia Ridge">
              <Text style={styles.smallMuted}>Create your account. Management will approve your registration.</Text>
              <TextInput style={styles.input} placeholder="Full Name" value={registerName} onChangeText={setRegisterName} />
              <TextInput style={styles.input} placeholder="Email" value={registerEmail} onChangeText={setRegisterEmail} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="Unit Number" value={registerUnit} onChangeText={setRegisterUnit} />
              <TextInput style={styles.input} placeholder="Password" value={registerPassword} onChangeText={setRegisterPassword} secureTextEntry />
              <PillButton text="Submit Registration" onPress={() => void register()} />
            </Card>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, styles.pageMax]}>
        <View>
          <Text style={styles.headerBrand}>MRC</Text>
          <Text style={styles.headerMeta}>{user.fullName} · {roleSummary}</Text>
        </View>
        <PillButton text="Logout" onPress={() => { setToken(""); setUser(null); setTab("feed"); }} type="ghost" />
      </View>

      <View style={[styles.pageMax, styles.quickPillRow]}>
        <View style={styles.quickPill}>
          <Text style={styles.quickPillLabel}>Unread Inbox</Text>
          <Text style={styles.quickPillValue}>{notifications.filter((item) => !item.readAt).length}</Text>
        </View>
        <View style={styles.quickPill}>
          <Text style={styles.quickPillLabel}>Open Alerts</Text>
          <Text style={styles.quickPillValue}>{alerts.filter((item) => !item.readAt).length}</Text>
        </View>
        <View style={styles.quickPill}>
          <Text style={styles.quickPillLabel}>Events</Text>
          <Text style={styles.quickPillValue}>{events.length}</Text>
        </View>
      </View>

      {isWideWeb ? (
        <View style={[styles.pageMax, styles.webLayout]}>
          <ScrollView style={styles.sidebar} contentContainerStyle={styles.sidebarContent}>
            {tabOptions.map((option) => {
              if (option.key === "admin" && !(canApprove || canManageUsers || canManageRoles || canManageModeration)) return null;
              return (
                <Pressable key={option.key} onPress={() => setTab(option.key)} style={[styles.sidebarTab, tab === option.key && styles.sidebarTabActive]}>
                  <Text style={[styles.sidebarTabText, tab === option.key && styles.sidebarTabTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <ScrollView contentContainerStyle={[styles.body, styles.webBody]}>
            <Text style={styles.pageTitle}>{tabOptions.find((option) => option.key === tab)?.label}</Text>
            <Text style={styles.pageSubtitle}>A friendly social hub for Magnolia Ridge neighbors.</Text>
            {renderTabContent()}
          </ScrollView>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabRow, styles.pageMax]}>
            {tabOptions.map((option) => {
              if (option.key === "admin" && !(canApprove || canManageUsers || canManageRoles || canManageModeration)) return null;
              return (
                <Pressable key={option.key} onPress={() => setTab(option.key)} style={[styles.tab, tab === option.key && styles.tabActive]}>
                  <Text style={[styles.tabText, tab === option.key && styles.tabTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView contentContainerStyle={[styles.body, styles.pageMax]}>
            {renderTabContent()}
          </ScrollView>
        </>
      )}

      {!!activeLightboxImage && (
        <Pressable style={styles.lightboxOverlay} onPress={closeLightbox}>
          <View style={styles.lightboxCard}>
            <Pressable onPress={() => {}}>
              <Image source={{ uri: activeLightboxImage }} style={styles.lightboxImage} resizeMode="contain" />
              <View style={styles.lightboxControls}>
                <Pressable
                  style={[styles.lightboxNavButton, lightboxIndex === 0 && styles.lightboxNavButtonDisabled]}
                  disabled={lightboxIndex === 0}
                  onPress={showPreviousLightboxImage}
                >
                  <Text style={styles.lightboxNavText}>Previous</Text>
                </Pressable>

                <Text style={styles.lightboxCounter}>{lightboxIndex + 1} / {lightboxImages.length}</Text>

                <Pressable
                  style={[styles.lightboxNavButton, lightboxIndex >= lightboxImages.length - 1 && styles.lightboxNavButtonDisabled]}
                  disabled={lightboxIndex >= lightboxImages.length - 1}
                  onPress={showNextLightboxImage}
                >
                  <Text style={styles.lightboxNavText}>Next</Text>
                </Pressable>
              </View>
              <Pressable style={styles.lightboxCloseButton} onPress={closeLightbox}>
                <Text style={styles.lightboxCloseText}>Close</Text>
              </Pressable>
            </Pressable>
          </View>
        </Pressable>
      )}

      {false && <View />}
    </View>
  );

  function renderTabContent() {
    return (
      <>
        {tab === "feed" && (
          <View style={styles.feedGrid}>
            <View style={styles.feedMain}>
              <Card title="Create Post">
                {canCreatePosts ? (
                  <>
                    <TextInput style={[styles.input, styles.multiInput]} multiline placeholder="What's happening in Magnolia Ridge?" value={newPost} onChangeText={setNewPost} />
                    <PillButton text="Post Update" onPress={() => void createPost()} />
                  </>
                ) : (
                  <Text style={styles.smallMuted}>You don't currently have permission to create posts.</Text>
                )}
              </Card>

              <Card title="Neighborhood Feed">
                <TextInput style={styles.input} value={reportReason} onChangeText={setReportReason} placeholder="Reason used when reporting a post" />
                {!posts.length && <Text style={styles.emptyState}>No posts yet. Be the first neighbor to share an update.</Text>}
                {posts.map((post) => (
                  <View key={post.id} style={styles.itemCard}>
                    <Text style={styles.itemAuthor}>{post.author?.fullName} · Unit {post.author?.unitNumber}</Text>
                    <Text style={styles.itemText}>{post.content}</Text>
                    <Text style={styles.itemMeta}>{new Date(post.createdAt).toLocaleString()}</Text>
                    <PillButton text="Report" onPress={() => void reportPost(post.id)} type="ghost" />
                  </View>
                ))}
              </Card>
            </View>

            <View style={styles.feedSide}>
              <Card title="Upcoming Events">
                {events.slice(0, 5).map((eventItem) => (
                  <View key={`feed-event-${eventItem.id}`} style={styles.sideListItem}>
                    <Text style={styles.itemAuthor}>{eventItem.title}</Text>
                    <Text style={styles.itemMeta}>{new Date(eventItem.startsAt).toLocaleDateString()}</Text>
                  </View>
                ))}
              </Card>

              <Card title="Active Polls">
                {polls.slice(0, 4).map((poll) => (
                  <View key={`feed-poll-${poll.id}`} style={styles.sideListItem}>
                    <Text style={styles.itemAuthor}>{poll.question}</Text>
                    <Text style={styles.itemMeta}>{poll.options.length} options</Text>
                  </View>
                ))}
              </Card>

              <Card title="Quick Stats">
                <Text style={styles.itemText}>Residents in directory: {directory.length}</Text>
                <Text style={styles.itemText}>Unread notifications: {notifications.filter((n) => !n.readAt).length}</Text>
              </Card>
            </View>
          </View>
        )}

        {tab === "messages" && (
          <Card title="Private Messages">
            <Text style={styles.smallMuted}>Search neighbors, start a private chat, and message in real time.</Text>
            <Text style={styles.sectionTitle}>Create Resident Group</Text>
            <TextInput style={styles.input} placeholder="Group name" value={groupTitle} onChangeText={setGroupTitle} />
            <TextInput style={styles.input} placeholder="Search neighbors for group" value={groupSearch} onChangeText={setGroupSearch} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.userChips}>
              {filteredGroupCandidates.map((candidate) => (
                <Pressable
                  key={`group-member-${candidate.id}`}
                  style={[styles.chip, groupMemberIds.includes(candidate.id) && styles.chipActive]}
                  onPress={() => toggleGroupMember(candidate.id)}
                >
                  <Text style={[styles.chipText, groupMemberIds.includes(candidate.id) && styles.chipTextActive]}>{candidate.fullName}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <PillButton text="Create Group" onPress={() => void createGroupConversation()} type="ghost" />

            <TextInput
              style={styles.input}
              placeholder="Search people or conversations"
              value={messageSearch}
              onChangeText={setMessageSearch}
            />

            <View style={[styles.messagesGrid, isWideWeb && styles.messagesGridWide]}>
              <View style={styles.messagesPeopleCol}>
                <Text style={styles.sectionTitle}>People</Text>
                {!filteredMessageUsers.length && <Text style={styles.emptyState}>No neighbors match your search.</Text>}
                {filteredMessageUsers.map((messageUser) => (
                  <View key={`person-${messageUser.id}`} style={styles.personRow}>
                    <View style={styles.personInfo}>
                      <View style={styles.personNameRow}>
                        <Text style={styles.itemAuthor}>{messageUser.fullName}</Text>
                        <View style={[styles.presenceDot, onlineUserIdSet.has(messageUser.id) ? styles.presenceDotOnline : styles.presenceDotOffline]} />
                        <Text style={styles.itemMeta}>{onlineUserIdSet.has(messageUser.id) ? "Online" : "Offline"}</Text>
                      </View>
                      {!onlineUserIdSet.has(messageUser.id) && <Text style={styles.itemMeta}>{formatLastSeen(lastSeenByUserId[messageUser.id])}</Text>}
                      <Text style={styles.itemMeta}>Unit {messageUser.unitNumber ?? "N/A"}</Text>
                    </View>
                    <Pressable style={styles.personAction} onPress={() => void startDirectMessage(messageUser.id)}>
                      <Text style={styles.personActionText}>Chat</Text>
                    </Pressable>
                  </View>
                ))}
              </View>

              <View style={styles.messagesConversationCol}>
                <Text style={styles.sectionTitle}>Conversations</Text>
                {!filteredConversations.length && <Text style={styles.emptyState}>No conversations match your search.</Text>}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.userChips}>
                  {filteredConversations.map((conversation) => (
                    (() => {
                      const unreadCount = unreadMessageCounts.get(conversation.id) ?? 0;
                      return (
                    <Pressable
                      key={conversation.id}
                      onPress={() => void loadConversationMessages(conversation.id)}
                      style={[styles.chip, selectedConversationId === conversation.id && styles.chipActive]}
                    >
                      <View style={styles.conversationChipRow}>
                        <Text style={[styles.chipText, selectedConversationId === conversation.id && styles.chipTextActive]}>
                          {conversation.title || conversation.participants.map((participant) => participant.user.fullName).join(", ")}
                        </Text>
                        {unreadCount > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                      );
                    })()
                  ))}
                </ScrollView>

                {selectedConversationId ? (
                  <>
                    <View style={styles.messageList}>
                      {conversationMessages.map((message) => (
                        (() => {
                          const urls = extractUrls(message.body);
                          return (
                        <View
                          key={message.id}
                          style={[
                            styles.messageBubble,
                            message.sender.id === user?.id ? styles.messageBubbleMine : styles.messageBubbleOther
                          ]}
                        >
                          <Text style={styles.itemAuthor}>{message.sender.fullName}</Text>
                          <Text style={styles.itemText}>{message.body}</Text>
                          {message.sender.id === user?.id && <Text style={styles.messageStatusText}>{getMessageStatus(message)}</Text>}
                          {urls.length > 0 && (
                            <View style={styles.linkList}>
                              {urls.map((url) => (
                                <View key={`${message.id}-${url}`}>
                                  {isImageUrl(url) && (
                                    <Pressable onPress={() => openImageLightbox(url, urls.filter((item) => isImageUrl(item)).map((item) => resolveMediaUrl(item)))}>
                                      <Image source={{ uri: resolveMediaUrl(url) }} style={styles.chatImage} resizeMode="cover" />
                                    </Pressable>
                                  )}
                                  <Pressable onPress={() => openUrl(resolveMediaUrl(url))}>
                                    <Text style={styles.linkText}>Open attachment/link</Text>
                                  </Pressable>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                          );
                        })()
                      ))}
                    </View>
                    {!!activeTypingUsers.length && (
                      <Text style={styles.typingText}>
                        {activeTypingUsers.map((entry) => entry.fullName).join(", ")} typing...
                      </Text>
                    )}
                    <TextInput style={styles.input} placeholder="Write a message" value={newMessage} onChangeText={setNewMessage} />
                    <PillButton text="Upload Image (Web)" onPress={() => void uploadChatImageWeb()} type="ghost" />
                    <PillButton text="Send" onPress={() => void sendMessage()} />
                  </>
                ) : (
                  <Text style={styles.emptyState}>Select or start a conversation to begin messaging.</Text>
                )}
              </View>
            </View>
          </Card>
        )}

        {tab === "events" && (
          <Card title="Community Events">
            {canCreateEvents ? (
              <>
                <TextInput style={styles.input} placeholder="Event title" value={eventTitle} onChangeText={setEventTitle} />
                <TextInput style={styles.input} placeholder="Start (YYYY-MM-DD HH:mm)" value={eventStart} onChangeText={setEventStart} />
                <TextInput style={styles.input} placeholder="End (YYYY-MM-DD HH:mm)" value={eventEnd} onChangeText={setEventEnd} />
                <TextInput style={styles.input} placeholder="Location" value={eventLocation} onChangeText={setEventLocation} />
                <PillButton text="Create Event" onPress={() => void createEvent()} />
              </>
            ) : null}

            {events.map((eventItem) => (
              <View key={eventItem.id} style={styles.itemCard}>
                <Text style={styles.itemAuthor}>{eventItem.title}</Text>
                <Text style={styles.itemMeta}>{new Date(eventItem.startsAt).toLocaleString()} - {new Date(eventItem.endsAt).toLocaleString()}</Text>
                {!!eventItem.location && <Text style={styles.itemText}>{eventItem.location}</Text>}
              </View>
            ))}
            {!events.length && <Text style={styles.emptyState}>No events posted yet.</Text>}
          </Card>
        )}

        {tab === "polls" && (
          <Card title="Community Polls">
            {canCreatePolls ? (
              <>
                <TextInput style={styles.input} placeholder="Poll question" value={pollQuestion} onChangeText={setPollQuestion} />
                <TextInput style={styles.input} placeholder="Option 1, Option 2" value={pollOptions} onChangeText={setPollOptions} />
                <PillButton text="Create Poll" onPress={() => void createPoll()} />
              </>
            ) : null}
            {polls.map((poll) => (
              <View key={poll.id} style={styles.itemCard}>
                <Text style={styles.itemAuthor}>{poll.question}</Text>
                {poll.options.map((option) => (
                  <Pressable key={option.id} onPress={() => void vote(poll.id, option.id)} style={styles.voteOption}>
                    <Text style={styles.voteText}>{option.label}</Text>
                    <Text style={styles.itemMeta}>Votes: {poll.votes.filter((voteItem) => voteItem.optionId === option.id).length}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
            {!polls.length && <Text style={styles.emptyState}>No active polls right now.</Text>}
          </Card>
        )}

        {tab === "directory" && (
          <Card title="Resident Directory">
            <TextInput style={styles.input} placeholder="About me" value={about} onChangeText={setAbout} />
            <TextInput style={styles.input} placeholder="Contact email" value={contactEmail} onChangeText={setContactEmail} />
            <TextInput style={styles.input} placeholder="Contact phone" value={contactPhone} onChangeText={setContactPhone} />
            <PillButton text="Save Profile" onPress={() => void saveDirectoryProfile()} />
            {directory.map((entry) => (
              <View key={entry.userId} style={styles.itemCard}>
                <Text style={styles.itemAuthor}>{entry.user.fullName} · Unit {entry.user.unitNumber}</Text>
                {!!entry.about && <Text style={styles.itemText}>{entry.about}</Text>}
                {!!entry.contactEmail && <Text style={styles.itemMeta}>{entry.contactEmail}</Text>}
              </View>
            ))}
            {!directory.length && <Text style={styles.emptyState}>No directory profiles to show yet.</Text>}
          </Card>
        )}

        {tab === "pets" && (
          <Card title="Pets Community">
            <Text style={styles.smallMuted}>Share pet photos, ask care questions, react, and comment with neighbors.</Text>
            <TextInput style={[styles.input, styles.multiInput]} multiline placeholder="Share a pet story or ask a pet care question" value={petPostText} onChangeText={setPetPostText} />
            <TextInput style={styles.input} placeholder="Pet photo URL (optional)" value={petImageUrl} onChangeText={setPetImageUrl} />
            <Pressable style={[styles.chip, petIsQuestion && styles.chipActive]} onPress={() => setPetIsQuestion((current) => !current)}>
              <Text style={[styles.chipText, petIsQuestion && styles.chipTextActive]}>Mark as question</Text>
            </Pressable>
            <Pressable style={[styles.chip, petQuestionsOnly && styles.chipActive]} onPress={() => setPetQuestionsOnly((current) => !current)}>
              <Text style={[styles.chipText, petQuestionsOnly && styles.chipTextActive]}>Questions only</Text>
            </Pressable>
            <PillButton text="Post to Pets" onPress={() => void createCommunityPost("pets")} />
            <PillButton text="Upload Pet Photo (Web)" onPress={() => void uploadCommunityImageWeb("pets")} type="ghost" />

            {!displayedPetPosts.length && <Text style={styles.emptyState}>No pet posts yet.</Text>}
            {displayedPetPosts.map((post) => (
              <View key={`pet-post-${post.id}`} style={styles.itemCard}>
                <Text style={styles.itemAuthor}>{post.author.fullName} · Unit {post.author.unitNumber}</Text>
                {post.isQuestion && <Text style={styles.itemMeta}>Question</Text>}
                <Text style={styles.itemText}>{post.content}</Text>
                {!!post.imageUrl && (
                  <Pressable onPress={() => openImageLightbox(post.imageUrl!, petImageGallery)}>
                    <Image source={{ uri: resolveMediaUrl(post.imageUrl!) }} style={styles.communityImage} resizeMode="cover" />
                    <Text style={styles.linkText}>Open pet photo</Text>
                  </Pressable>
                )}
                <View style={styles.reactionRow}>
                  {(["like", "love", "wow", "helpful"] as CommunityReaction[]).map((reaction) => (
                    <Pressable key={`pet-${post.id}-${reaction}`} style={[styles.chip, post.myReaction === reaction && styles.chipActive]} onPress={() => void reactCommunityPost("pets", post.id, reaction)}>
                      <Text style={[styles.chipText, post.myReaction === reaction && styles.chipTextActive]}>{reaction} ({post.reactions[reaction] ?? 0})</Text>
                    </Pressable>
                  ))}
                </View>

                {post.comments.map((comment) => (
                  <View key={`pet-comment-${comment.id}`} style={styles.commentCard}>
                    <Text style={styles.itemAuthor}>{comment.author.fullName}</Text>
                    <Text style={styles.itemText}>{comment.content}</Text>
                  </View>
                ))}

                <TextInput
                  style={styles.input}
                  placeholder="Write a comment"
                  value={petCommentByPost[post.id] ?? ""}
                  onChangeText={(value) => setPetCommentByPost((current) => ({ ...current, [post.id]: value }))}
                />
                <PillButton text="Comment" onPress={() => void addCommunityComment("pets", post.id)} type="ghost" />
              </View>
            ))}
          </Card>
        )}

        {tab === "gardening" && (
          <Card title="House Plants & Gardening">
            <Text style={styles.smallMuted}>Share plant photos, gardening tips, care questions, reactions, and comments.</Text>
            <TextInput style={[styles.input, styles.multiInput]} multiline placeholder="Share a gardening update or ask a plant care question" value={gardenPostText} onChangeText={setGardenPostText} />
            <TextInput style={styles.input} placeholder="Plant/garden photo URL (optional)" value={gardenImageUrl} onChangeText={setGardenImageUrl} />
            <Pressable style={[styles.chip, gardenIsQuestion && styles.chipActive]} onPress={() => setGardenIsQuestion((current) => !current)}>
              <Text style={[styles.chipText, gardenIsQuestion && styles.chipTextActive]}>Mark as question</Text>
            </Pressable>
            <Pressable style={[styles.chip, gardenQuestionsOnly && styles.chipActive]} onPress={() => setGardenQuestionsOnly((current) => !current)}>
              <Text style={[styles.chipText, gardenQuestionsOnly && styles.chipTextActive]}>Questions only</Text>
            </Pressable>
            <PillButton text="Post to Plants" onPress={() => void createCommunityPost("gardening")} />
            <PillButton text="Upload Plant Photo (Web)" onPress={() => void uploadCommunityImageWeb("gardening")} type="ghost" />

            {!displayedGardenPosts.length && <Text style={styles.emptyState}>No gardening posts yet.</Text>}
            {displayedGardenPosts.map((post) => (
              <View key={`garden-post-${post.id}`} style={styles.itemCard}>
                <Text style={styles.itemAuthor}>{post.author.fullName} · Unit {post.author.unitNumber}</Text>
                {post.isQuestion && <Text style={styles.itemMeta}>Question</Text>}
                <Text style={styles.itemText}>{post.content}</Text>
                {!!post.imageUrl && (
                  <Pressable onPress={() => openImageLightbox(post.imageUrl!, gardenImageGallery)}>
                    <Image source={{ uri: resolveMediaUrl(post.imageUrl!) }} style={styles.communityImage} resizeMode="cover" />
                    <Text style={styles.linkText}>Open plant photo</Text>
                  </Pressable>
                )}
                <View style={styles.reactionRow}>
                  {(["like", "love", "wow", "helpful"] as CommunityReaction[]).map((reaction) => (
                    <Pressable key={`garden-${post.id}-${reaction}`} style={[styles.chip, post.myReaction === reaction && styles.chipActive]} onPress={() => void reactCommunityPost("gardening", post.id, reaction)}>
                      <Text style={[styles.chipText, post.myReaction === reaction && styles.chipTextActive]}>{reaction} ({post.reactions[reaction] ?? 0})</Text>
                    </Pressable>
                  ))}
                </View>

                {post.comments.map((comment) => (
                  <View key={`garden-comment-${comment.id}`} style={styles.commentCard}>
                    <Text style={styles.itemAuthor}>{comment.author.fullName}</Text>
                    <Text style={styles.itemText}>{comment.content}</Text>
                  </View>
                ))}

                <TextInput
                  style={styles.input}
                  placeholder="Write a comment"
                  value={gardenCommentByPost[post.id] ?? ""}
                  onChangeText={(value) => setGardenCommentByPost((current) => ({ ...current, [post.id]: value }))}
                />
                <PillButton text="Comment" onPress={() => void addCommunityComment("gardening", post.id)} type="ghost" />
              </View>
            ))}
          </Card>
        )}

        {tab === "documents" && (
          <Card title="Documents & Acknowledgements">
            {canManageDocuments ? (
              <>
                <TextInput style={styles.input} placeholder="Document title" value={docTitle} onChangeText={setDocTitle} />
                <TextInput style={styles.input} placeholder="Category (optional)" value={docCategory} onChangeText={setDocCategory} />
                <TextInput style={[styles.input, styles.multiInput]} multiline placeholder="Document body" value={docBody} onChangeText={setDocBody} />
                <PillButton text="Create Document" onPress={() => void createDocument()} />
                <PillButton text="Upload File (Web)" onPress={() => void uploadDocumentFileWeb()} type="ghost" />
              </>
            ) : null}
            {documents.map((document) => (
              <View key={document.id} style={styles.itemCard}>
                <Text style={styles.itemAuthor}>{document.title}</Text>
                <Text style={styles.itemText}>{document.body}</Text>
                <Text style={styles.itemMeta}>{document.acknowledged ? "Acknowledged" : "Not acknowledged"}</Text>
                {!document.acknowledged && <PillButton text="Acknowledge" onPress={() => void acknowledgeDocument(document.id)} type="ghost" />}
              </View>
            ))}
            {!documents.length && <Text style={styles.emptyState}>No documents available yet.</Text>}
          </Card>
        )}

        {tab === "alerts" && (
          <Card title="Emergency Alerts">
            {canCreateAlerts ? (
              <>
                <TextInput style={styles.input} placeholder="Alert title" value={alertTitle} onChangeText={setAlertTitle} />
                <TextInput style={[styles.input, styles.multiInput]} multiline placeholder="Alert message" value={alertMessage} onChangeText={setAlertMessage} />
                <PillButton text="Broadcast Alert" onPress={() => void createAlert()} />
              </>
            ) : null}
            {alerts.map((alert) => (
              <View key={alert.id} style={styles.itemCard}>
                <Text style={styles.itemAuthor}>{alert.title}</Text>
                <Text style={styles.itemText}>{alert.message}</Text>
                <Text style={styles.itemMeta}>{alert.readAt ? "Read" : "Unread"}</Text>
                {!alert.readAt && <PillButton text="Mark Read" onPress={() => void markAlertRead(alert.id)} type="ghost" />}
              </View>
            ))}
            {!alerts.length && <Text style={styles.emptyState}>No emergency alerts right now.</Text>}
          </Card>
        )}

        {tab === "notifications" && (
          <Card title="Notifications & Push">
            {canManageNotifications ? (
              <>
                <TextInput style={styles.input} placeholder="Expo push token" value={pushTokenInput} onChangeText={setPushTokenInput} />
                <PillButton text="Save Push Token" onPress={() => void savePushToken()} />
              </>
            ) : (
              <Text style={styles.smallMuted}>Push token management is available to staff roles only.</Text>
            )}
            {notifications.map((notification) => (
              <View key={notification.id} style={styles.itemCard}>
                <Text style={styles.itemAuthor}>{notification.title}</Text>
                <Text style={styles.itemText}>{notification.body}</Text>
                <Text style={styles.itemMeta}>{notification.readAt ? "Read" : "Unread"}</Text>
                {!notification.readAt && <PillButton text="Mark Read" onPress={() => void markNotificationRead(notification.id)} type="ghost" />}
              </View>
            ))}
            {!notifications.length && <Text style={styles.emptyState}>No notifications yet.</Text>}
          </Card>
        )}

        {tab === "calendar" && (
          <Card title="Google Calendar View">
            <Text style={styles.itemText}>Use the backend Google OAuth flow to connect and sync events.</Text>
            {events.map((eventItem) => (
              <View key={eventItem.id} style={styles.itemCard}>
                <Text style={styles.itemAuthor}>{eventItem.title}</Text>
                <Text style={styles.itemMeta}>{new Date(eventItem.startsAt).toLocaleDateString()}</Text>
              </View>
            ))}
          </Card>
        )}

        {tab === "admin" && (
          <Card title="Admin & Moderation">
            {canApprove && (
              <>
                <Text style={styles.sectionTitle}>Pending Registrations</Text>
                {pendingUsers.map((pendingUser) => (
                  <View key={pendingUser.id} style={styles.itemCard}>
                    <Text style={styles.itemAuthor}>{pendingUser.fullName}</Text>
                    <Text style={styles.itemText}>{pendingUser.email} · Unit {pendingUser.unitNumber}</Text>
                    <PillButton text="Approve" onPress={() => void approveUser(pendingUser.id)} />
                  </View>
                ))}
              </>
            )}

            {canManageUsers && (
              <>
                <Text style={styles.sectionTitle}>User Management</Text>
                {users.map((managedUser) => (
                  <View key={managedUser.id} style={styles.itemCard}>
                    <Text style={styles.itemAuthor}>{managedUser.fullName}</Text>
                    <Text style={styles.itemMeta}>{managedUser.email}</Text>
                    <Text style={styles.itemMeta}>Roles: {managedUser.userRoles.map((item) => item.role.name).join(", ") || "none"}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.userChips}>
                      {roles.map((role) => (
                        <Pressable key={role.id} style={styles.chip} onPress={() => void assignRole(managedUser.id, role.id)}>
                          <Text style={styles.chipText}>Assign {role.name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ))}

              </>
            )}

            {canManageRoles && (
              <>
                <Text style={styles.sectionTitle}>Role & Permission Editor</Text>
                <TextInput style={styles.input} placeholder="New role name (example: resident)" value={newRoleName} onChangeText={setNewRoleName} />
                <TextInput style={styles.input} placeholder="Role description" value={newRoleDescription} onChangeText={setNewRoleDescription} />
                <PillButton text="Create Role" onPress={() => void createRole()} />

                {roles.map((role) => {
                  const activePermissionIds = new Set((role.rolePermissions ?? []).map((rp) => rp.permission?.id).filter(Boolean) as number[]);
                  return (
                    <View key={`role-${role.id}`} style={styles.itemCard}>
                      <Text style={styles.itemAuthor}>{role.name}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.userChips}>
                        {permissions.map((permission) => {
                          const enabled = activePermissionIds.has(permission.id);
                          return (
                            <Pressable
                              key={`perm-${role.id}-${permission.id}`}
                              style={[styles.chip, enabled && styles.chipActive]}
                              onPress={() => void toggleRolePermission(role.id, permission.id, !enabled)}
                            >
                              <Text style={[styles.chipText, enabled && styles.chipTextActive]}>{permission.key}</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  );
                })}
              </>
            )}

            {canManageModeration && (
              <>
                <Text style={styles.sectionTitle}>Moderation Queue</Text>
                {reports.map((report) => (
                  <View key={report.id} style={styles.itemCard}>
                    <Text style={styles.itemAuthor}>{report.targetType} #{report.targetId}</Text>
                    <Text style={styles.itemText}>{report.reason}</Text>
                    <Text style={styles.itemMeta}>Status: {report.status}</Text>
                    {report.status !== "RESOLVED" && <PillButton text="Resolve" onPress={() => void resolveReport(report.id)} />}
                  </View>
                ))}
              </>
            )}
          </Card>
        )}
      </>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: 45
  },
  authContainer: {
    paddingTop: 70,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.background
  },
  authCardStack: {
    gap: theme.spacing.md
  },
  authCardStackWide: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  authCardItem: {
    flex: 1,
    minWidth: 320
  },
  brand: {
    fontSize: 46,
    fontWeight: "900",
    color: theme.colors.primary,
    textAlign: "center"
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    color: theme.colors.text
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background
  },
  quickPillRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm
  },
  quickPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: 999,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    alignItems: "center"
  },
  quickPillLabel: {
    color: theme.colors.textSoft,
    fontSize: 12,
    fontWeight: "600"
  },
  quickPillValue: {
    marginTop: 2,
    color: theme.colors.primaryDark,
    fontSize: 18,
    fontWeight: "800"
  },
  pageMax: {
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center"
  },
  webLayout: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg
  },
  sidebar: {
    width: 240,
    minWidth: 240,
    flexShrink: 0,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.md,
    alignSelf: "stretch"
  },
  sidebarContent: {
    padding: theme.spacing.sm,
    gap: theme.spacing.xs
  },
  sidebarTab: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  sidebarTabActive: {
    backgroundColor: theme.colors.primary
  },
  sidebarTabText: {
    color: theme.colors.primaryDark,
    fontWeight: "700"
  },
  sidebarTabTextActive: {
    color: "white"
  },
  webBody: {
    flexGrow: 1,
    minWidth: 0,
    paddingHorizontal: 0
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.primaryDark,
    marginBottom: 2
  },
  pageSubtitle: {
    color: theme.colors.textSoft,
    marginBottom: theme.spacing.md
  },
  headerBrand: {
    fontSize: 30,
    fontWeight: "900",
    color: theme.colors.primary
  },
  headerMeta: {
    color: theme.colors.textSoft,
    marginTop: 4
  },
  tabRow: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.md
  },
  tab: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: 999
  },
  tabActive: {
    backgroundColor: theme.colors.primary
  },
  tabText: {
    color: theme.colors.text,
    fontWeight: "600"
  },
  tabTextActive: {
    color: theme.colors.card
  },
  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 50,
    gap: theme.spacing.md
  },
  feedGrid: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
    flexWrap: "wrap"
  },
  feedMain: {
    flex: 2,
    minWidth: 520,
    gap: theme.spacing.md
  },
  feedSide: {
    flex: 1,
    minWidth: 260,
    gap: theme.spacing.md
  },
  messagesGrid: {
    gap: theme.spacing.md
  },
  messagesGridWide: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  messagesPeopleCol: {
    flex: 1,
    minWidth: 250,
    gap: theme.spacing.xs
  },
  messagesConversationCol: {
    flex: 2,
    minWidth: 380,
    gap: theme.spacing.sm
  },
  personRow: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm
  },
  personInfo: {
    flex: 1
  },
  personNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: 999
  },
  presenceDotOnline: {
    backgroundColor: theme.colors.success
  },
  presenceDotOffline: {
    backgroundColor: theme.colors.textSoft
  },
  personAction: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.primary
  },
  personActionText: {
    color: theme.colors.card,
    fontWeight: "700"
  },
  messageList: {
    gap: theme.spacing.sm,
    maxHeight: 360
  },
  conversationChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  unreadBadgeText: {
    color: theme.colors.card,
    fontSize: 11,
    fontWeight: "800"
  },
  messageBubble: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md + 4,
    padding: theme.spacing.sm,
    maxWidth: "85%"
  },
  messageBubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: "#E8F0FF"
  },
  messageBubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.background
  },
  messageStatusText: {
    marginTop: 4,
    color: theme.colors.textSoft,
    fontSize: 11,
    fontWeight: "700"
  },
  chatImage: {
    width: 240,
    height: 180,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.background
  },
  linkList: {
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs
  },
  linkText: {
    color: theme.colors.primary,
    fontWeight: "700",
    textDecorationLine: "underline"
  },
  typingText: {
    color: theme.colors.textSoft,
    fontStyle: "italic",
    marginTop: 4
  },
  sideListItem: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.xs,
    marginBottom: theme.spacing.xs
  },
  card: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg + 6,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 18,
    elevation: 3
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text
  },
  sectionTitle: {
    marginTop: theme.spacing.sm,
    fontWeight: "700",
    color: theme.colors.primaryDark
  },
  input: {
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md + 4,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10
  },
  multiInput: {
    minHeight: 100,
    textAlignVertical: "top"
  },
  button: {
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    marginTop: 2,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 2
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.card
  },
  buttonText: {
    color: theme.colors.card,
    fontWeight: "700"
  },
  buttonGhostText: {
    color: theme.colors.primary
  },
  itemCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md + 4,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1
  },
  itemAuthor: {
    fontWeight: "700",
    color: theme.colors.text
  },
  itemText: {
    color: theme.colors.text,
    marginTop: 4
  },
  itemMeta: {
    marginTop: 4,
    color: theme.colors.textSoft,
    fontSize: 12
  },
  smallMuted: {
    color: theme.colors.textSoft,
    textAlign: "center"
  },
  emptyState: {
    color: theme.colors.textSoft,
    textAlign: "center",
    paddingVertical: theme.spacing.sm,
    fontWeight: "600"
  },
  userChips: {
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    backgroundColor: theme.colors.card,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  chipText: {
    color: theme.colors.primaryDark,
    fontWeight: "600"
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  chipTextActive: {
    color: "white"
  },
  reactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs
  },
  commentCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    padding: theme.spacing.xs,
    marginTop: theme.spacing.xs
  },
  communityImage: {
    width: "100%",
    height: 220,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background
  },
  lightboxOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
    zIndex: 100
  },
  lightboxCard: {
    width: "100%",
    maxWidth: 980,
    maxHeight: "90%",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden"
  },
  lightboxImage: {
    width: "100%",
    height: 540,
    backgroundColor: "#000"
  },
  lightboxCloseButton: {
    alignSelf: "flex-end",
    margin: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 999,
    backgroundColor: theme.colors.primary
  },
  lightboxCloseText: {
    color: theme.colors.card,
    fontWeight: "700"
  },
  lightboxControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm
  },
  lightboxNavButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 999,
    backgroundColor: theme.colors.primary
  },
  lightboxNavButtonDisabled: {
    opacity: 0.4
  },
  lightboxNavText: {
    color: theme.colors.card,
    fontWeight: "700"
  },
  lightboxCounter: {
    color: theme.colors.textSoft,
    fontWeight: "700"
  },
  voteOption: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: 8,
    backgroundColor: theme.colors.card
  },
  voteText: {
    color: theme.colors.text,
    fontWeight: "600"
  }
});
