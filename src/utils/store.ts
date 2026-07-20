import { db, firebase, auth, storage } from './firebase';
import type { Message, Channel, Server, User, UnreadCounts, TypingUser, DMChannel, UserStats } from '../types';

const FALLBACK_SESSION_ID = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
const TYPING_TIMEOUT = 3000;

function getSessionId(): string {
  return auth?.currentUser?.uid || FALLBACK_SESSION_ID;
}

const USER_COLORS = [
  '#5865f2', '#ed4245', '#faa61a', '#57f287', '#eb459e',
  '#00b0f0', '#ff73fa', '#95efb8', '#fee75c', '#b0aa8e',
];

function getUserColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

function convertTimestamp(ts: unknown): Date {
  if (!ts) return new Date();
  if (ts instanceof firebase.firestore.Timestamp) return ts.toDate();
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    return (ts as { toDate: () => Date }).toDate();
  }
  return new Date(ts as string | number);
}

type Listener = () => void;

const PAGE_SIZE = 50;

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
  currentChannelType: 'channel' | 'dm';
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
  // Pagination state
  messagePagination: Map<string, { oldestTimestamp: number | null; hasMore: boolean; loading: boolean }>;
}

const state: StoreState = {
  servers: [],
  channels: [],
  dmChannels: [],
  messages: [],
  pinnedMessages: [],
  typingUsers: [],
  onlineUsers: [],
  currentServerId: localStorage.getItem('omix_server') || 'server1',
  currentChannelId: localStorage.getItem('omix_channel') || 'channel1',
  currentChannelType: 'channel',
  currentDMChannelName: '',
  isAdmin: localStorage.getItem('omix_admin') === 'true',
  displayName: localStorage.getItem('omix_username') || '',
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
  state.unreadCounts = JSON.parse(localStorage.getItem('omix_unread') || '{}');
} catch {
  state.unreadCounts = {};
}

const callbacks: Map<string, Set<(type: string, data: unknown) => void>> = new Map();

function notify(type: string, data: unknown) {
  callbacks.get(type)?.forEach(cb => cb(type, data));
}

function subscribe(type: string, cb: (type: string, data: unknown) => void) {
  if (!callbacks.has(type)) callbacks.set(type, new Set());
  callbacks.get(type)!.add(cb);
  return () => callbacks.get(type)?.delete(cb);
}

