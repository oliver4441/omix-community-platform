/**
 * omix-api client — the app's entire backend is this Cloudflare Worker
 * (D1 database + R2 storage + auth). Supabase is no longer used.
 *
 * Set NEXT_PUBLIC_API_BASE_URL at build time to point the app at the deployed
 * worker, e.g. https://omix-api.<your-subdomain>.workers.dev
 */
import type {
  Server,
  Channel,
  Message,
  User,
  DMChannel,
  CallLogEntry,
  UserStats,
} from "@/lib/types";

export const API_BASE_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) || "";

const TOKEN_KEY = "os_session";
const UID_KEY = "os_uid";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** The signed-in user id (mirrors what the server stores in session_id). */
export function getUserId(): string | null {
  try {
    return localStorage.getItem(UID_KEY);
  } catch {
    return null;
  }
}

export function setUserId(id: string | null): void {
  try {
    if (id) localStorage.setItem(UID_KEY, id);
    else localStorage.removeItem(UID_KEY);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message?: string) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) throw new ApiError("api_not_configured", 0);
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let code = "error";
    try {
      const body = (await res.json()) as { error?: string };
      code = body?.error || code;
    } catch {
      /* keep default */
    }
    throw new ApiError(code, res.status);
  }
  return (await res.json()) as T;
}

/** Ably authUrl — when set, the Ably client uses it instead of the hardcoded key. */
export function getAblyAuthUrl(): string | null {
  return API_BASE_URL ? `${API_BASE_URL}/ably/token` : null;
}

// ═════════════════════════ AUTH ═════════════════════════

