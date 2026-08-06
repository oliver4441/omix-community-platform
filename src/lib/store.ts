import { supabase, toCamel, toSnake, getPublicUrl } from "@/lib/supabase";
import { getRoom, getRoomId, isAblyConnected, onAblyConnectionState } from "@/lib/ably";
import { verifyAdminPasswordViaApi, queuePushNotification } from "@/lib/api";
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

function getSessionId(): string {
  // Use Supabase auth user ID if available, fallback to generated session ID
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("sb-frcmgkayluazwkokywux-auth-token");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.user?.id) return parsed.user.id;
      }
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
  // Supabase returns ISO strings — handle that
  return new Date(String(val));
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

// Helper: upload file to Supabase storage
async function uploadToStorage(
  file: File,
  bucket: string,
  folder: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  return getPublicUrl(bucket, path);
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
    const currentUserId = getSessionId();
    const channel = supabase
      .channel("dm-channels-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_channels" },
        async () => {
          // Refetch DM channels when any change happens
          const { data } = await supabase
            .from("dm_channels")
            .select("*")
            .contains("participants", [currentUserId]);
          if (data) {
            state.dmChannels = data.map((d) => toCamel(d) as unknown as DMChannel);
            state.dmChannelIds = new Set(data.map((d) => d.id));
            state.dmChannels.forEach((dm) => {
              if (dm.id === state.currentChannelId) return;
              if (!dm.lastMessageAt) return;
              const raw = dm.lastMessageAt;
              const lastMsgTime = raw instanceof Date ? raw.getTime() : (raw as { toDate: () => Date }).toDate().getTime();
              const lastRead = parseInt(ls().getItem(`os_read_${dm.id}`) || "0", 10);
              if (lastMsgTime > lastRead) {
                state.unreadCounts[dm.id] = Math.max(state.unreadCounts[dm.id] || 0, 1);
              }
            });
            this.saveUnread();
            notify("dmChannels", state.dmChannels);
            cb(state.dmChannels);
          }
        }
      )
      .subscribe();

    // Initial fetch
    supabase
      .from("dm_channels")
      .select("*")
      .contains("participants", [currentUserId])
      .then(({ data }) => {
        if (data) {
          state.dmChannels = data.map((d) => toCamel(d) as unknown as DMChannel);
          state.dmChannelIds = new Set(data.map((d) => d.id));
          notify("dmChannels", state.dmChannels);
          cb(state.dmChannels);
        }
      });

    const unsub = () => supabase.removeChannel(channel);
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

    // Check for existing DM channel
    const { data: existing } = await supabase
      .from("dm_channels")
      .select("*")
      .contains("participants", [currentUserId]);

    if (existing) {
      for (const ch of existing) {
        const participants = ch.participants as string[];
        if (participants.includes(otherUserId)) return ch.id;
      }
    }

    // Create new DM channel
    const { data, error } = await supabase
      .from("dm_channels")
      .insert({
        participants: [currentUserId, otherUserId],
        participant_names: {
          [currentUserId]: state.displayName || "Anonymous",
          [otherUserId]: state.onlineUsers.find((u) => u.id === otherUserId)?.name || "Unknown",
        },
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  },

  // === ADMIN ===
  async verifyAdminPassword(password: string): Promise<boolean> {
    // Prefer the secure worker endpoint (service role); fall back to the legacy
    // client-side check when the omix-api worker isn't deployed yet.
    const viaApi = await verifyAdminPasswordViaApi(password);
    if (viaApi !== null) return viaApi;

    const { data } = await supabase
      .from("config")
      .select("data")
      .eq("id", "settings")
      .single();
    if (!data) {
      // First time — set the password
      await supabase.from("config").upsert({
        id: "settings",
        data: { adminPassword: password },
      });
      return true;
    }
    return (data.data as Record<string, unknown>)?.adminPassword === password;
  },

  // === SERVERS ===
  subscribeServers(cb: (type: string, data: Server[]) => void) {
    const channel = supabase
      .channel("servers-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "servers" },
        async () => {
          const { data } = await supabase.from("servers").select("*").order("name");
          if (data) {
            state.servers = data.map((d) => ({
              id: d.id,
              name: d.name,
              icon: d.icon || "",
              ownerId: d.created_by || "",
              createdAt: toDate(d.created_at),
            }));
            notify("servers", state.servers);
            cb("servers", state.servers);
          }
        }
      )
      .subscribe();

    // Initial fetch
    supabase
      .from("servers")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) {
          state.servers = data.map((d) => ({
            id: d.id,
            name: d.name,
            icon: d.icon || "",
            ownerId: d.created_by || "",
            createdAt: toDate(d.created_at),
          }));
          notify("servers", state.servers);
          cb("servers", state.servers);
        }
      });

    const unsub = () => supabase.removeChannel(channel);
    state.listeners.push(unsub);
    return unsub;
  },

  async createServer(name: string): Promise<string> {
    if (!state.isAdmin) throw new Error("Only admins can create servers");
    const { data, error } = await supabase
      .from("servers")
      .insert({
        name: name.trim(),
        icon: "",
        created_by: getSessionId(),
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  },

  async deleteServer(serverId: string): Promise<void> {
    if (!state.isAdmin) throw new Error("Admin only");
    // Delete channels first, then server (cascade should handle this but be safe)
    await supabase.from("channels").delete().eq("server_id", serverId);
    await supabase.from("servers").delete().eq("id", serverId);
  },

  async updateServer(serverId: string, data: { name?: string; icon?: string }): Promise<void> {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.icon !== undefined) update.icon = data.icon;
    await supabase.from("servers").update(update).eq("id", serverId);
  },

  async uploadServerIcon(file: File, serverId: string): Promise<string> {
    if (file.size > 2 * 1024 * 1024) throw new Error("Image too large (max 2MB)");
    const fileUrl = await uploadToStorage(file, "server-icons", "icons");
    await this.updateServer(serverId, { icon: fileUrl });
    return fileUrl;
  },

  async getServer(serverId: string): Promise<Server | null> {
    const { data } = await supabase.from("servers").select("*").eq("id", serverId).single();
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      icon: data.icon || "",
      ownerId: data.created_by || "",
      createdAt: toDate(data.created_at),
    };
  },

  // === INVITES ===
  async createInvite(serverId: string): Promise<string> {
    const code = Math.random().toString(36).substring(2, 10);
    await supabase.from("invites").upsert({
      code,
      server_id: serverId,
      created_by: getSessionId(),
      uses: 0,
    });
    return code;
  },

  async joinServerByInvite(code: string): Promise<string | null> {
    const { data } = await supabase.from("invites").select("*").eq("code", code).single();
    if (!data) return null;
    await supabase
      .from("invites")
      .update({ uses: (data.uses || 0) + 1 })
      .eq("code", code);
    return data.server_id;
  },

  // === CHANNELS ===
  subscribeChannels(serverId: string, cb: (type: string, data: Channel[]) => void) {
    this.cleanupTyping();
    this.cleanupPresence();
    this.cleanupPins();

    const channel = supabase
      .channel(`channels-${serverId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "channels", filter: `server_id=eq.${serverId}` },
        async () => {
          const { data } = await supabase
            .from("channels")
            .select("*")
            .eq("server_id", serverId)
            .order("name");
          if (data) {
            state.channels = data.map((d) => ({
              id: d.id,
              serverId: d.server_id,
              name: d.name,
              category: d.category || "Text Channels",
              type: d.type || "text",
              topic: d.topic || "",
              position: d.position || 0,
              icon: d.icon || "",
              createdAt: toDate(d.created_at),
            }));
            notify("channels", state.channels);
            cb("channels", state.channels);
          }
        }
      )
      .subscribe();

    // Initial fetch
    supabase
      .from("channels")
      .select("*")
      .eq("server_id", serverId)
      .order("name")
      .then(({ data }) => {
        if (data) {
          state.channels = data.map((d) => ({
            id: d.id,
            serverId: d.server_id,
            name: d.name,
            category: d.category || "Text Channels",
            type: d.type || "text",
            topic: d.topic || "",
            position: d.position || 0,
            icon: d.icon || "",
            createdAt: toDate(d.created_at),
          }));
          notify("channels", state.channels);
          cb("channels", state.channels);
        }
      });

    const unsub = () => supabase.removeChannel(channel);
    state.listeners.push(unsub);
    return unsub;
  },

  async createChannel(
    serverId: string,
    name: string,
    category = "Text Channels",
    icon?: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from("channels")
      .insert({
        server_id: serverId,
        name: name.toLowerCase().replace(/\s+/g, "-"),
        category,
        type: "text",
        icon: icon || "",
        position: state.channels.length,
      })
      .select("id")
      .single();
    if (error) throw error;
    state.currentChannelId = data.id;
    ls().setItem("os_channel", data.id);
    return data.id;
  },

  async uploadChannelIcon(file: File, channelId: string): Promise<string> {
    if (file.size > 2 * 1024 * 1024) throw new Error("Image too large (max 2MB)");
    const fileUrl = await uploadToStorage(file, "server-icons", "channel-icons");
    await supabase.from("channels").update({ icon: fileUrl }).eq("id", channelId);
    return fileUrl;
  },

  async deleteChannel(channelId: string): Promise<void> {
    if (!state.isAdmin) throw new Error("Admin only");
    await supabase.from("channels").delete().eq("id", channelId);
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

    const channel = supabase
      .channel(`messages-${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        async () => {
          // Refetch last PAGE_SIZE messages
          const { data } = await supabase
            .from("messages")
            .select("*")
            .eq("channel_id", channelId)
            .order("timestamp", { ascending: true })
            .limit(PAGE_SIZE);

          if (data) {
            const docs = data
              .map((d) => ({
                id: d.id,
                channelId: d.channel_id,
                author: d.author || "Anonymous",
                authorId: d.author_id || "",
                sessionId: d.session_id || "",
                text: d.text || "",
                color: d.color || "#8B5CF6",
                timestamp: toDate(d.timestamp),
                reactions: (d.reactions as Record<string, string[]>) || {},
                edited: d.edited || false,
                editedAt: d.edited_at ? toDate(d.edited_at) : undefined,
                pinned: d.pinned || false,
                pinnedAt: d.pinned_at ? toDate(d.pinned_at) : undefined,
                fileUrl: d.file_url || undefined,
                fileType: d.file_type || undefined,
                fileName: d.file_name || undefined,
                fileSize: d.file_size || undefined,
                replyTo: (d.reply_to as Message["replyTo"]) || undefined,
                threadId: d.thread_id || undefined,
                mentions: (d.mentions as string[]) || undefined,
              } as Message))
              .filter((m) => !m.pinned);

            state.messages = docs;

            const pagination = state.messagePagination.get(channelId);
            if (pagination && docs.length > 0) {
              const oldestMsg = docs[0];
              pagination.oldestTimestamp =
                oldestMsg.timestamp instanceof Date
                  ? oldestMsg.timestamp.getTime()
                  : new Date(oldestMsg.timestamp as unknown as string).getTime();
              pagination.hasMore = docs.length === PAGE_SIZE;
            }

            notify("messages", state.messages);
            cb("messages", state.messages);
          }
        }
      )
      .subscribe();

    // Initial fetch
    supabase
      .from("messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("timestamp", { ascending: true })
      .limit(PAGE_SIZE)
      .then(({ data }) => {
        if (data) {
          const docs = data
            .map((d) => ({
              id: d.id,
              channelId: d.channel_id,
              author: d.author || "Anonymous",
              authorId: d.author_id || "",
              sessionId: d.session_id || "",
              text: d.text || "",
              color: d.color || "#8B5CF6",
              timestamp: toDate(d.timestamp),
              reactions: (d.reactions as Record<string, string[]>) || {},
              edited: d.edited || false,
              editedAt: d.edited_at ? toDate(d.edited_at) : undefined,
              pinned: d.pinned || false,
              pinnedAt: d.pinned_at ? toDate(d.pinned_at) : undefined,
              fileUrl: d.file_url || undefined,
              fileType: d.file_type || undefined,
              fileName: d.file_name || undefined,
              fileSize: d.file_size || undefined,
              replyTo: (d.reply_to as Message["replyTo"]) || undefined,
              threadId: d.thread_id || undefined,
              mentions: (d.mentions as string[]) || undefined,
            } as Message))
            .filter((m) => !m.pinned);

          state.messages = docs;

          const pagination = state.messagePagination.get(channelId);
          if (pagination && docs.length > 0) {
            const oldestMsg = docs[0];
            pagination.oldestTimestamp =
              oldestMsg.timestamp instanceof Date
                ? oldestMsg.timestamp.getTime()
                : new Date(oldestMsg.timestamp as unknown as string).getTime();
            pagination.hasMore = docs.length === PAGE_SIZE;
          }

          notify("messages", state.messages);
          cb("messages", state.messages);
        }
      });

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

    const unsub = () => {
      supabase.removeChannel(channel);
      unsubAbly();
    };
    state.listeners.push(unsub);
    return unsub;
  },

  async loadMoreMessages(channelId: string): Promise<Message[]> {
    const pagination = state.messagePagination.get(channelId);
    if (!pagination || !pagination.hasMore || pagination.loading) return [];

    pagination.loading = true;
    try {
      const cutoff = new Date(pagination.oldestTimestamp!);
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("channel_id", channelId)
        .lt("timestamp", cutoff.toISOString())
        .order("timestamp", { ascending: true })
        .limit(PAGE_SIZE);

      if (data && data.length > 0) {
        const olderMessages = data
          .map((d) => ({
            id: d.id,
            channelId: d.channel_id,
            author: d.author || "Anonymous",
            authorId: d.author_id || "",
            sessionId: d.session_id || "",
            text: d.text || "",
            color: d.color || "#8B5CF6",
            timestamp: toDate(d.timestamp),
            reactions: (d.reactions as Record<string, string[]>) || {},
            edited: d.edited || false,
            editedAt: d.edited_at ? toDate(d.edited_at) : undefined,
            pinned: d.pinned || false,
            pinnedAt: d.pinned_at ? toDate(d.pinned_at) : undefined,
            fileUrl: d.file_url || undefined,
            fileType: d.file_type || undefined,
            fileName: d.file_name || undefined,
            fileSize: d.file_size || undefined,
            replyTo: (d.reply_to as Message["replyTo"]) || undefined,
            threadId: d.thread_id || undefined,
            mentions: (d.mentions as string[]) || undefined,
          } as Message))
          .filter((m) => !m.pinned);

        state.messages = [...olderMessages, ...state.messages];
        const oldestMsg = olderMessages[0];
        pagination.oldestTimestamp =
          oldestMsg.timestamp instanceof Date
            ? oldestMsg.timestamp.getTime()
            : new Date(oldestMsg.timestamp as unknown as string).getTime();
        pagination.hasMore = olderMessages.length === PAGE_SIZE;
        notify("messages", state.messages);
        return olderMessages;
      } else {
        pagination.hasMore = false;
        return [];
      }
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
    const channel = supabase
      .channel(`thread-${threadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        async () => {
          const { data } = await supabase
            .from("messages")
            .select("*")
            .eq("thread_id", threadId)
            .order("timestamp", { ascending: true });

          if (data) {
            const msgs = data.map((d) => ({
              id: d.id,
              channelId: d.channel_id,
              author: d.author || "Anonymous",
              authorId: d.author_id || "",
              sessionId: d.session_id || "",
              text: d.text || "",
              color: d.color || "#8B5CF6",
              timestamp: toDate(d.timestamp),
              reactions: (d.reactions as Record<string, string[]>) || {},
              edited: d.edited || false,
              editedAt: d.edited_at ? toDate(d.edited_at) : undefined,
              pinned: d.pinned || false,
              fileUrl: d.file_url || undefined,
              threadId: d.thread_id || undefined,
            } as Message));
            cb("thread", msgs);
          }
        }
      )
      .subscribe();

    const unsub = () => supabase.removeChannel(channel);
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

    const msg: Record<string, unknown> = {
      channel_id: channelId,
      author: displayName || "Anonymous",
      author_id: getSessionId(),
      session_id: getSessionId(),
      text: text.trim(),
      color: getUserColor(displayName),
      timestamp: new Date().toISOString(),
      reactions: {},
    };

    if (opts.fileUrl) {
      msg.file_url = opts.fileUrl;
      msg.file_type = opts.fileType || "image";
      if (opts.fileName) msg.file_name = opts.fileName;
      if (opts.fileSize) msg.file_size = opts.fileSize;
    }
    if (opts.replyTo) msg.reply_to = opts.replyTo;
    if (opts.mentions) msg.mentions = opts.mentions;
    if (opts.threadId) msg.thread_id = opts.threadId;

    const { data: inserted, error } = await supabase
      .from("messages")
      .insert(msg)
      .select("id")
      .single();
    if (error) throw error;

    if (inserted?.id) {
      this.publishMessage(channelId, { ...msg, id: inserted.id });
    }

    // Update DM channel last message
    if (state.dmChannelIds.has(channelId)) {
      await supabase
        .from("dm_channels")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_text: text.trim().substring(0, 100),
          last_message_author: displayName || "Anonymous",
        })
        .eq("id", channelId);
    }

    if (channelId !== state.currentChannelId) {
      this.incrementUnread(channelId);
    }

    this.awardXP(10, "message").catch(() => {});

    // Award reply XP to parent message author
    if (opts.threadId) {
      try {
        const { data: parentData } = await supabase
          .from("messages")
          .select("session_id, author_id")
          .eq("id", opts.threadId)
          .single();

        if (parentData && parentData.session_id && parentData.session_id !== getSessionId()) {
          const { data: parentStats } = await supabase
            .from("stats")
            .select("*")
            .eq("session_id", parentData.session_id)
            .single();

          if (parentStats) {
            const newReplies = (parentStats.replies_received || 0) + 1;
            const newXp = (parentStats.xp || 0) + 5;
            const newBadges = this.getBadgesForStats({
              ...parentStats,
              repliesReceived: newReplies,
              xp: newXp,
            });
            await supabase
              .from("stats")
              .update({
                replies_received: newReplies,
                xp: newXp,
                badges: newBadges,
              })
              .eq("session_id", parentData.session_id);
          }
        }
      } catch {
        /* fail silently */
      }
    }
  },

  publishMessage(channelId: string, row: Record<string, unknown>): void {
    if (typeof window === "undefined") return;
    const roomId = getRoomId(channelId, state.dmChannelIds.has(channelId));
    const metadata: Record<string, unknown> = {
      osId: row.id,
      channelId,
      author: row.author,
      authorId: row.author_id,
      sessionId: row.session_id,
      color: row.color,
      timestamp: row.timestamp,
      fileUrl: row.file_url,
      fileType: row.file_type,
      fileName: row.file_name,
      fileSize: row.file_size,
      replyTo: row.reply_to,
      threadId: row.thread_id,
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
        console.warn("[ably] publish failed — relying on Supabase realtime", err);
      });
  },

  async editMessage(messageId: string, newText: string): Promise<void> {
    await supabase
      .from("messages")
      .update({
        text: newText.trim(),
        edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq("id", messageId);
  },

  async deleteMessage(messageId: string): Promise<void> {
    await supabase.from("messages").delete().eq("id", messageId);
  },

  // === PINS ===
  async togglePin(messageId: string): Promise<void> {
    if (!state.isAdmin) throw new Error("Admin only");
    const { data } = await supabase
      .from("messages")
      .select("pinned")
      .eq("id", messageId)
      .single();
    if (!data) return;

    if (data.pinned) {
      await supabase.from("messages").update({ pinned: false }).eq("id", messageId);
    } else {
      await supabase
        .from("messages")
        .update({ pinned: true, pinned_at: new Date().toISOString() })
        .eq("id", messageId);
    }
  },

  subscribePins(channelId: string, cb: (pins: Message[]) => void) {
    const channel = supabase
      .channel(`pins-${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        async () => {
          const { data } = await supabase
            .from("messages")
            .select("*")
            .eq("channel_id", channelId)
            .eq("pinned", true);

          if (data) {
            const pins = data.map((d) => ({
              id: d.id,
              channelId: d.channel_id,
              author: d.author || "Anonymous",
              authorId: d.author_id || "",
              sessionId: d.session_id || "",
              text: d.text || "",
              color: d.color || "#8B5CF6",
              timestamp: toDate(d.timestamp),
              reactions: (d.reactions as Record<string, string[]>) || {},
              pinned: true,
              pinnedAt: d.pinned_at ? toDate(d.pinned_at) : undefined,
            } as Message));
            state.pinnedMessages = pins;
            notify("pins", pins);
            cb(pins);
          }
        }
      )
      .subscribe();

    const unsub = () => supabase.removeChannel(channel);
    state.pinListeners.push(unsub);
    return unsub;
  },

  cleanupPins() {
    state.pinListeners.forEach((u) => u());
    state.pinListeners = [];
  },

  // === REACTIONS ===
  async toggleReaction(messageId: string, emoji: string, displayName: string): Promise<void> {
    const { data } = await supabase
      .from("messages")
      .select("reactions, session_id, author_id")
      .eq("id", messageId)
      .single();
    if (!data) return;

    const reactions = (data.reactions as Record<string, string[]>) || {};
    const users = reactions[emoji] || [];
    const idx = users.indexOf(displayName);
    const wasNew = idx === -1;

    if (idx > -1) {
      users.splice(idx, 1);
      if (users.length === 0) delete reactions[emoji];
      else reactions[emoji] = users;
    } else {
      users.push(displayName);
      reactions[emoji] = users;
    }

    await supabase.from("messages").update({ reactions }).eq("id", messageId);

    // Award reaction XP to author
    if (wasNew && data.session_id !== getSessionId() && data.author_id) {
      try {
        const { data: authorStats } = await supabase
          .from("stats")
          .select("*")
          .eq("session_id", data.author_id)
          .single();

        if (authorStats) {
          const newReactions = (authorStats.reactions_received || 0) + 1;
          const newXp = (authorStats.xp || 0) + 2;
          const newBadges = this.getBadgesForStats({
            ...authorStats,
            reactionsReceived: newReactions,
            xp: newXp,
          });
          await supabase
            .from("stats")
            .update({
              reactions_received: newReactions,
              xp: newXp,
              badges: newBadges,
            })
            .eq("session_id", data.author_id);
        }
      } catch {
        /* fail silently */
      }
    }
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
    const sessionId = getSessionId();
    const docId = `${channelId}_${sessionId}`;

    supabase
      .from("typing")
      .upsert({
        id: docId,
        channel_id: channelId,
        display_name: displayName,
        session_id: sessionId,
        created_at: new Date().toISOString(),
      })
      .then(() => {
        setTimeout(() => {
          supabase.from("typing").delete().eq("id", docId);
        }, TYPING_TIMEOUT);
      });
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
    const docId = `${channelId}_${getSessionId()}`;
    supabase.from("typing").delete().eq("id", docId);
  },

  subscribeTyping(channelId: string, cb: (users: TypingUser[]) => void) {
    if (!channelId) return () => {};

    const roomId = getRoomId(channelId, state.dmChannelIds.has(channelId));
    let supabaseUnsub: (() => void) | null = null;
    let ablyUnsub: (() => void) | null = null;
    let disposed = false;

    const setupSupabase = () => {
      if (supabaseUnsub || disposed) return;
      const channel = supabase
        .channel(`typing-${channelId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "typing", filter: `channel_id=eq.${channelId}` },
          async () => {
            const { data } = await supabase
              .from("typing")
              .select("*")
              .eq("channel_id", channelId);

            if (data) {
              const users = data
                .filter((u) => u.session_id !== getSessionId() && u.display_name)
                .map((u) => ({
                  name: u.display_name,
                  sessionId: u.session_id,
                  channelId: u.channel_id,
                }));
              state.typingUsers = users;
              cb(users);
            }
          }
        )
        .subscribe();
      supabaseUnsub = () => supabase.removeChannel(channel);
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
          if (supabaseUnsub) {
            supabaseUnsub();
            supabaseUnsub = null;
          }
        })
        .catch(() => {});
    };

    setupSupabase();
    if (typeof window !== "undefined") {
      onAblyConnectionState((connected) => {
        if (connected) setupAbly();
      });
    }

    const unsub = () => {
      disposed = true;
      if (ablyUnsub) ablyUnsub();
      if (supabaseUnsub) supabaseUnsub();
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
    const sessionId = getSessionId();
    const color = getUserColor(displayName);
    const heartbeat = () =>
      supabase
        .from("presence")
        .update({ online: true, last_seen: new Date().toISOString() })
        .eq("session_id", sessionId);

    await supabase.from("presence").upsert({
      session_id: sessionId,
      display_name: displayName,
      color,
      online: true,
      last_seen: new Date().toISOString(),
    });

    setInterval(heartbeat, 30000);

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
    }

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        supabase
          .from("presence")
          .update({ online: false })
          .eq("session_id", sessionId);
        leaveAbly();
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          supabase
            .from("presence")
            .update({ online: false })
            .eq("session_id", sessionId);
          updateAbly(false);
        } else {
          supabase
            .from("presence")
            .update({ online: true, last_seen: new Date().toISOString() })
            .eq("session_id", sessionId);
          updateAbly(true);
        }
      });
    }
  },

  subscribePresence(cb: (users: User[]) => void) {
    let supabaseUnsub: (() => void) | null = null;
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
          if (supabaseUnsub) {
            supabaseUnsub();
            supabaseUnsub = null;
          }
        })
        .catch(() => {});
    };

    const setupSupabase = () => {
      if (supabaseUnsub || disposed) return;
      const channel = supabase
        .channel("presence-list")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "presence" },
          async () => {
            const { data } = await supabase
              .from("presence")
              .select("*")
              .eq("online", true);

            if (data) {
              const users = data.map((d) => ({
                name: d.display_name,
                id: d.session_id,
                color: d.color,
              })) as User[];
              state.onlineUsers = users;
              cb(users);
            }
          }
        )
        .subscribe();

      supabase
        .from("presence")
        .select("*")
        .eq("online", true)
        .then(({ data }) => {
          if (data) {
            const users = data.map((d) => ({
              name: d.display_name,
              id: d.session_id,
              color: d.color,
            })) as User[];
            state.onlineUsers = users;
            cb(users);
          }
        });

      supabaseUnsub = () => supabase.removeChannel(channel);
    };

    setupSupabase();
    if (typeof window !== "undefined") {
      onAblyConnectionState((connected) => {
        if (connected) setupAbly();
      });
    }

    const unsub = () => {
      disposed = true;
      if (ablyUnsub) ablyUnsub();
      if (supabaseUnsub) supabaseUnsub();
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
    const fileUrl = await uploadToStorage(file, "files", "uploads");
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
    const { data } = await supabase
      .from("stats")
      .select("*")
      .eq("session_id", uid)
      .single();

    if (data) {
      return {
        xp: data.xp || 0,
        level: data.level || 1,
        messagesSent: data.messages_sent || 0,
        reactionsReceived: data.reactions_received || 0,
        repliesReceived: data.replies_received || 0,
        badges: (data.badges as string[]) || [],
        lastMessageDate: data.last_message_date || "",
        joinDate: data.join_date || "",
        streakCount: data.streak_count || 0,
      };
    }

    return {
      xp: 0,
      level: 1,
      messagesSent: 0,
      reactionsReceived: 0,
      repliesReceived: 0,
      badges: [],
      joinDate: new Date().toISOString().split("T")[0],
    };
  },

  subscribeStats(cb: (stats: UserStats) => void) {
    const uid = getSessionId();
    const channel = supabase
      .channel(`stats-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stats", filter: `session_id=eq.${uid}` },
        async () => {
          const stats = await this.getStats(uid);
          cb(stats);
        }
      )
      .subscribe();

    // Initial fetch
    this.getStats(uid).then(cb);

    const unsub = () => supabase.removeChannel(channel);
    state.listeners.push(unsub);
    return unsub;
  },

  async awardXP(amount: number, reason: string): Promise<void> {
    const uid = getSessionId();
    const today = new Date().toISOString().split("T")[0];

    // Get current stats
    const { data: existing } = await supabase
      .from("stats")
      .select("*")
      .eq("session_id", uid)
      .single();

    const current = existing || {
      xp: 0,
      messages_sent: 0,
      reactions_received: 0,
      replies_received: 0,
      badges: [],
      last_message_date: "",
      streak_count: 0,
    };

    const newXp = (current.xp || 0) + amount;
    const newLevel = this.getLevel(newXp);
    let newStreak = current.streak_count || 0;

    if (reason === "message") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      if (current.last_message_date === yesterdayStr) {
        newStreak = (current.streak_count || 0) + 1;
      } else if (current.last_message_date !== today) {
        newStreak = 1;
      }
    }

    const newStats: Record<string, unknown> = {
      xp: newXp,
      level: newLevel,
      last_message_date: today,
      streak_count: newStreak,
    };

    if (reason === "message") newStats.messages_sent = (current.messages_sent || 0) + 1;
    if (reason === "reaction") newStats.reactions_received = (current.reactions_received || 0) + 1;
    if (reason === "reply") newStats.replies_received = (current.replies_received || 0) + 1;

    const fullStats: Partial<UserStats> = {
      xp: newXp,
      level: newLevel,
      messagesSent: newStats.messages_sent as number || current.messages_sent || 0,
      reactionsReceived: newStats.reactions_received as number || current.reactions_received || 0,
      repliesReceived: newStats.replies_received as number || current.replies_received || 0,
      streakCount: newStreak,
    };
    newStats.badges = this.getBadgesForStats(fullStats);

    if (existing) {
      await supabase.from("stats").update(newStats).eq("session_id", uid);
    } else {
      await supabase.from("stats").insert({ session_id: uid, ...newStats });
    }
  },

  // === FCM (stub — Supabase doesn't have FCM, use web notifications) ===
  async requestNotificationPermission(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window)) return false;
    if (Notification.permission === "denied") return false;
    if (Notification.permission === "granted") return true;
    const result = await Notification.requestPermission();
    return result === "granted";
  },

  async saveFCMToken(): Promise<string | null> {
    // FCM not available with Supabase — return null
    return null;
  },

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<void> {
    // Route through the omix-api worker, which queues into the notifications
    // table with the service role. No-op if the worker isn't deployed.
    await queuePushNotification(userId, title, body, data);
  },

  // === CALL LOG ===
  async getCallLog(limit = 50): Promise<CallLogEntry[]> {
    const uid = getSessionId();
    const { data } = await supabase
      .from("call_log")
      .select("*")
      .or(`caller_id.eq.${uid},callee_id.eq.${uid}`)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (!data) return [];
    return data.map((d) => ({
      id: d.id,
      callerId: d.caller_id,
      calleeId: d.callee_id,
      callerName: d.caller_name || "",
      calleeName: d.callee_name || "",
      video: d.video || false,
      status: d.status || "ended",
      startedAt: toDate(d.started_at),
      endedAt: d.ended_at ? toDate(d.ended_at) : null,
      durationMs: d.duration_ms ?? null,
    })) as CallLogEntry[];
  },

  subscribeCallLog(cb: (entries: CallLogEntry[]) => void) {
    const uid = getSessionId();
    const channel = supabase
      .channel(`call-log-${uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_log",
          filter: `or=(caller_id.eq.${uid},callee_id.eq.${uid})`,
        },
        async () => {
          const entries = await this.getCallLog();
          cb(entries);
        }
      )
      .subscribe();

    // Initial fetch
    this.getCallLog().then(cb);

    const unsub = () => supabase.removeChannel(channel);
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
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) update.name = data.name;
    if (data.avatar !== undefined) update.avatar = data.avatar;
    update.color = getUserColor(data.name || state.displayName || "Guest");

    await supabase.from("profiles").upsert({
      session_id: sessionId,
      ...update,
    });

    this.profileCache[sessionId] = {
      name: data.name || state.displayName || "Guest",
      avatar: data.avatar || "",
      color: getUserColor(data.name || state.displayName || "Guest"),
    };
    notify("profile", { sessionId, ...this.profileCache[sessionId] });
  },

  async getProfile(
    sessionId: string
  ): Promise<{ name: string; avatar: string; color: string } | null> {
    if (this.profileCache[sessionId]) return this.profileCache[sessionId];

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (data) {
      const profile = { name: data.name, avatar: data.avatar || "", color: data.color };
      this.profileCache[sessionId] = profile;
      return profile;
    }
    return null;
  },

  async uploadAvatar(file: File): Promise<string> {
    if (file.size > 2 * 1024 * 1024) throw new Error("Image too large (max 2MB)");
    const fileUrl = await uploadToStorage(file, "avatars", "avatars");
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
    const channel = supabase
      .channel(`profile-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("session_id", sessionId)
            .single();
          if (data) {
            const profile = { name: data.name, avatar: data.avatar || "", color: data.color };
            this.profileCache[sessionId] = profile;
            cb({ sessionId, ...profile });
          }
        }
      )
      .subscribe();

    // Initial fetch
    supabase
      .from("profiles")
      .select("*")
      .eq("session_id", sessionId)
      .single()
      .then(({ data }) => {
        if (data) {
          const profile = { name: data.name, avatar: data.avatar || "", color: data.color };
          this.profileCache[sessionId] = profile;
          cb({ sessionId, ...profile });
        }
      });

    const unsub = () => supabase.removeChannel(channel);
    state.listeners.push(unsub);
    return unsub;
  },
};

export { getSessionId, getUserColor };
