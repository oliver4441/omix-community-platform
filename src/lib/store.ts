/**
 * Omix Store — backward-compatible facade over the domain services layer.
 *
 * Architecture (P0 refactor):
 *   src/lib/services/events.ts          typed pub/sub bus
 *   src/lib/services/subscriptions.ts   refcounted, visibility/offline-aware polls
 *   src/lib/services/connection.ts      online/offline/reconnecting state
 *   src/lib/services/permissions.ts     client RBAC mirror
 *   src/lib/services/storage.ts         IndexedDB + localStorage
 *   src/lib/services/outbox.ts          offline message queue + drafts
 *   src/lib/services/media.ts           uploads with progress + validation
 *   src/lib/services/notifications.ts   notification center client
 *   src/lib/services/search.ts          global search client
 *   src/lib/services/moderation.ts      reports / actions / audit client
 *
 * Every method signature that existed before this refactor is preserved, so
 * existing components keep working unchanged. New capabilities (offline
 * outbox, drafts, error states, search/moderation/notifications) are added on
 * top.
 */
import { api, getUserId } from "@/lib/api";
import { getRoom, getRoomId, isAblyConnected, onAblyConnectionState, releaseRoom } from "@/lib/ably";
import type { Message as AblyMessage, JsonObject } from "@ably/chat";
import type {
  Message,
  Channel,
  Server,
  User,
  UnreadCounts,
  TypingUser,
  DMChannel,
  UserStats,
  CallLogEntry,
} from "@/lib/types";
import { pollRef, flushPoll } from "@/lib/services/subscriptions";
import {
  isOnline,
  onConnectionStatusChange,
  initConnectionService,
  getConnectionStatus,
} from "@/lib/services/connection";
import { subscribe as busSubscribe } from "@/lib/services/events";
import * as outbox from "@/lib/services/outbox";
import * as notifService from "@/lib/services/notifications";
import * as searchService from "@/lib/services/search";
import { moderationService } from "@/lib/services/moderation";
import { validateUpload, uploadWithProgress, type UploadProgress } from "@/lib/services/media";
import { idb, lsGet, lsSet } from "@/lib/services/storage";
import { hasCapability, normalizeRole, type Capability, type ServerRole } from "@/lib/services/permissions";

const FALLBACK_SESSION_ID = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
const TYPING_TIMEOUT = 3000;
const PAGE_SIZE = 50;
const POLL_MS = 10000;

function getSessionId(): string {
  if (typeof window !== "undefined") {
    try {
      const uid = getUserId();
      if (uid) return uid;
    } catch {
      /* ignore */
    }
  }
  return FALLBACK_SESSION_ID;
}

const USER_COLORS = [
  "#8B5CF6", "#3B82F6", "#22C55E", "#F59E0B", "#EF4444",
  "#EC4899", "#06B6D4", "#A855F7", "#10B981", "#F97316",
];

function getUserColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

function toDate(val: unknown): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return new Date(String(val));
}

function toServer(d: Server): Server {
  return {
    ...d,
    icon: d.icon || "",
    description: d.description || undefined,
    privacy: d.privacy || "private",
    memberCount: d.memberCount || 1,
    ownerId: d.ownerId || "",
    createdAt: toDate(d.createdAt),
  };
}

function toChannel(c: Channel): Channel {
  return {
    ...c,
    category: c.category || "Text Channels",
    type: c.type || "text",
    topic: c.topic || "",
    icon: c.icon || "",
    createdAt: toDate(c.createdAt),
  };
}

function toMessage(m: Message): Message {
  return {
    ...m,
    timestamp: toDate(m.timestamp),
    reactions: m.reactions || {},
    editedAt: m.editedAt ? toDate(m.editedAt) : undefined,
    pinnedAt: m.pinnedAt ? toDate(m.pinnedAt) : undefined,
    fileUrl: m.fileUrl || undefined,
    fileType: m.fileType || undefined,
    fileName: m.fileName || undefined,
    replyTo: m.replyTo || undefined,
    threadId: m.threadId || undefined,
    mentions: m.mentions || undefined,
  };
}

function toDM(d: DMChannel): DMChannel {
  return {
    ...d,
    createdAt: toDate(d.createdAt),
    lastMessageAt: d.lastMessageAt ? toDate(d.lastMessageAt) : undefined,
  };
}

function ablyToMessage(chat: AblyMessage): Message {
  const md = (chat.metadata || {}) as Record<string, unknown>;
  return {
    id: (md.osId as string) || chat.serial,
    channelId: (md.channelId as string) || "",
    author: (md.author as string) || "Anonymous",
    authorId: (md.authorId as string) || "",
    sessionId: chat.clientId || (md.sessionId as string) || "",
    text: chat.text || "",
    color: (md.color as string) || "#8B5CF6",
    timestamp: chat.timestamp || new Date(),
    reactions: {},
    fileUrl: (md.fileUrl as string) || undefined,
    fileType: (md.fileType as string) || undefined,
    fileName: (md.fileName as string) || undefined,
    fileSize: (md.fileSize as number) || undefined,
    replyTo: md.replyTo as Message["replyTo"],
    threadId: (md.threadId as string) || undefined,
    mentions: (md.mentions as string[]) || undefined,
  };
}

type Listener = () => void;