export const Store = {
  get servers() { return state.servers; },
  get channels() { return state.channels; },
  get messages() { return state.messages; },
  get pinnedMessages() { return state.pinnedMessages; },
  get typingUsers() { return state.typingUsers; },
  get onlineUsers() { return state.onlineUsers; },
  get currentServerId() { return state.currentServerId; },
  set currentServerId(v: string) {
    state.currentServerId = v;
    localStorage.setItem('omix_server', v);
  },
  get currentChannelId() { return state.currentChannelId; },
  set currentChannelId(v: string) {
    state.currentChannelId = v;
    localStorage.setItem('omix_channel', v);
  },
  get currentChannelType() { return state.currentChannelType; },
  set currentChannelType(v: 'channel' | 'dm') { state.currentChannelType = v; },
  get currentDMChannelName() { return state.currentDMChannelName; },
  set currentDMChannelName(v: string) { state.currentDMChannelName = v; },
  get isAdmin() { return state.isAdmin; },
  set isAdmin(v: boolean) {
    state.isAdmin = v;
    localStorage.setItem('omix_admin', v ? 'true' : '');
  },
  get displayName() { return state.displayName; },
  set displayName(v: string) {
    state.displayName = v;
    localStorage.setItem('omix_username', v);
  },
  get unreadCounts() { return state.unreadCounts; },
  get sessionId() { return getSessionId(); },

  // === DM CHANNELS ===
  get dmChannels() { return state.dmChannels; },

  subscribeDMChannels(cb: (dms: DMChannel[]) => void) {
    const currentUserId = getSessionId();
    const unsub = db.collection('dmChannels')
      .where('participants', 'array-contains', currentUserId)
      .onSnapshot((snap: firebase.firestore.QuerySnapshot) => {
        state.dmChannels = snap.docs.map(d => ({ id: d.id, ...d.data() } as DMChannel));
        state.dmChannelIds = new Set(snap.docs.map(d => d.id));
        // Update unread counts for DM channels based on lastMessageAt
        state.dmChannels.forEach(dm => {
          if (dm.id === state.currentChannelId) return; // Skip active channel
          if (!dm.lastMessageAt) return;
          const lastMsgTime = convertTimestamp(dm.lastMessageAt).getTime();
          const lastRead = parseInt(localStorage.getItem(`omix_read_${dm.id}`) || '0', 10);
          if (lastMsgTime > lastRead) {
            state.unreadCounts[dm.id] = Math.max(state.unreadCounts[dm.id] || 0, 1);
          }
        });
        this.saveUnread();
        notify('dmChannels', state.dmChannels);
        cb(state.dmChannels);
      });
    state.dmListeners.push(unsub);
    return unsub;
  },

  cleanupDMChannels() {
    state.dmListeners.forEach(u => u());
    state.dmListeners = [];
  },

  async createOrGetDMChannel(otherUserId: string): Promise<string> {
    const currentUserId = getSessionId();
    if (currentUserId === otherUserId) throw new Error('Cannot create DM with yourself');

    // Check if DM already exists
    const existingQuery = await db.collection('dmChannels')
      .where('participants', 'array-contains', currentUserId)
      .get();

    for (const doc of existingQuery.docs) {
      const data = doc.data() as DMChannel;
      if (data.participants.includes(otherUserId)) {
        return doc.id;
      }
    }

    // Create new DM channel
    const ref = await db.collection('dmChannels').add({
      participants: [currentUserId, otherUserId],
      participantNames: {
        [currentUserId]: state.displayName || 'Anonymous',
        [otherUserId]: state.onlineUsers.find(u => u.id === otherUserId)?.name || 'Unknown',
      },
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  },

  // === ADMIN ===
  async verifyAdminPassword(password: string): Promise<boolean> {
    const ref = db.collection('config').doc('settings');
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({ adminPassword: password });
      return true;
    }
    return snap.data()?.adminPassword === password;
  },

  // === SERVERS ===
  subscribeServers(cb: (type: string, data: Server[]) => void) {
    const unsub = db.collection('servers')
      .orderBy('name')
      .onSnapshot((snap: firebase.firestore.QuerySnapshot) => {
        state.servers = snap.docs.map(d => ({ id: d.id, ...d.data() } as Server));
        notify('servers', state.servers);
        cb('servers', state.servers);
      });
    state.listeners.push(unsub);
    return unsub;
  },

  async createServer(name: string): Promise<string> {
    if (!state.isAdmin) throw new Error('Only admins can create servers');
    const ref = await db.collection('servers').add({
      name: name.trim(),
      icon: '',
      ownerId: getSessionId(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  },

  async deleteServer(serverId: string): Promise<void> {
    if (!state.isAdmin) throw new Error('Admin only');
    // Delete all channels in this server
    const channels = await db.collection('channels').where('serverId', '==', serverId).get();
    const batch = db.batch();
    channels.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('servers').doc(serverId));
    await batch.commit();
  },

  async updateServer(serverId: string, data: { name?: string; icon?: string }): Promise<void> {
    await db.collection('servers').doc(serverId).update(data);
  },

  async uploadServerIcon(file: File, serverId: string): Promise<string> {
    if (file.size > 2 * 1024 * 1024) throw new Error('Image too large (max 2MB)');
    const ref = storage.ref(`server-icons/${serverId}/${Date.now()}_${file.name}`);
    const snapshot = await ref.put(file);
    const fileUrl = await snapshot.ref.getDownloadURL();
    await this.updateServer(serverId, { icon: fileUrl });
    return fileUrl;
  },

  async getServer(serverId: string): Promise<Server | null> {
    const doc = await db.collection('servers').doc(serverId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Server;
  },

  // === INVITES ===
  async createInvite(serverId: string): Promise<string> {
    const code = Math.random().toString(36).substring(2, 10);
    await db.collection('invites').doc(code).set({
      serverId,
      createdBy: getSessionId(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      uses: 0,
    });
    return code;
  },

  async joinServerByInvite(code: string): Promise<string | null> {
    const doc = await db.collection('invites').doc(code).get();
    if (!doc.exists) return null;
    const data = doc.data() as { serverId: string; uses: number };
    // Increment uses
    await doc.ref.update({ uses: firebase.firestore.FieldValue.increment(1) });
    return data.serverId;
  },

  // === CHANNELS ===
  subscribeChannels(serverId: string, cb: (type: string, data: Channel[]) => void) {
    this.cleanupTyping();
    this.cleanupPresence();
    this.cleanupPins();
    const unsub = db.collection('channels')
      .where('serverId', '==', serverId)
      .orderBy('name')
      .onSnapshot((snap: firebase.firestore.QuerySnapshot) => {
        state.channels = snap.docs.map(d => ({ id: d.id, ...d.data() } as Channel));
        notify('channels', state.channels);
        cb('channels', state.channels);
      });
    state.listeners.push(unsub);
    return unsub;
  },

  async createChannel(serverId: string, name: string, category = 'Text Channels', icon?: string): Promise<string> {
    const ref = await db.collection('channels').add({
      serverId,
      name: name.toLowerCase().replace(/\s+/g, '-'),
      category,
      type: 'text',
      icon: icon || '',
      position: state.channels.length,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    state.currentChannelId = ref.id;
    localStorage.setItem('omix_channel', ref.id);
    return ref.id;
  },

  async uploadChannelIcon(file: File, channelId: string): Promise<string> {
    if (file.size > 2 * 1024 * 1024) throw new Error('Image too large (max 2MB)');
    const ref = storage.ref(`channel-icons/${channelId}/${Date.now()}_${file.name}`);
    const snapshot = await ref.put(file);
    const fileUrl = await snapshot.ref.getDownloadURL();
    await db.collection('channels').doc(channelId).update({ icon: fileUrl });
    return fileUrl;
  },

  async deleteChannel(channelId: string): Promise<void> {
    if (!state.isAdmin) throw new Error('Admin only');
    await db.collection('channels').doc(channelId).delete();
  },

  // === MESSAGES ===
  subscribeMessages(channelId: string, cb: (type: string, data: Message[]) => void) {
    this.cleanupTyping();
    
    // Initialize pagination state for this channel
    if (!state.messagePagination.has(channelId)) {
      state.messagePagination.set(channelId, { oldestTimestamp: null, hasMore: true, loading: false });
    }
    
    // Subscribe to the latest PAGE_SIZE messages (using limitToLast for ASCENDING index compatibility)
    const unsub = db.collection('messages')
      .where('channelId', '==', channelId)
      .orderBy('timestamp', 'asc')
      .limitToLast(PAGE_SIZE)
      .onSnapshot((snap: firebase.firestore.QuerySnapshot) => {
        const docs = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            timestamp: convertTimestamp(data.timestamp),
            editedAt: data.editedAt ? convertTimestamp(data.editedAt) : undefined,
            pinnedAt: data.pinnedAt ? convertTimestamp(data.pinnedAt) : undefined,
          } as Message;
        })
        .filter(m => !m.pinned);
        
        state.messages = docs;
        
        // Update pagination state - track the oldest message timestamp as cursor
        const pagination = state.messagePagination.get(channelId);
        if (pagination && docs.length > 0) {
          const oldestMsg = docs[0];
          const oldestTime = oldestMsg.timestamp instanceof Date ? oldestMsg.timestamp.getTime() : convertTimestamp(oldestMsg.timestamp).getTime();
          pagination.oldestTimestamp = oldestTime;
          pagination.hasMore = docs.length === PAGE_SIZE;
        }
        
        notify('messages', state.messages);
        cb('messages', state.messages);
      });
    state.listeners.push(unsub);
    return unsub;
  },

  // Load more older messages for a channel (cursor-based pagination)
  async loadMoreMessages(channelId: string): Promise<Message[]> {
    const pagination = state.messagePagination.get(channelId);
    if (!pagination || !pagination.hasMore || pagination.loading) return [];
    
    pagination.loading = true;
    
    try {
      // Query for messages older than the oldest we have, limit to PAGE_SIZE
      const cutoff = new Date(pagination.oldestTimestamp!);
      const snap = await db.collection('messages')
        .where('channelId', '==', channelId)
        .where('timestamp', '<', cutoff)
        .orderBy('timestamp', 'asc')
        .limit(PAGE_SIZE)
        .get();
      
      const olderMessages = snap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            timestamp: convertTimestamp(data.timestamp),
            editedAt: data.editedAt ? convertTimestamp(data.editedAt) : undefined,
            pinnedAt: data.pinnedAt ? convertTimestamp(data.pinnedAt) : undefined,
          } as Message;
        })
        .filter(m => !m.pinned);
      
      if (olderMessages.length > 0) {
        // Prepend older messages to the current list
        state.messages = [...olderMessages, ...state.messages];
        
        // Update pagination cursor
        const oldestMsg = olderMessages[0];
        pagination.oldestTimestamp = oldestMsg.timestamp instanceof Date ? oldestMsg.timestamp.getTime() : convertTimestamp(oldestMsg.timestamp).getTime();
        pagination.hasMore = olderMessages.length === PAGE_SIZE;
        
        notify('messages', state.messages);
      } else {
        pagination.hasMore = false;
      }
      
      return olderMessages;
    } finally {
      pagination.loading = false;
    }
  },

  // Get pagination state for a channel
  getPaginationState(channelId: string) {
    return state.messagePagination.get(channelId) || { oldestTimestamp: null, hasMore: false, loading: false };
  },

  // Delete messages older than specified days (retention cleanup)
  async deleteOldMessages(days: number = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    let deletedCount = 0;
    const channels = [...state.channels, ...state.dmChannels.map(dm => ({ id: dm.id } as Channel))];
    
    for (const channel of channels) {
      const snap = await db.collection('messages')
        .where('channelId', '==', channel.id)
        .where('timestamp', '<', cutoff)
        .orderBy('timestamp', 'asc')
        .limit(500) // Batch delete to avoid timeout
        .get();
      
      if (snap.empty) continue;
      
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      deletedCount += snap.docs.length;
    }
    
    return deletedCount;
  },

  // Run retention cleanup on app init (client-side sweep)
  async runRetentionCleanup(days: number = 30): Promise<void> {
    try {
      const deleted = await this.deleteOldMessages(days);
      if (deleted > 0) {
        console.log(`Retention cleanup: deleted ${deleted} messages older than ${days} days`);
      }
    } catch (err) {
      console.warn('Retention cleanup failed:', err);
    }
  },

  subscribeThread(threadId: string, cb: (type: string, data: Message[]) => void) {
    const unsub = db.collection('messages')
      .where('threadId', '==', threadId)
      .orderBy('timestamp', 'asc')
      .onSnapshot((snap: firebase.firestore.QuerySnapshot) => {
        const msgs = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            timestamp: convertTimestamp(data.timestamp),
            editedAt: data.editedAt ? convertTimestamp(data.editedAt) : undefined,
          } as Message;
        });
        cb('thread', msgs);
      });
    state.listeners.push(unsub);
    return unsub;
  },

  getMessageThreadCount(messageId: string, messages: Message[]): number {
    return messages.filter(m => m.threadId === messageId).length;
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
      replyTo?: Message['replyTo'];
      mentions?: string[];
      threadId?: string;
    } = {}
  ): Promise<void> {
    if (!text.trim() && !opts.fileUrl) return;
    const msg: Record<string, unknown> = {
      channelId,
      author: displayName || 'Anonymous',
      authorId: getSessionId(),
      sessionId: getSessionId(),
      text: text.trim(),
      color: getUserColor(displayName),
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      reactions: {},
    };
    if (opts.fileUrl) {
      msg.fileUrl = opts.fileUrl;
      msg.fileType = opts.fileType || 'image';
      if (opts.fileName) msg.fileName = opts.fileName;
      if (opts.fileSize) msg.fileSize = opts.fileSize;
    }
    if (opts.replyTo) msg.replyTo = opts.replyTo;
    if (opts.mentions) msg.mentions = opts.mentions;
    if (opts.threadId) msg.threadId = opts.threadId;
    
    await db.collection('messages').add(msg);
    
    // Update DM channel last message info
    if (state.dmChannelIds.has(channelId)) {
      const dmRef = db.collection('dmChannels').doc(channelId);
      await dmRef.update({
        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessageText: text.trim().substring(0, 100),
        lastMessageAuthor: displayName || 'Anonymous',
      });
    }
    
    // Increment unread for other channels (non-current)
    if (channelId !== state.currentChannelId) {
      this.incrementUnread(channelId);
    }

    // Award XP for sending a message
    this.awardXP(this.XP_RULES.MESSAGE_SENT, 'message').catch(() => {});

    // Award reply XP to parent message author if this is a thread reply
    if (opts.threadId) {
      try {
        const parentSnap = await db.collection('messages').doc(opts.threadId).get();
        if (parentSnap.exists) {
          const parentData = parentSnap.data() as Message;
          if (parentData.sessionId && parentData.sessionId !== getSessionId()) {
            const parentRef = db.collection('stats').doc(parentData.sessionId);
            await parentRef.set({
              repliesReceived: firebase.firestore.FieldValue.increment(1),
            }, { merge: true });
            const parentStats = await this.getStats(parentData.sessionId);
            parentStats.repliesReceived = (parentStats.repliesReceived || 0) + 1;
            parentStats.badges = this.getBadgesForStats(parentStats);
            await parentRef.set({ badges: parentStats.badges }, { merge: true });
          }
        }
      } catch { /* fail silently */ }
    }
  },

  async editMessage(messageId: string, newText: string): Promise<void> {
    await db.collection('messages').doc(messageId).update({
      text: newText.trim(),
      edited: true,
      editedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  },

  async deleteMessage(messageId: string): Promise<void> {
    await db.collection('messages').doc(messageId).delete();
  },

  // === PINS ===
  async togglePin(messageId: string): Promise<void> {
    if (!state.isAdmin) throw new Error('Admin only');
    const ref = db.collection('messages').doc(messageId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data() as Message;
    if (data.pinned) {
      await ref.update({ pinned: false });
    } else {
      await ref.update({ pinned: true, pinnedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
  },

  subscribePins(channelId: string, cb: (pins: Message[]) => void) {
    const unsub = db.collection('messages')
      .where('channelId', '==', channelId)
      .where('pinned', '==', true)
      .onSnapshot((snap: firebase.firestore.QuerySnapshot) => {
        const pins = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          timestamp: convertTimestamp(d.data().timestamp),
        } as Message));
        state.pinnedMessages = pins;
        notify('pins', pins);
        cb(pins);
      });
    state.pinListeners.push(unsub);
    return unsub;
  },

  cleanupPins() {
    state.pinListeners.forEach(u => u());
    state.pinListeners = [];
  },

  // === REACTIONS ===
  async toggleReaction(messageId: string, emoji: string, displayName: string): Promise<void> {
    const ref = db.collection('messages').doc(messageId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data() as Message;
    const reactions = data.reactions || {};
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
    await ref.update({ reactions });

    // Award XP to message author when someone else reacts to their message
    if (wasNew && data.sessionId !== getSessionId() && data.authorId) {
      const authorRef = db.collection('stats').doc(data.authorId);
      await authorRef.set({
        reactionsReceived: firebase.firestore.FieldValue.increment(1),
      }, { merge: true });
      // Check and update badges for the author
      const authorStats = await this.getStats(data.authorId);
      authorStats.reactionsReceived = (authorStats.reactionsReceived || 0) + 1;
      authorStats.badges = this.getBadgesForStats(authorStats);
      await authorRef.set({ badges: authorStats.badges }, { merge: true });
    }
  },

  // === TYPING ===
  startTyping(channelId: string, displayName: string): void {
    if (!channelId || !displayName) return;
    const ref = db.collection('typing').doc(`${channelId}_${getSessionId()}`);
    ref.set({
      channelId,
      name: displayName,
      sessionId: getSessionId(),
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    setTimeout(() => ref.delete().catch(() => {}), TYPING_TIMEOUT);
  },

  stopTyping(channelId: string): void {
    if (!channelId) return;
    db.collection('typing').doc(`${channelId}_${getSessionId()}`).delete().catch(() => {});
  },

  subscribeTyping(channelId: string, cb: (users: TypingUser[]) => void) {
    if (!channelId) return () => {};
    const unsub = db.collection('typing')
      .where('channelId', '==', channelId)
      .onSnapshot((snap: firebase.firestore.QuerySnapshot) => {
        const users = snap.docs
          .map(d => d.data() as TypingUser)
          .filter(u => u.sessionId !== getSessionId() && u.name);
        state.typingUsers = users;
        cb(users);
      });
    state.typingListeners.push(unsub);
    return unsub;
  },

  cleanupTyping() {
    state.typingListeners.forEach(u => u());
    state.typingListeners = [];
  },

  // === PRESENCE ===
  async setPresence(displayName: string): Promise<void> {
    const ref = db.collection('presence').doc(getSessionId());
    const heartbeat = () => ref.update({
      online: true,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await ref.set({
      name: displayName,
      online: true,
      color: getUserColor(displayName),
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    });
    setInterval(heartbeat, 30000);
    window.addEventListener('beforeunload', () => ref.update({ online: false }));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ref.update({ online: false });
      else ref.update({ online: true, lastSeen: firebase.firestore.FieldValue.serverTimestamp() });
    });
  },

  subscribePresence(cb: (users: User[]) => void) {
    const unsub = db.collection('presence')
      .where('online', '==', true)
      .onSnapshot((snap: firebase.firestore.QuerySnapshot) => {
        const users = snap.docs.map(d => {
          const data = d.data();
          return { name: data.name, id: d.id, color: data.color } as User;
        });
        state.onlineUsers = users;
        cb(users);
      });
    state.presenceListeners.push(unsub);
    return unsub;
  },

  cleanupPresence() {
    state.presenceListeners.forEach(u => u());
    state.presenceListeners = [];
  },

  // === FILE UPLOAD ===

  async uploadFile(file: File, channelId: string, displayName: string): Promise<void> {
    if (file.size > 20 * 1024 * 1024) throw new Error('File too large (max 20MB)');
    const ref = storage.ref(`chat/${channelId}/${Date.now()}_${file.name}`);
    const snapshot = await ref.put(file);
    const fileUrl = await snapshot.ref.getDownloadURL();
    await this.sendMessage(channelId, '', displayName, {
      fileUrl,
      fileType: file.type,
      fileName: file.name,
      fileSize: file.size,
    });
  },

  // === VIEW ONCE ===
  async uploadViewOnceFile(file: File, channelId: string, displayName: string): Promise<void> {
    if (file.size > 20 * 1024 * 1024) throw new Error('File too large (max 20MB)');
    // Add a nonce so we can update the message after it's created
    const nonce = `vo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const ref = storage.ref(`view-once/${channelId}/${nonce}_${file.name}`);
    const snapshot = await ref.put(file);
    const fileUrl = await snapshot.ref.getDownloadURL();
    // Send with viewOnce flag — the nonce helps us match it
    await this.sendMessage(channelId, '', displayName, {
      fileUrl,
      fileType: file.type,
      fileName: file.name,
      fileSize: file.size,
    });
    // Mark the most recent message as view-once
    const msgs = await db.collection('messages')
      .where('channelId', '==', channelId)
      .where('authorId', '==', getSessionId())
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    if (!msgs.empty) {
      const msg = msgs.docs[0];
      await msg.ref.update({
        viewOnce: true,
        viewOnceViewed: false,
      });
    }
  },

  async markViewOnceViewed(messageId: string): Promise<void> {
    await db.collection('messages').doc(messageId).update({
      viewOnceViewed: true,
      viewOnceViewedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    // Optionally delete from Storage to truly enforce view-once
    try {
      const snap = await db.collection('messages').doc(messageId).get();
      if (snap.exists) {
        snap.data() as Message;
        // Revoke the URL client-side — Storage file stays (Firebase Storage delete needs admin SDK)
      }
    } catch { /* best effort */ }
  },

  // === UNREAD ===
  markChannelRead(channelId: string) {
    state.unreadCounts[channelId] = 0;
    this.saveUnread();
    try { localStorage.setItem(`omix_read_${channelId}`, Date.now().toString()); } catch {}
  },

  incrementUnread(channelId: string) {
    if (channelId === state.currentChannelId) return;
    state.unreadCounts[channelId] = (state.unreadCounts[channelId] || 0) + 1;
    this.saveUnread();
  },

  saveUnread() {
    try { localStorage.setItem('omix_unread', JSON.stringify(state.unreadCounts)); } catch {}
  },

  // === XP & BADGES ===
  XP_RULES: {
    MESSAGE_SENT: 10,
    REACTION_RECEIVED: 5,
    REPLY_RECEIVED: 15,
    DAILY_BONUS: 20,
    STREAK_BONUS: 50,
  } as Record<string, number>,

  BADGES: [
    { id: 'first_message', name: 'First Message', desc: 'Send your first message', icon: 'message-circle', xpRequired: 0 },
    { id: 'chatter', name: 'Chatter', desc: 'Send 100 messages', icon: 'message-square', xpRequired: 0 },
    { id: 'popular', name: 'Popular', desc: 'Get 10 reactions', icon: 'thumbs-up', xpRequired: 0 },
    { id: 'helper', name: 'Helper', desc: 'Get 10 replies', icon: 'reply', xpRequired: 0 },
    { id: 'veteran', name: 'Veteran', desc: 'Reach level 10', icon: 'shield', xpRequired: 0 },
    { id: 'streak_3', name: 'Streak Master', desc: 'Chat 3 days in a row', icon: 'calendar', xpRequired: 0 },
    { id: 'social', name: 'Social Butterfly', desc: 'React to 20 messages', icon: 'users', xpRequired: 0 },
  ],

  getLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  },

  getXPForLevel(level: number): number {
    return (level - 1) ** 2 * 100;
  },

  getBadgesForStats(stats: Partial<UserStats>): string[] {
    const badges: string[] = [];
    const msgs = stats.messagesSent || 0;
    const reactions = stats.reactionsReceived || 0;
    const replies = stats.repliesReceived || 0;
    const xp = stats.xp || 0;
    const level = this.getLevel(xp);

    if (msgs >= 1) badges.push('first_message');
    if (msgs >= 100) badges.push('chatter');
    if (reactions >= 10) badges.push('popular');
    if (replies >= 10) badges.push('helper');
    if (level >= 10) badges.push('veteran');
    if (stats.lastMessageDate) {
      const streakCount = (stats as Record<string, unknown>).streakCount as number || 0;
      if (streakCount >= 3) badges.push('streak_3');
    }
    return badges;
  },

  async getStats(sessionId?: string): Promise<UserStats> {
    const uid = sessionId || getSessionId();
    const snap = await db.collection('stats').doc(uid).get();
    if (snap.exists) {
      return snap.data() as UserStats;
    }
    return { xp: 0, level: 1, messagesSent: 0, reactionsReceived: 0, repliesReceived: 0, badges: [], joinDate: new Date().toISOString().split('T')[0] };
  },

  subscribeStats(cb: (stats: UserStats) => void) {
    const uid = getSessionId();
    return db.collection('stats').doc(uid)
      .onSnapshot((snap: firebase.firestore.DocumentSnapshot) => {
        if (snap.exists) {
          cb(snap.data() as UserStats);
        } else {
          cb({ xp: 0, level: 1, messagesSent: 0, reactionsReceived: 0, repliesReceived: 0, badges: [], joinDate: new Date().toISOString().split('T')[0] });
        }
      });
  },

  async awardXP(amount: number, reason: string): Promise<void> {
    const uid = getSessionId();
    const ref = db.collection('stats').doc(uid);
    const today = new Date().toISOString().split('T')[0];

    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const data = (doc.exists ? doc.data() : { xp: 0, messagesSent: 0, reactionsReceived: 0, repliesReceived: 0, badges: [], lastMessageDate: '', streakCount: 0 }) as UserStats;

      data.xp = (data.xp || 0) + amount;
      data.level = this.getLevel(data.xp);
      
      // Streak tracking
      if (reason === 'message') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        if (data.lastMessageDate === yesterdayStr) {
          data.streakCount = (data.streakCount || 0) + 1;
        } else if (data.lastMessageDate !== today) {
          data.streakCount = 1;
        }
      }
      
      data.lastMessageDate = today;

      if (reason === 'message') data.messagesSent = (data.messagesSent || 0) + 1;
      if (reason === 'reaction') data.reactionsReceived = (data.reactionsReceived || 0) + 1;
      if (reason === 'reply') data.repliesReceived = (data.repliesReceived || 0) + 1;

      // Check for new badges
      data.badges = this.getBadgesForStats(data);

      tx.set(ref, data, { merge: true });
    });
  },

  // === FCM / PUSH NOTIFICATIONS ===
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'denied') return false;
    if (Notification.permission === 'granted') {
      await this.saveFCMToken();
      return true;
    }
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      await this.saveFCMToken();
      return true;
    }
    return false;
  },

  async saveFCMToken(): Promise<string | null> {
    try {
      const { messaging } = await import('./firebase');
      if (!messaging) return null;
      const token = await messaging.getToken();
      if (token) {
        await db.collection('fcmTokens').doc(getSessionId()).set({
          token,
          userId: getSessionId(),
          displayName: state.displayName,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
      return token;
    } catch (err) {
      console.warn('FCM token error:', err);
      return null;
    }
  },

  async sendPushNotification(userId: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
    try {
      await db.collection('notifications').add({
        targetUserId: userId,
        title,
        body,
        data: data || {},
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        sent: false,
      });
    } catch (err) {
      console.error('Failed to queue push notification:', err);
    }
  },

  // === CLEANUP ===
  cleanup() {
    state.listeners.forEach(u => u());
    state.listeners = [];
    this.cleanupTyping();
    this.cleanupPresence();
    this.cleanupPins();
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
    const ref = db.collection('profiles').doc(getSessionId());
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.avatar !== undefined) update.avatar = data.avatar;
    update.color = getUserColor(data.name || state.displayName || 'Guest');
    update.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await ref.set(update, { merge: true });
    // Update local cache
    this.profileCache[getSessionId()] = {
      name: data.name || state.displayName || 'Guest',
      avatar: data.avatar || '',
      color: getUserColor(data.name || state.displayName || 'Guest'),
    };
    notify('profile', { sessionId: getSessionId(), ...this.profileCache[getSessionId()] });
  },

  async getProfile(sessionId: string): Promise<{ name: string; avatar: string; color: string } | null> {
    // Check cache first
    if (this.profileCache[sessionId]) return this.profileCache[sessionId];
    const snap = await db.collection('profiles').doc(sessionId).get();
    if (snap.exists) {
      const data = snap.data() as { name: string; avatar: string; color: string };
      this.profileCache[sessionId] = data;
      return data;
    }
    return null;
  },

  async uploadAvatar(file: File): Promise<string> {
    if (file.size > 2 * 1024 * 1024) throw new Error('Image too large (max 2MB)');
    const ref = storage.ref(`avatars/${getSessionId()}/${Date.now()}_${file.name}`);
    const snapshot = await ref.put(file);
    const fileUrl = await snapshot.ref.getDownloadURL();
    await this.saveProfile({ avatar: fileUrl });
    return fileUrl;
  },

  subscribeProfile(cb: (profile: { sessionId: string; name: string; avatar: string; color: string }) => void) {
    const unsub = db.collection('profiles').doc(getSessionId())
      .onSnapshot((snap: firebase.firestore.DocumentSnapshot) => {
        if (snap.exists) {
          const data = snap.data() as { name: string; avatar: string; color: string };
          this.profileCache[getSessionId()] = data;
          cb({ sessionId: getSessionId(), ...data });
        }
      });
    state.listeners.push(unsub);
    return unsub;
  },
};

export { getSessionId, getUserColor };