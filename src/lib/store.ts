import { api, getUserId } from "@/lib/api";
import { getRoom, getRoomId, isAblyConnected, onAblyConnectionState } from "@/lib/ably";
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

const FALLBACK_SESSION_ID = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
const TYPING_TIMEOUT = 3000;
const PAGE_SIZE = 50;
const POLL_MS = 10000;

function getSessionId(): string {
  // The signed-in user id from the omix-api session token (replaces the old
  // Supabase auth user id).
  if (typeof window !== "undefined") {
    try {
      const uid = getUserId();
      if (uid) return uid;
    } catch {}
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
  listeners: Listener[];
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

function ls(): typeof localStorage {
  if (typeof window !== "undefined") return localStorage;
  return { getItem: () => null, setItem: () => {} } as unknown as typeof localStorage;
}

const state: StoreState = {
  servers: [],
  channels: [],
  dmChannels: [],
  messages: [],
  pinnedMessages: [],
  typingUsers: [],
  onlineUsers: [],
  currentServerId: ls().getItem("os_server") || "server1",
  currentChannelId: ls().getItem("os_channel") || "channel1",
  currentChannelType: "channel",
  currentDMChannelName: "",
  isAdmin: ls().getItem("os_admin") === "true",
  displayName: ls().getItem("os_username") || "",
  listeners: [],
  typingListeners: [],
  presenceListeners: [],
  pinListeners: [],
  dmListeners: [],
  dmChannelIds: new Set<string>(),
  unreadCounts: {},
  messagePagination: new Map(),
};

try {
  state.unreadCounts = JSON.parse(ls().getItem("os_unread") || "{}");
} catch {
  state.unreadCounts = {};
}

const callbacks: Map<string, Set<(type: string, data: unknown) => void>> = new Map();

function notify(type: string, data: unknown) {
  callbacks.get(type)?.forEach((cb) => cb(type, data));
}

function subscribe(type: string, cb: (type: string, data: unknown) => void) {
  if (!callbacks.has(type)) callbacks.set(type, new Set());
  callbacks.get(type)!.add(cb);
  return () => callbacks.get(type)?.delete(cb);
}

/** Run once immediately, then on an interval. Returns an unsubscribe fn. */
function poll(fn: () => void, ms: number): () => void {
  const run = () => {
    try {
      fn();
    } catch {
      /* ignore polling errors */
    }
  };
  run();
  const t = setInterval(run, ms);
  return () => clearInterval(t);
}

// Upload through the omix-api worker (R2 storage).
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
  set currentServerId(v: string) { state.currentServerId = v; ls().setItem("os_server", v); },
  get currentChannelId() { return state.currentChannelId; },
  set currentChannelId(v: string) { state.currentChannelId = v; ls().setItem("os_channel", v); },
  get currentChannelType() { return state.currentChannelType; },
  set currentChannelType(v: "channel" | "dm") { state.currentChannelType = v; },
  get currentDMChannelName() { return state.currentDMChannelName; },
  set currentDMChannelName(v: string) { state.currentDMChannelName = v; },
  get isAdmin() { return state.isAdmin; },
  set isAdmin(v: boolean) { state.isAdmin = v; ls().setItem("os_admin", v ? "true" : ""); },
  get displayName() { return state.displayName; },
  set displayName(v: string) { state.displayName = v; ls().setItem("os_username", v); },
  get unreadCounts() { return state.unreadCounts; },
  get sessionId() { return getSessionId(); },

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
            const lastRead = parseInt(ls().getItem(`os_read_${dm.id}`) || "0", 10);
            if (lastMsgTime > lastRead) {
              state.unreadCounts[dm.id] = Math.max(state.unreadCounts[dm.id] || 0, 1);
            }
          });
          this.saveUnread();
          notify("dmChannels", state.dmChannels);
          cb(state.dmChannels);
        })
        .catch(() => {});
    };
    const unsub = poll(refresh, POLL_MS);
    state.dmListeners.push(unsub);
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
    // Prefer the worker (config table); fall back to a local first-time check
    // when the omix-api worker isn't reachable (e.g. dev without
    // NEXT_PUBLIC_API_BASE_URL).
    try {
      const { valid } = await api.verifyAdminPassword(password);
      return valid;
    } catch {
      try {
        const stored = ls().getItem("os_admin_password");
        if (stored === null) {
          ls().setItem("os_admin_password", password);
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
        .catch(() => {});
    };
    const unsub = poll(refresh, POLL_MS);
    state.listeners.push(unsub);
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
    return id;
  },

  async deleteServer(serverId: string): Promise<void> {
    if (!state.isAdmin) throw new Error("Admin only");
    await api.deleteServer(serverId);
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
  },

  async uploadServerIcon(file: File, serverId: string): Promise<string> {
    if (file.size > 2 * 1024 * 1024) throw new Error("Image too large (max 2MB)");
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
        .catch(() => {});
    };
    const unsub = poll(refresh, POLL_MS);
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
    ls().setItem("os_channel", id);
    return id;
  },

  async uploadChannelIcon(file: File, channelId: string): Promise<string> {
    if (file.size > 2 * 1024 * 1024) throw new Error("Image too large (max 2MB)");
    const fileUrl = await uploadToStorage(file, "channel-icons");
    await api.updateChannel(channelId, { icon: fileUrl });
    return fileUrl;
  },

  async deleteChannel(channelId: string): Promise<void> {
    if (!state.isAdmin) throw new Error("Admin only");
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

    const fetchLatest = () => {
      api
        .getMessages(channelId, { limit: PAGE_SIZE })
        .then(({ messages }) => {
          const docs = messages.map(toMessage).filter((m) => !m.pinned);
          state.messages = docs;
          const pagination = state.messagePagination.get(channelId);
          if (pagination && docs.length > 0) {
            pagination.oldestTimestamp = toDate(docs[0].timestamp).getTime();
            pagination.hasMore = docs.length === PAGE_SIZE;
          }
          notify("messages", state.messages);
          cb("messages", state.messages);
        })
        .catch(() => {});
    };
    fetchLatest();

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
      } else if (!connected) {
        startFallback();
      }
    });

    const unsub = () => {
      unsubAbly();
      offConn();
      if (pollTimer) clearInterval(pollTimer);
    };
    state.listeners.push(unsub);
    return unsub;
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
        .catch(() => {});
    };
    const unsub = poll(refresh, 5000);
    state.listeners.push(unsub);
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
      authorId: getSessionId(),
      sessionId: getSessionId(),
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

    const { id } = await api.sendMessage(channelId, msg);
    if (id) {
      this.publishMessage(channelId, { ...msg, id });
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
      sessionId: row.session_id || row.sessionId,
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
    if (!state.isAdmin) throw new Error("Admin only");
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
        .catch(() => {});
    };
    const unsub = poll(refresh, POLL_MS);
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
                } catch {}
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
  async setPresence(displayName: string): Promise<void> {
    const color = getUserColor(displayName);
    const beat = () => api.setPresence(displayName, color).catch(() => {});

    await beat();
    setInterval(beat, 30000);

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
      } catch {}
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
  async uploadFile(file: File, channelId: string, displayName: string): Promise<void> {
    if (file.size > 20 * 1024 * 1024) throw new Error("File too large (max 20MB)");
    const fileUrl = await uploadToStorage(file, "uploads");
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
      ls().setItem(`os_read_${channelId}`, Date.now().toString());
    } catch {}
  },

  incrementUnread(channelId: string) {
    if (channelId === state.currentChannelId) return;
    state.unreadCounts[channelId] = (state.unreadCounts[channelId] || 0) + 1;
    this.saveUnread();
  },

  saveUnread() {
    try {
      ls().setItem("os_unread", JSON.stringify(state.unreadCounts));
    } catch {}
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
    const unsub = poll(refresh, POLL_MS);
    state.listeners.push(unsub);
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
    // Route through the omix-api worker, which queues into the notifications
    // table. No-op if the worker isn't deployed.
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
    const unsub = poll(refresh, POLL_MS);
    state.listeners.push(unsub);
    return unsub;
  },

  // === CLEANUP ===
  cleanup() {
    state.listeners.forEach((u) => u());
    state.listeners = [];
    this.cleanupTyping();
    this.cleanupPresence();
    this.cleanupPins();
    this.cleanupDMChannels();
  },

  // === EVENTS ===
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
    } catch {}
    return null;
  },

  async uploadAvatar(file: File): Promise<string> {
    if (file.size > 2 * 1024 * 1024) throw new Error("Image too large (max 2MB)");
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
    const unsub = poll(refresh, POLL_MS);
    state.listeners.push(unsub);
    return unsub;
  },
};

export { getSessionId, getUserColor };