interface StoreState {
  servers: Server[];
  channels: Channel[];
  dmChannels: DMChannel[];
  messages: Message[];
  pinnedMessages: Message[];
  typingUsers: TypingUser[];
  onlineUsers: User[];
  currentServerId: string;
  currentChannelId: string;
  currentChannelType: "channel" | "dm";
  currentDMChannelName: string;
  isAdmin: boolean;
  displayName: string;
  /** Channel/server-scoped subscriptions — torn down by cleanup() on switches. */
  listeners: Listener[];
  /** Global subscriptions (servers, DMs, stats…) — survive channel switches. */
  globalListeners: Listener[];
  typingListeners: Listener[];
  presenceListeners: Listener[];
  pinListeners: Listener[];
  dmListeners: Listener[];
  dmChannelIds: Set<string>;
  unreadCounts: UnreadCounts;
  messagePagination: Map<
    string,
    { oldestTimestamp: number | null; hasMore: boolean; loading: boolean }
  >;
}

const state: StoreState = {
  servers: [],
  channels: [],
  dmChannels: [],
  messages: [],
  pinnedMessages: [],
  typingUsers: [],
  onlineUsers: [],
  currentServerId: lsGet("os_server") || "server1",
  currentChannelId: lsGet("os_channel") || "channel1",
  currentChannelType: "channel",
  currentDMChannelName: "",
  isAdmin: lsGet("os_admin") === "true",
  displayName: lsGet("os_username") || "",
  listeners: [],
  globalListeners: [],
  typingListeners: [],
  presenceListeners: [],
  pinListeners: [],
  dmListeners: [],
  dmChannelIds: new Set<string>(),
  unreadCounts: {},
  messagePagination: new Map(),
};

try {
  state.unreadCounts = JSON.parse(lsGet("os_unread") || "{}");
} catch {
  state.unreadCounts = {};
}

// ── Legacy string-topic emitter (Store.on/off compatibility) ──
const callbacks: Map<string, Set<(type: string, data: unknown) => void>> = new Map();

function notify(type: string, data: unknown) {
  callbacks.get(type)?.forEach((cb) => cb(type, data));
}

function subscribe(type: string, cb: (type: string, data: unknown) => void) {
  if (!callbacks.has(type)) callbacks.set(type, new Set());
  callbacks.get(type)!.add(cb);
  return () => callbacks.get(type)?.delete(cb);
}

function cleanupError(err: unknown) {
  // Keep polling loops silent; real errors surface through status notifications.
  console.debug("[store] background fetch failed:", err);
}

// ── Message subscriptions (refcounted per channel) ──
interface MessageSub {
  count: number;
  cb: ((type: string, data: Message[]) => void) | null;
  teardown: () => void;
  fetch: () => Promise<void>;
  status: "loading" | "ready" | "error";
}

const messageSubs = new Map<string, MessageSub>();

const MESSAGE_CACHE_PREFIX = "messages:";

async function cacheChannelMessages(channelId: string, messages: Message[]) {
  await idb.put("cache", MESSAGE_CACHE_PREFIX + channelId, messages.slice(0, 100));
}

async function readCachedMessages(channelId: string): Promise<Message[]> {
  const raw = await idb.get<unknown[]>("cache", MESSAGE_CACHE_PREFIX + channelId);
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => toMessage(m as Message));
}

/** Merge queued offline outbox entries as pending messages at the tail. */
async function mergePendingMessages(channelId: string, messages: Message[]): Promise<Message[]> {
  const pending = await outbox.listForChannel(channelId);
  if (pending.length === 0) return messages;
  const pendingMessages: Message[] = pending.map((entry) => {
    const payload = entry.payload;
    return {
      id: entry.nonce,
      channelId,
      author: (payload.author as string) || "You",
      authorId: getSessionId(),
      sessionId: getSessionId(),
      text: (payload.text as string) || "",
      color: (payload.color as string) || "#8B5CF6",
      timestamp: new Date(entry.queuedAt),
      reactions: {},
      fileUrl: (payload.fileUrl as string) || undefined,
      fileType: (payload.fileType as string) || undefined,
      fileName: (payload.fileName as string) || undefined,
      fileSize: (payload.fileSize as number) || undefined,
      replyTo: payload.replyTo as Message["replyTo"],
      threadId: (payload.threadId as string) || undefined,
      mentions: (payload.mentions as string[]) || undefined,
      pending: true,
    } as Message & { pending?: boolean };
  });
  const seen = new Set(messages.map((m) => m.id));
  return [...messages, ...pendingMessages.filter((m) => !seen.has(m.id))];
}

async function replayOutbox(): Promise<void> {
  const entries = await outbox.list();
  for (const entry of entries) {
    try {
      const { id } = await api.sendMessage(entry.channelId, entry.payload as Parameters<typeof api.sendMessage>[1]);
      if (id) {
        await outbox.remove(entry.nonce);
        // Replace the pending bubble with the real message via Ably.
        Store.publishMessage(entry.channelId, { ...entry.payload, id });
        const sub = messageSubs.get(entry.channelId);
        if (sub) {
          await sub.fetch();
        }
      }
    } catch (err) {
      const code = (err as { code?: string; status?: number })?.code;
      const status = (err as { status?: number })?.status;
      // Permanent rejection (validation/auth) → drop; network issues → retry later.
      if (status && status >= 400 && status < 500) {
        await outbox.remove(entry.nonce);
      } else if (!code || code === "api_not_configured" || status === 0 || status === undefined) {
        await outbox.bumpAttempts(entry.nonce);
      }
    }
  }
}

// Wire outbox replay to connectivity restoration (once).
busSubscribe("connection:restored", () => {
  void replayOutbox();
});