export const api = {
  // ── auth ──
  auth: {
    signup(email: string, password: string, displayName: string) {
      return request<{ ok: boolean; needsVerification: boolean }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, displayName }),
      });
    },
    verifyEmail(token: string) {
      return request<{ ok: boolean }>("/auth/verify", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
    },
    async login(email: string, password: string) {
      const res = await request<{ ok: boolean; token: string; user: AuthUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(res.token);
      return res;
    },
    me() {
      return request<{ user: AuthUser }>("/auth/me");
    },
    async logout() {
      try {
        await request<{ ok: boolean }>("/auth/logout", { method: "POST" });
      } catch {
        /* ignore */
      }
      setToken(null);
    },
    forgot(email: string) {
      return request<{ ok: boolean }>("/auth/forgot", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    },
    resetPassword(token: string, password: string) {
      return request<{ ok: boolean }>("/auth/reset", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
    },
    resendVerification(email: string) {
      return request<{ ok: boolean }>("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    },
    githubLoginUrl(): string {
      return `${API_BASE_URL}/auth/github/login`;
    },
    changePassword(currentPassword: string, newPassword: string) {
      return request<{ ok: boolean }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },
    deleteAccount(password: string) {
      return request<{ ok: boolean }>("/auth/account", {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
    },
    /** Read a #session=... token (GitHub OAuth return) out of the URL and store it. */
    consumeSessionFromUrl(): boolean {
      if (typeof window === "undefined") return false;
      const m = window.location.hash.match(/session=([^&]+)/);
      if (m && m[1]) {
        setToken(m[1]);
        return true;
      }
      return false;
    },
  },

  // ── config / admin ──
  getConfigSettings() {
    return request<{ adminEmail: string; adminUid: string }>("/config/settings");
  },
  verifyAdminPassword(password: string) {
    return request<{ valid: boolean }>("/admin/verify-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },
  promoteAdmin(email: string) {
    return request<{ ok: boolean }>("/config/settings", {
      method: "PUT",
      body: JSON.stringify({ adminEmail: email }),
    });
  },

  // ── servers ──
  listServers() {
    return request<Server[]>("/servers");
  },
  listPublicServers() {
    return request<Server[]>("/servers/public");
  },
  getServer(id: string) {
    return request<Server>(`/servers/${id}`);
  },
  createServer(data: { name: string; description?: string; privacy?: "public" | "private" }) {
    return request<{ id: string }>("/servers", { method: "POST", body: JSON.stringify(data) });
  },
  updateServer(
    id: string,
    data: { name?: string; icon?: string; description?: string; privacy?: "public" | "private" }
  ) {
    return request<{ ok: boolean }>(`/servers/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  },
  deleteServer(id: string) {
    return request<{ ok: boolean }>(`/servers/${id}`, { method: "DELETE" });
  },

  // ── invites ──
  createInvite(serverId: string) {
    return request<{ code: string }>(`/servers/${serverId}/invite`, { method: "POST" });
  },
  joinServerByInvite(code: string) {
    return request<{ serverId: string }>("/invites/join", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },

  // ── channels ──
  listChannels(serverId: string) {
    return request<Channel[]>(`/servers/${serverId}/channels`);
  },
  createChannel(serverId: string, data: { name: string; category?: string; type?: string; icon?: string }) {
    return request<{ id: string }>(`/servers/${serverId}/channels`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  updateChannel(id: string, data: { name?: string; icon?: string; topic?: string }) {
    return request<{ ok: boolean }>(`/channels/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  },
  deleteChannel(id: string) {
    return request<{ ok: boolean }>(`/channels/${id}`, { method: "DELETE" });
  },

  // ── messages ──
  getMessages(
    channelId: string,
    opts: { before?: string; limit?: number; pinned?: boolean; threadId?: string } = {}
  ) {
    if (opts.pinned) return request<{ messages: Message[] }>(`/channels/${channelId}/pins`);
    const q = new URLSearchParams();
    if (opts.before) q.set("before", opts.before);
    if (opts.limit) q.set("limit", String(opts.limit));
    if (opts.threadId) q.set("thread", opts.threadId);
    const path = `/channels/${channelId}/messages${q.toString() ? `?${q}` : ""}`;
    return request<{ messages: Message[] }>(path);
  },
  sendMessage(
    channelId: string,
    msg: {
      text: string;
      color?: string;
      fileUrl?: string;
      fileType?: string;
      fileName?: string;
      fileSize?: number;
      replyTo?: Message["replyTo"];
      threadId?: string;
      mentions?: string[];
      /** Overrides the server-assigned author (kept for display-name parity). */
      author?: string;
      authorId?: string;
      sessionId?: string;
      timestamp?: string;
      reactions?: Record<string, string[]>;
    }
  ) {
    return request<{ id: string }>(`/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify(msg),
    });
  },
  getMessage(id: string) {
    return request<Message>(`/messages/${id}`);
  },
  getThreadReplies(threadId: string) {
    return request<{ messages: Message[] }>(`/threads/${threadId}`);
  },
  editMessage(id: string, text: string) {
    return request<{ ok: boolean }>(`/messages/${id}`, { method: "PATCH", body: JSON.stringify({ text }) });
  },
  deleteMessage(id: string) {
    return request<{ ok: boolean }>(`/messages/${id}`, { method: "DELETE" });
  },
  togglePin(id: string) {
    return request<{ ok: boolean }>(`/messages/${id}/pin`, { method: "POST" });
  },
  setReactions(id: string, reactions: Record<string, string[]>) {
    return request<{ ok: boolean }>(`/messages/${id}/reactions`, {
      method: "PUT",
      body: JSON.stringify({ reactions }),
    });
  },

  // ── DMs ──
  listDMChannels() {
    return request<DMChannel[]>("/dm-channels");
  },
  createDMChannel(participantId: string) {
    return request<{ id: string }>("/dm-channels", {
      method: "POST",
      body: JSON.stringify({ participantId }),
    });
  },

  // ── presence / typing ──
  setPresence(displayName: string, color: string) {
    return request<{ ok: boolean }>("/presence", {
      method: "POST",
      body: JSON.stringify({ displayName, color }),
    });
  },
  listPresence() {
    return request<User[]>("/presence");
  },
  setTyping(channelId: string, displayName: string) {
    return request<{ ok: boolean }>("/typing", {
      method: "POST",
      body: JSON.stringify({ channelId, displayName }),
    });
  },
  clearTyping(channelId: string) {
    return request<{ ok: boolean }>(`/typing?channelId=${encodeURIComponent(channelId)}`, {
      method: "DELETE",
    });
  },
  listTyping(channelId: string) {
    return request<{ name: string; sessionId: string; channelId: string }[]>(
      `/typing?channelId=${encodeURIComponent(channelId)}`
    );
  },

  // ── profiles ──
  getProfile(sessionId: string) {
    return request<{ name: string; avatar: string; color: string; githubUsername?: string; bio?: string } | null>(
      `/profiles/${sessionId}`
    );
  },
  saveProfile(data: { name?: string; avatar?: string; color?: string }) {
    return request<{ ok: boolean }>("/profiles", { method: "PUT", body: JSON.stringify(data) });
  },

  // ── stats ──
  getStats(sessionId: string) {
    return request<UserStats>(`/stats/${sessionId}`);
  },
  awardXP(amount: number, reason: string) {
    return request<{ ok: boolean; xp: number; level: number }>("/stats/xp", {
      method: "POST",
      body: JSON.stringify({ amount, reason }),
    });
  },

  // ── call log ──
  getCallLog(limit = 50) {
    return request<CallLogEntry[]>(`/call-log?limit=${limit}`);
  },
  createCallLog(entry: {
    id?: string;
    callerId?: string;
    calleeId?: string;
    callerName?: string;
    calleeName?: string;
    video?: boolean;
    status?: string;
    startedAt?: string;
    endedAt?: string | null;
    durationMs?: number | null;
  }) {
    return request<{ id: string }>("/call-log", { method: "POST", body: JSON.stringify(entry) });
  },

  // ── boardroom ──
  listBoardPosts(category?: string) {
    return request<BoardPost[]>(`/board-posts${category && category !== "all" ? `?category=${encodeURIComponent(category)}` : ""}`);
  },
  createBoardPost(post: {
    title: string;
    body: string;
    category: string;
    authorName: string;
    authorAvatar?: string;
    authorColor?: string;
  }) {
    return request<{ id: string }>("/board-posts", { method: "POST", body: JSON.stringify(post) });
  },
  voteBoardPost(id: string) {
    return request<{ ok: boolean }>(`/board-posts/${id}/vote`, { method: "POST" });
  },
  unvoteBoardPost(id: string) {
    return request<{ ok: boolean }>(`/board-posts/${id}/vote`, { method: "DELETE" });
  },
  getMyBoardVotes() {
    return request<{ votes: Record<string, number> }>("/board-posts/mine-votes");
  },

  // ── notification settings ──
  getNotificationSettings() {
    return request<NotificationSettings>("/notification-settings");
  },
  saveNotificationSettings(settings: NotificationSettings) {
    return request<{ ok: boolean }>("/notification-settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },

  // ── notifications ──
  queuePushNotification(userId: string, title: string, body: string, data?: Record<string, string>) {
    return request<{ ok: boolean }>("/notifications/queue", {
      method: "POST",
      body: JSON.stringify({ userId, title, body, data }),
    });
  },

  // ── uploads (R2) ──
  async upload(file: File, kind: string): Promise<string> {
    if (!API_BASE_URL) throw new ApiError("api_not_configured", 0);
    const res = await fetch(`${API_BASE_URL}/upload?kind=${encodeURIComponent(kind)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken() || ""}`,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });
    if (!res.ok) throw new ApiError("upload_failed", res.status);
    const data = (await res.json()) as { url: string };
    return data.url;
  },
};

export interface AuthUser {
  uid: string;
  email: string;
  fullName: string;
  avatarUrl: string;
  githubUsername: string;
  emailConfirmedAt: string | null;
}

export interface BoardPost {
  id: string;
  title: string;
  body: string;
  category: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorColor: string;
  voteCount: number;
  createdAt: string;
}

export interface NotificationSettings {
  pushEnabled: boolean;
  soundEnabled: boolean;
  messageSound: string;
  callRingtone: string;
  dndEnabled: boolean;
  dndDays: string[];
  dndStart: string;
  dndEnd: string;
}