function uploadToStorage(file: File, kind: string): Promise<string> {
  return api.upload(file, kind);
}

export const Store = {
  get servers() { return state.servers; },
  get channels() { return state.channels; },
  get messages() { return state.messages; },
  get pinnedMessages() { return state.pinnedMessages; },
  get typingUsers() { return state.typingUsers; },
  get onlineUsers() { return state.onlineUsers; },
  get currentServerId() { return state.currentServerId; },
  set currentServerId(v: string) { state.currentServerId = v; lsSet("os_server", v); },
  get currentChannelId() { return state.currentChannelId; },
  set currentChannelId(v: string) { state.currentChannelId = v; lsSet("os_channel", v); },
  get currentChannelType() { return state.currentChannelType; },
  set currentChannelType(v: "channel" | "dm") { state.currentChannelType = v; },
  get currentDMChannelName() { return state.currentDMChannelName; },
  set currentDMChannelName(v: string) { state.currentDMChannelName = v; },
  get isAdmin() { return state.isAdmin; },
  set isAdmin(v: boolean) { state.isAdmin = v; lsSet("os_admin", v ? "true" : ""); },
  /** Sync the server-computed admin flag from useAuth. */
  setAdmin(v: boolean) { state.isAdmin = v; lsSet("os_admin", v ? "true" : ""); },
  get displayName() { return state.displayName; },
  set displayName(v: string) { state.displayName = v; lsSet("os_username", v); },
  get unreadCounts() { return state.unreadCounts; },
  get sessionId() { return getSessionId(); },

  /** Live connection status (online / offline / reconnecting). */
  connectionStatus() {
    initConnectionService();
    return getConnectionStatus();
  },
  onConnectionChange(cb: (status: "online" | "offline" | "reconnecting") => void) {
    initConnectionService();
    return onConnectionStatusChange(cb);
  },
  get isOffline() { return !isOnline(); },

  // === DM CHANNELS ===
  get dmChannels() { return state.dmChannels; },

  subscribeDMChannels(cb: (dms: DMChannel[]) => void) {
    const refresh = () => {
      api
        .listDMChannels()
        .then((data) => {
          state.dmChannels = data.map(toDM);
          state.dmChannelIds = new Set(data.map((d) => d.id));
          state.dmChannels.forEach((dm) => {
            if (dm.id === state.currentChannelId) return;
            if (!dm.lastMessageAt) return;
            const lastMsgTime = toDate(dm.lastMessageAt).getTime();
            const lastRead = parseInt(lsGet(`os_read_${dm.id}`) || "0", 10);
            if (lastMsgTime > lastRead) {
              state.unreadCounts[dm.id] = Math.max(state.unreadCounts[dm.id] || 0, 1);
            }
          });
          this.saveUnread();
          notify("dmChannels", state.dmChannels);
          cb(state.dmChannels);
        })
        .catch(cleanupError);
    };
    // Refcounted — DMSidebar and any future consumers share one poll. Lives in
    // globalListeners: DM polling must survive channel switches (cleanup() is
    // called on every channelChanged event — registering in listeners froze
    // the DM list).
    const unsub = pollRef("dms", refresh, POLL_MS);
    state.dmListeners.push(unsub);
    state.globalListeners.push(unsub);
    return unsub;
  },

  cleanupDMChannels() {
    state.dmListeners.forEach((u) => u());
    state.dmListeners = [];
  },

  async createOrGetDMChannel(otherUserId: string): Promise<string> {
    const currentUserId = getSessionId();
    if (currentUserId === otherUserId) throw new Error("Cannot create DM with yourself");
    const { id } = await api.createDMChannel(otherUserId);
    return id;
  },

  // === ADMIN ===
  async verifyAdminPassword(password: string): Promise<boolean> {
    try {
      const { valid } = await api.verifyAdminPassword(password);
      return valid;
    } catch {
      try {
        const stored = lsGet("os_admin_password");
        if (stored === null) {
          lsSet("os_admin_password", password);
          return true;
        }
        return stored === password;
      } catch {
        return false;
      }
    }
  },

  // === SERVERS ===
  subscribeServers(cb: (type: string, data: Server[]) => void) {
    const refresh = () => {
      api
        .listServers()
        .then((data) => {
          state.servers = data.map(toServer);
          notify("servers", state.servers);
          cb("servers", state.servers);
        })
        .catch(cleanupError);
    };
    // Global subscription — lives in globalListeners so channel switches
    // (cleanup()) don't freeze the workspace list.
    const unsub = pollRef("servers", refresh, POLL_MS);
    state.globalListeners.push(unsub);
    return unsub;
  },

  async createServer(
    name: string,
    opts: { description?: string; privacy?: "public" | "private" } = {}
  ): Promise<string> {
    const { id } = await api.createServer({
      name: name.trim(),
      description: (opts.description || "").trim() || undefined,
      privacy: opts.privacy || "private",
    });
    flushPoll("servers");
    return id;
  },

  async deleteServer(serverId: string): Promise<void> {
    await api.deleteServer(serverId);
    flushPoll("servers");
  },

  async updateServer(
    serverId: string,
    data: {
      name?: string;
      icon?: string;
      description?: string;
      privacy?: "public" | "private";
    }
  ): Promise<void> {
    await api.updateServer(serverId, data);
    flushPoll("servers");
  },

  async uploadServerIcon(file: File, serverId: string): Promise<string> {
    validateUpload(file, "icons");
    const fileUrl = await uploadToStorage(file, "icons");
    await this.updateServer(serverId, { icon: fileUrl });
    return fileUrl;
  },

  async getServer(serverId: string): Promise<Server | null> {
    try {
      const data = await api.getServer(serverId);
      return data ? toServer(data) : null;
    } catch {
      return null;
    }
  },

  /** Public boardrooms for the workspace-discovery browse grid (stitch 20). */
  async listPublicServers(): Promise<Server[]> {
    try {
      const data = await api.listPublicServers();
      return data.map(toServer);
    } catch {
      return [];
    }
  },

  // === INVITES ===
  async createInvite(serverId: string): Promise<string> {
    const { code } = await api.createInvite(serverId);
    return code;
  },

  async joinServerByInvite(code: string): Promise<string | null> {
    try {
      const { serverId } = await api.joinServerByInvite(code);
      flushPoll("servers");
      return serverId;
    } catch {
      return null;
    }
  },

  // === CHANNELS ===
  subscribeChannels(serverId: string, cb: (type: string, data: Channel[]) => void) {
    this.cleanupTyping();
    this.cleanupPresence();
    this.cleanupPins();

    const refresh = () => {
      api
        .listChannels(serverId)
        .then((data) => {
          state.channels = data.map(toChannel);
          notify("channels", state.channels);
          cb("channels", state.channels);
        })
        .catch(cleanupError);
    };
    const unsub = pollRef(`channels:${serverId}`, refresh, POLL_MS);
    state.listeners.push(unsub);
    return unsub;
  },

  async createChannel(
    serverId: string,
    name: string,
    category = "Text Channels",
    icon?: string
  ): Promise<string> {
    const { id } = await api.createChannel(serverId, { name, category, icon });
    state.currentChannelId = id;
    lsSet("os_channel", id);
    flushPoll(`channels:${serverId}`);
    return id;
  },

  async uploadChannelIcon(file: File, channelId: string): Promise<string> {
    validateUpload(file, "channel-icons");
    const fileUrl = await uploadToStorage(file, "channel-icons");
    await api.updateChannel(channelId, { icon: fileUrl });
    return fileUrl;
  },

  async deleteChannel(channelId: string): Promise<void> {
    await api.deleteChannel(channelId);
  },

  // === MESSAGES ===
  subscribeMessages(channelId: string, cb: (type: string, data: Message[]) => void) {
    this.cleanupTyping();

    if (!state.messagePagination.has(channelId)) {
      state.messagePagination.set(channelId, {
        oldestTimestamp: null,
        hasMore: true,
        loading: false,
      });
    }

    const makeUnsub = () => {
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        const sub = messageSubs.get(channelId);
        if (sub) {
          sub.count -= 1;
          if (sub.count <= 0) {
            sub.teardown();
            messageSubs.delete(channelId);
          }
        }
      };
    };

    const existing = messageSubs.get(channelId);
    if (existing) {
      existing.count += 1;
      existing.cb = cb;
      const unsub = makeUnsub();
      state.listeners.push(unsub);
      return unsub;
    }

    const setStatus = (status: "loading" | "ready" | "error") => {
      const sub = messageSubs.get(channelId);
      if (sub) sub.status = status;
      notify("messagesStatus", { channelId, status });
    };

    const fetchLatest = async () => {
      try {
        const { messages } = await api.getMessages(channelId, { limit: PAGE_SIZE });
        const docs = messages.map(toMessage).filter((m) => !m.pinned);
        const merged = await mergePendingMessages(channelId, docs);
        state.messages = merged;
        const pagination = state.messagePagination.get(channelId);
        if (pagination && docs.length > 0) {
          pagination.oldestTimestamp = toDate(docs[0].timestamp).getTime();
          pagination.hasMore = docs.length === PAGE_SIZE;
        }
        setStatus("ready");
        await cacheChannelMessages(channelId, docs);
        notify("messages", state.messages);
        cb("messages", state.messages);
      } catch (err) {
        setStatus("error");
        cleanupError(err);
      }
    };

    // Replay the offline cache first so the UI renders instantly.
    setStatus("loading");
    readCachedMessages(channelId)
      .then(async (cached) => {
        if (cached.length > 0 && state.messages.length === 0) {
          state.messages = await mergePendingMessages(channelId, cached);
          notify("messages", state.messages);
          cb("messages", state.messages);
        }
        await fetchLatest();
      })
      .catch(() => {
        void fetchLatest();
      });

    // Ably realtime for live messages.
    const roomId = getRoomId(channelId, state.dmChannelIds.has(channelId));
    let unsubAbly = () => {};
    if (typeof window !== "undefined") {
      getRoom(roomId)
        .then((room) => {
          const sub = room.messages.subscribe((event) => {
            if (event.type !== "message.created") return;
            const msg = ablyToMessage(event.message);
            if (msg.id && state.messages.some((m) => m.id === msg.id)) return;
            if (msg.channelId && msg.channelId !== channelId) return;
            state.messages = [...state.messages, msg].sort(
              (a, b) => toDate(a.timestamp).getTime() - toDate(b.timestamp).getTime()
            );
            notify("messages", state.messages);
            cb("messages", state.messages);
          });
          unsubAbly = () => sub.unsubscribe();
        })
        .catch(() => {});
    }

    // Slow polling fallback when Ably isn't connected.
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const startFallback = () => {
      if (pollTimer || isAblyConnected()) return;
      pollTimer = setInterval(fetchLatest, 15000);
    };
    startFallback();
    const offConn = onAblyConnectionState((connected) => {
      if (connected && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
        void fetchLatest();
      } else if (!connected) {
        startFallback();
      }
    });

    const sub: MessageSub = {
      count: 1,
      cb,
      status: "loading",
      fetch: fetchLatest,
      teardown: () => {
        unsubAbly();
        offConn();
        if (pollTimer) clearInterval(pollTimer);
        releaseRoom(roomId);
      },
    };
    messageSubs.set(channelId, sub);

    const unsub = makeUnsub();
    state.listeners.push(unsub);
    return unsub;
  },

  getMessageStatus(channelId: string): "loading" | "ready" | "error" {
    return messageSubs.get(channelId)?.status || "loading";
  },

  retryMessages(channelId: string): void {
    const sub = messageSubs.get(channelId);
    if (sub) {
      sub.status = "loading";
      notify("messagesStatus", { channelId, status: "loading" });
      void sub.fetch();
    }
  },

  async loadMoreMessages(channelId: string): Promise<Message[]> {
    const pagination = state.messagePagination.get(channelId);
    if (!pagination || !pagination.hasMore || pagination.loading) return [];

    pagination.loading = true;
    try {
      const cutoff = new Date(pagination.oldestTimestamp!).toISOString();
      const { messages } = await api.getMessages(channelId, {
        before: cutoff,
        limit: PAGE_SIZE,
      });
      if (messages.length > 0) {
        const olderMessages = messages.map(toMessage).filter((m) => !m.pinned);
        state.messages = [...olderMessages, ...state.messages];
        pagination.oldestTimestamp = toDate(olderMessages[0].timestamp).getTime();
        pagination.hasMore = olderMessages.length === PAGE_SIZE;
        notify("messages", state.messages);
        return olderMessages;
      }
      pagination.hasMore = false;
      return [];
    } finally {
      pagination.loading = false;
    }
  },

  getPaginationState(channelId: string) {
    return (
      state.messagePagination.get(channelId) || {
        oldestTimestamp: null,
        hasMore: false,
        loading: false,
      }
    );
  },

  subscribeThread(threadId: string, cb: (type: string, data: Message[]) => void) {
    const refresh = () => {
      api
        .getThreadReplies(threadId)
        .then(({ messages }) => {
          cb("thread", messages.map(toMessage));
        })
        .catch(cleanupError);
    };
    const unsub = pollRef(`thread:${threadId}`, refresh, 5000);
    state.globalListeners.push(unsub);
    return unsub;
  },

  getMessageThreadCount(messageId: string, messages: Message[]): number {
    return messages.filter((m) => m.threadId === messageId).length;
  },

  async sendMessage(
    channelId: string,
    text: string,
    displayName: string,
    opts: {
      fileUrl?: string;
      fileType?: string;
      fileName?: string;
      fileSize?: number;
      replyTo?: Message["replyTo"];
      mentions?: string[];
      threadId?: string;
    } = {}
  ): Promise<void> {
    if (!text.trim() && !opts.fileUrl) return;

    const msg: Parameters<typeof api.sendMessage>[1] = {
      text: text.trim(),
      color: getUserColor(displayName),
      author: displayName || "Anonymous",
      timestamp: new Date().toISOString(),
      reactions: {},
    };

    if (opts.fileUrl) {
      msg.fileUrl = opts.fileUrl;
      msg.fileType = opts.fileType || "image";
      if (opts.fileName) msg.fileName = opts.fileName;
      if (opts.fileSize) msg.fileSize = opts.fileSize;
    }
    if (opts.replyTo) msg.replyTo = opts.replyTo;
    if (opts.mentions) msg.mentions = opts.mentions;
    if (opts.threadId) msg.threadId = opts.threadId;

    const nonce = outbox.createNonce();
    const payload: Record<string, unknown> = { ...msg, nonce };

    try {
      const { id } = await api.sendMessage(channelId, { ...msg, nonce });
      if (id) {
        this.publishMessage(channelId, { ...payload, id });
      }
    } catch (err) {
      // Network failure → queue for replay once connectivity returns.
      const status = (err as { status?: number; code?: string })?.status;
      const code = (err as { code?: string })?.code;
      if (!status || status === 0 || status >= 500 || code === "api_not_configured") {
        await outbox.enqueue(channelId, payload);
        const sub = messageSubs.get(channelId);
        if (sub?.cb) {
          const merged = await mergePendingMessages(channelId, state.messages);
          state.messages = merged;
          notify("messages", state.messages);
          sub.cb("messages", state.messages);
        }
        return; // keep the queued message visible; no throw (UX continuity)
      }
      throw err; // permanent rejection (403/429/4xx validation) — surface it
    }

    if (channelId !== state.currentChannelId) {
      this.incrementUnread(channelId);
    }

    this.awardXP(10, "message").catch(() => {});
  },

  publishMessage(channelId: string, row: Record<string, unknown>): void {
    if (typeof window === "undefined") return;
    const roomId = getRoomId(channelId, state.dmChannelIds.has(channelId));
    const metadata: Record<string, unknown> = {
      osId: row.id,
      channelId,
      author: row.author,
      authorId: row.author_id || row.authorId,
      sessionId: row.session_id || row.sessionId || getSessionId(),
      color: row.color,
      timestamp: row.timestamp,
      fileUrl: row.file_url || row.fileUrl,
      fileType: row.file_type || row.fileType,
      fileName: row.file_name || row.fileName,
      fileSize: row.file_size || row.fileSize,
      replyTo: row.reply_to || row.replyTo,
      threadId: row.thread_id || row.threadId,
      mentions: row.mentions,
    };
    getRoom(roomId)
      .then((room) =>
        room.messages.send({
          text: (row.text as string) || "",
          metadata: metadata as unknown as JsonObject,
        })
      )
      .catch((err) => {
        console.warn("[ably] publish failed — relying on polling", err);
      });
  },

  async editMessage(messageId: string, newText: string): Promise<void> {
    await api.editMessage(messageId, newText.trim());
  },

  async deleteMessage(messageId: string): Promise<void> {
    await api.deleteMessage(messageId);
  },

  // === PINS ===
  async togglePin(messageId: string): Promise<void> {
    await api.togglePin(messageId);
  },

  subscribePins(channelId: string, cb: (pins: Message[]) => void) {
    const refresh = () => {
      api
        .getMessages(channelId, { pinned: true })
        .then(({ messages }) => {
          const pins = messages.map(toMessage);
          state.pinnedMessages = pins;
          notify("pins", pins);
          cb(pins);
        })
        .catch(cleanupError);
    };
    const unsub = pollRef(`pins:${channelId}`, refresh, POLL_MS);
    state.pinListeners.push(unsub);
    return unsub;
  },

  cleanupPins() {
    state.pinListeners.forEach((u) => u());
    state.pinListeners = [];
  },

  // === REACTIONS ===
  async toggleReaction(messageId: string, emoji: string, displayName: string): Promise<void> {
    const msg = await api.getMessage(messageId);
    const reactions = msg.reactions || {};
    const users = [...(reactions[emoji] || [])];
    const idx = users.indexOf(displayName);

    if (idx > -1) {
      users.splice(idx, 1);
      if (users.length === 0) delete reactions[emoji];
      else reactions[emoji] = users;
    } else {
      users.push(displayName);
      reactions[emoji] = users;
    }

    await api.setReactions(messageId, reactions);

    // Keep local state in sync (server will reconcile on next fetch).
    state.messages = state.messages.map((m) =>
      m.id === messageId ? { ...m, reactions } : m
    );
    notify("messages", state.messages);
  },

  // === TYPING ===
  startTyping(channelId: string, displayName: string): void {
    if (!channelId || !displayName) return;
    if (isAblyConnected()) {
      const roomId = getRoomId(channelId, state.dmChannelIds.has(channelId));
      getRoom(roomId)
        .then((room) => room.typing.keystroke())
        .catch(() => {});
      return;
    }
    api
      .setTyping(channelId, displayName)
      .then(() => {
        setTimeout(() => {
          api.clearTyping(channelId).catch(() => {});
        }, TYPING_TIMEOUT);
      })
      .catch(() => {});
  },

  stopTyping(channelId: string): void {
    if (!channelId) return;
    if (isAblyConnected()) {
      const roomId = getRoomId(channelId, state.dmChannelIds.has(channelId));
      getRoom(roomId)
        .then((room) => room.typing.stop())
        .catch(() => {});
      return;
    }
    api.clearTyping(channelId).catch(() => {});
  },

  subscribeTyping(channelId: string, cb: (users: TypingUser[]) => void) {
    if (!channelId) return () => {};

    const roomId = getRoomId(channelId, state.dmChannelIds.has(channelId));
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let ablyUnsub: (() => void) | null = null;
    let disposed = false;

    const setupPoll = () => {
      if (pollTimer || disposed) return;
      const refresh = () => {
        api
          .listTyping(channelId)
          .then((rows) => {
            const users = rows
              .filter((u) => u.sessionId !== getSessionId() && u.name)
              .map((u) => ({ name: u.name, sessionId: u.sessionId, channelId: u.channelId }));
            state.typingUsers = users;
            cb(users);
          })
          .catch(() => {});
      };
      refresh();
      pollTimer = setInterval(refresh, 3000);
    };

    const setupAbly = () => {
      if (ablyUnsub || disposed) return;
      getRoom(roomId)
        .then((room) => {
          if (disposed) return;
          const sub = room.typing.subscribe((event) => {
            if (disposed) return;
            const members = (event.currentTypers || []).filter(
              (m) => m.clientId && m.clientId !== getSessionId()
            );
            Promise.all(
              members.map(async (m) => {
                let name = m.clientId;
                try {
                  const profile = await this.getProfile(m.clientId);
                  if (profile?.name) name = profile.name;
                } catch {
                  /* ignore */
                }
                return { name, sessionId: m.clientId, channelId } as TypingUser;
              })
            ).then((users) => {
              state.typingUsers = users;
              cb(users);
            });
          });
          ablyUnsub = () => sub.unsubscribe();
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
        })
        .catch(() => {});
    };

    setupPoll();
    if (typeof window !== "undefined") {
      onAblyConnectionState((connected) => {
        if (connected) setupAbly();
      });
    }

    const unsub = () => {
      disposed = true;
      if (ablyUnsub) ablyUnsub();
      if (pollTimer) clearInterval(pollTimer);
    };
    state.typingListeners.push(unsub);
    return unsub;
  },

  cleanupTyping() {
    state.typingListeners.forEach((u) => u());
    state.typingListeners = [];
  },

  // === PRESENCE ===
  presenceInterval: null as ReturnType<typeof setInterval> | null,

  async setPresence(displayName: string): Promise<void> {
    const color = getUserColor(displayName);
    const beat = () => api.setPresence(displayName, color).catch(() => {});

    await beat();
    // Track the interval so cleanup() can stop it (previous code leaked this).
    if (!this.presenceInterval) {
      this.presenceInterval = setInterval(beat, 30000);
    }

    const enterAbly = () => {
      getRoom("presence-main")
        .then((room) => room.presence.enter({ name: displayName, color, online: true }))
        .catch(() => {});
    };
    const leaveAbly = () => {
      getRoom("presence-main")
        .then((room) => room.presence.leave())
        .catch(() => {});
    };
    const updateAbly = (online: boolean) => {
      getRoom("presence-main")
        .then((room) => room.presence.update({ name: displayName, color, online }))
        .catch(() => {});
    };

    if (typeof window !== "undefined") {
      onAblyConnectionState((connected) => {
        if (connected) enterAbly();
      });
      window.addEventListener("beforeunload", () => {
        beat();
        leaveAbly();
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          beat();
          updateAbly(false);
        } else {
          beat();
          updateAbly(true);
        }
      });
    }
  },

  subscribePresence(cb: (users: User[]) => void) {
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let ablyUnsub: (() => void) | null = null;
    let disposed = false;

    const refreshAbly = async () => {
      try {
        const room = await getRoom("presence-main");
        const members = await room.presence.get();
        if (disposed) return;
        const users = members
          .filter((m) => {
            const data = (m.data || {}) as Record<string, unknown>;
            return data.online !== false;
          })
          .map((m) => {
            const data = (m.data || {}) as Record<string, unknown>;
            return {
              name: (data.name as string) || m.clientId,
              id: m.clientId,
              color: (data.color as string) || "#8B5CF6",
            };
          }) as User[];
        state.onlineUsers = users;
        cb(users);
      } catch {
        /* ignore */
      }
    };

    const setupAbly = () => {
      if (ablyUnsub || disposed) return;
      getRoom("presence-main")
        .then((room) => {
          if (disposed) return;
          const sub = room.presence.subscribe((event) => {
            if (disposed) return;
            if (
              event.type === "present" ||
              event.type === "enter" ||
              event.type === "leave" ||
              event.type === "update"
            ) {
              refreshAbly();
            }
          });
          ablyUnsub = () => sub.unsubscribe();
          refreshAbly();
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
        })
        .catch(() => {});
    };

    const setupPoll = () => {
      if (pollTimer || disposed) return;
      const refresh = () => {
        api
          .listPresence()
          .then((data) => {
            if (disposed) return;
            const users = data.map((d) => ({
              name: d.name,
              id: d.id,
              color: d.color,
            })) as User[];
            state.onlineUsers = users;
            cb(users);
          })
          .catch(() => {});
      };
      refresh();
      pollTimer = setInterval(refresh, 15000);
    };

    setupPoll();
    if (typeof window !== "undefined") {
      onAblyConnectionState((connected) => {
        if (connected) setupAbly();
      });
    }

    const unsub = () => {
      disposed = true;
      if (ablyUnsub) ablyUnsub();
      if (pollTimer) clearInterval(pollTimer);
    };
    state.presenceListeners.push(unsub);
    return unsub;
  },

  cleanupPresence() {
    state.presenceListeners.forEach((u) => u());
    state.presenceListeners = [];
  },

  // === FILE UPLOAD ===
  async uploadFile(
    file: File,
    channelId: string,
    displayName: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    validateUpload(file, "uploads");
    const fileUrl = await uploadWithProgress(file, "uploads", onProgress);
    await this.sendMessage(channelId, "", displayName, {
      fileUrl,
      fileType: file.type,
      fileName: file.name,
      fileSize: file.size,
    });
  },

  // === UNREAD ===
  markChannelRead(channelId: string) {
    state.unreadCounts[channelId] = 0;
    this.saveUnread();
    try {
      lsSet(`os_read_${channelId}`, Date.now().toString());
    } catch {
      /* ignore */
    }
  },

  incrementUnread(channelId: string) {
    if (channelId === state.currentChannelId) return;
    state.unreadCounts[channelId] = (state.unreadCounts[channelId] || 0) + 1;
    this.saveUnread();
  },

  saveUnread() {
    try {
      lsSet("os_unread", JSON.stringify(state.unreadCounts));
    } catch {
      /* ignore */
    }
  },

  // === XP & BADGES ===
  getLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  },

  getBadgesForStats(stats: Partial<UserStats>): string[] {
    const badges: string[] = [];
    const msgs = stats.messagesSent || 0;
    const reactions = stats.reactionsReceived || 0;
    const replies = stats.repliesReceived || 0;
    const xp = stats.xp || 0;
    const level = this.getLevel(xp);

    if (msgs >= 1) badges.push("first_message");
    if (msgs >= 100) badges.push("chatter");
    if (reactions >= 10) badges.push("popular");
    if (replies >= 10) badges.push("helper");
    if (level >= 10) badges.push("veteran");
    if (((stats as Record<string, unknown>).streakCount as number) >= 3)
      badges.push("streak_3");
    return badges;
  },

  async getStats(sessionId?: string): Promise<UserStats> {
    const uid = sessionId || getSessionId();
    try {
      return await api.getStats(uid);
    } catch {
      return {
        xp: 0,
        level: 1,
        messagesSent: 0,
        reactionsReceived: 0,
        repliesReceived: 0,
        badges: [],
        joinDate: new Date().toISOString().split("T")[0],
      };
    }
  },

  subscribeStats(cb: (stats: UserStats) => void) {
    const uid = getSessionId();
    const refresh = () => {
      api
        .getStats(uid)
        .then((stats) => cb(stats))
        .catch(() => {});
    };
    const unsub = pollRef(`stats:${uid}`, refresh, POLL_MS);
    state.globalListeners.push(unsub);
    return unsub;
  },

  async awardXP(amount: number, reason: string): Promise<void> {
    await api.awardXP(amount, reason);
  },

  // === WEB PUSH ===
  async requestNotificationPermission(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window)) return false;
    if (Notification.permission === "denied") return false;
    if (Notification.permission === "granted") return true;
    const result = await Notification.requestPermission();
    return result === "granted";
  },

  async saveFCMToken(): Promise<string | null> {
    // FCM is out of scope on the Cloudflare stack — web push can be added later.
    return null;
  },

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<void> {
    await api.queuePushNotification(userId, title, body, data);
  },

  // === CALL LOG ===
  async getCallLog(limit = 50): Promise<CallLogEntry[]> {
    try {
      const rows = await api.getCallLog(limit);
      return rows.map((d) => ({
        ...d,
        startedAt: toDate(d.startedAt),
        endedAt: d.endedAt ? toDate(d.endedAt) : null,
      })) as CallLogEntry[];
    } catch {
      return [];
    }
  },

  subscribeCallLog(cb: (entries: CallLogEntry[]) => void) {
    const refresh = () => {
      this.getCallLog()
        .then((entries) => cb(entries))
        .catch(() => {});
    };
    const unsub = pollRef("call-log", refresh, POLL_MS);
    state.globalListeners.push(unsub);
    return unsub;
  },

  // === CLEANUP ===
  /** Channel-scoped teardown — safe to call on every channel switch. */
  cleanupChannel() {
    for (const [channelId, sub] of messageSubs) {
      sub.teardown();
      messageSubs.delete(channelId);
    }
    this.cleanupTyping();
    this.cleanupPins();
    this.cleanupPresence();
  },

  /** Full teardown of server/channel-scoped subscriptions (server switches). */
  cleanup() {
    state.listeners.forEach((u) => u());
    state.listeners = [];
    this.cleanupChannel();
    this.cleanupPresence();
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
  },

  /** Tear down global subscriptions (logout / account switch). */
  cleanupGlobal() {
    state.globalListeners.forEach((u) => u());
    state.globalListeners = [];
    this.cleanupDMChannels();
  },

  // === LEGACY EVENTS ===
  on(type: string, cb: (type: string, data: unknown) => void) {
    return subscribe(type, cb);
  },

  off(type: string, cb: (type: string, data: unknown) => void) {
    callbacks.get(type)?.delete(cb);
  },

  // === PROFILES ===
  profileCache: {} as Record<string, { name: string; avatar: string; color: string }>,

  async saveProfile(data: { name?: string; avatar?: string }): Promise<void> {
    const sessionId = getSessionId();
    const color = getUserColor(data.name || state.displayName || "Guest");
    await api.saveProfile({ name: data.name, avatar: data.avatar, color });

    this.profileCache[sessionId] = {
      name: data.name || state.displayName || "Guest",
      avatar: data.avatar || "",
      color,
    };
    notify("profile", { sessionId, ...this.profileCache[sessionId] });
  },

  async getProfile(
    sessionId: string
  ): Promise<{ name: string; avatar: string; color: string } | null> {
    if (this.profileCache[sessionId]) return this.profileCache[sessionId];
    try {
      const p = await api.getProfile(sessionId);
      if (p) {
        const profile = { name: p.name, avatar: p.avatar || "", color: p.color };
        this.profileCache[sessionId] = profile;
        return profile;
      }
    } catch {
      /* ignore */
    }
    return null;
  },

  async uploadAvatar(file: File): Promise<string> {
    validateUpload(file, "avatars");
    const fileUrl = await uploadToStorage(file, "avatars");
    await this.saveProfile({ avatar: fileUrl });
    return fileUrl;
  },

  subscribeProfile(
    cb: (profile: {
      sessionId: string;
      name: string;
      avatar: string;
      color: string;
    }) => void
  ) {
    const sessionId = getSessionId();
    const refresh = () => {
      api
        .getProfile(sessionId)
        .then((p) => {
          if (!p) return;
          const profile = { name: p.name, avatar: p.avatar || "", color: p.color };
          this.profileCache[sessionId] = profile;
          cb({ sessionId, ...profile });
        })
        .catch(() => {});
    };
    const unsub = pollRef(`profile:${sessionId}`, refresh, POLL_MS);
    state.globalListeners.push(unsub);
    return unsub;
  },

  // === OFFLINE: DRAFTS ===
  async saveDraft(channelId: string, text: string, replyTo?: unknown): Promise<void> {
    await outbox.saveDraft(channelId, text, replyTo);
  },

  async getDraft(channelId: string): Promise<{ text: string; replyTo?: unknown } | null> {
    const draft = await outbox.getDraft(channelId);
    if (!draft || !draft.text) return null;
    return { text: draft.text, replyTo: draft.replyTo };
  },

  async clearDraft(channelId: string): Promise<void> {
    await outbox.clearDraft(channelId);
  },

  async getPendingOutboxCount(): Promise<number> {
    return outbox.count();
  },

  onOutboxChange(cb: (count: number) => void) {
    return outbox.onOutboxChange(cb);
  },

  // === NEW SERVICES (P0) ===
  get permissions() {
    return { hasCapability, normalizeRole };
  },
  notifications: notifService,
  search: searchService,
  moderation: moderationService,
};

export { getSessionId, getUserColor };
export type { Capability, ServerRole };
