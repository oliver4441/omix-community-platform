import { db, firebase } from './firebase';
import type { Message, Channel, Server, User, UnreadCounts, TypingUser } from '../types';

const SESSION_ID = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
const TYPING_TIMEOUT = 3000;

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

interface StoreState {
  servers: Server[];
  channels: Channel[];
  messages: Message[];
  pinnedMessages: Message[];
  typingUsers: TypingUser[];
  onlineUsers: User[];
  currentServerId: string;
  currentChannelId: string;
  isAdmin: boolean;
  displayName: string;
  listeners: Listener[];
  typingListeners: Listener[];
  presenceListeners: Listener[];
  pinListeners: Listener[];
  unreadCounts: UnreadCounts;
}

const state: StoreState = {
  servers: [],
  channels: [],
  messages: [],
  pinnedMessages: [],
  typingUsers: [],
  onlineUsers: [],
  currentServerId: localStorage.getItem('omix_server') || 'server1',
  currentChannelId: localStorage.getItem('omix_channel') || 'channel1',
  isAdmin: localStorage.getItem('omix_admin') === 'true',
  displayName: localStorage.getItem('omix_username') || '',
  listeners: [],
  typingListeners: [],
  presenceListeners: [],
  pinListeners: [],
  unreadCounts: {},
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
  get sessionId() { return SESSION_ID; },

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
    const ref = await db.collection('servers').add({
      name: name.trim(),
      icon: '',
      ownerId: SESSION_ID,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  },

  async deleteServer(serverId: string): Promise<void> {
    if (!state.isAdmin) throw new Error('Admin only');
    await db.collection('servers').doc(serverId).delete();
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

  async createChannel(serverId: string, name: string, category = 'Text Channels'): Promise<string> {
    const ref = await db.collection('channels').add({
      serverId,
      name: name.toLowerCase().replace(/\s+/g, '-'),
      category,
      type: 'text',
      position: state.channels.length,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    state.currentChannelId = ref.id;
    localStorage.setItem('omix_channel', ref.id);
    return ref.id;
  },

  async deleteChannel(channelId: string): Promise<void> {
    if (!state.isAdmin) throw new Error('Admin only');
    await db.collection('channels').doc(channelId).delete();
  },

  // === MESSAGES ===
  subscribeMessages(channelId: string, cb: (type: string, data: Message[]) => void) {
    this.cleanupTyping();
    const unsub = db.collection('messages')
      .where('channelId', '==', channelId)
      .orderBy('timestamp', 'asc')
      .onSnapshot((snap: firebase.firestore.QuerySnapshot) => {
        state.messages = snap.docs
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
        notify('messages', state.messages);
        cb('messages', state.messages);
      });
    state.listeners.push(unsub);
    return unsub;
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
    } = {}
  ): Promise<void> {
    if (!text.trim() && !opts.fileUrl) return;
    const msg = {
      channelId,
      author: displayName || 'Anonymous',
      authorId: SESSION_ID,
      sessionId: SESSION_ID,
      text: text.trim(),
      color: getUserColor(displayName),
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      reactions: {},
      ...(opts.fileUrl && { fileUrl: opts.fileUrl, fileType: opts.fileType || 'image', fileName: opts.fileName, fileSize: opts.fileSize }),
      ...(opts.replyTo && { replyTo: opts.replyTo }),
      ...(opts.mentions && { mentions: opts.mentions }),
    };
    await db.collection('messages').add(msg);
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
    if (idx > -1) {
      users.splice(idx, 1);
      if (users.length === 0) delete reactions[emoji];
      else reactions[emoji] = users;
    } else {
      users.push(displayName);
      reactions[emoji] = users;
    }
    await ref.update({ reactions });
  },

  // === TYPING ===
  startTyping(channelId: string, displayName: string): void {
    if (!channelId || !displayName) return;
    const ref = db.collection('typing').doc(`${channelId}_${SESSION_ID}`);
    await ref.set({
      channelId,
      name: displayName,
      sessionId: SESSION_ID,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
    setTimeout(() => ref.delete().catch(() => {}), TYPING_TIMEOUT);
  },

  stopTyping(channelId: string): void {
    if (!channelId) return;
    db.collection('typing').doc(`${channelId}_${SESSION_ID}`).delete().catch(() => {});
  },

  subscribeTyping(channelId: string, cb: (users: TypingUser[]) => void) {
    if (!channelId) return () => {};
    const unsub = db.collection('typing')
      .where('channelId', '==', channelId)
      .onSnapshot((snap: firebase.firestore.QuerySnapshot) => {
        const users = snap.docs
          .map(d => d.data() as TypingUser)
          .filter(u => u.sessionId !== SESSION_ID && u.name);
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
    const ref = db.collection('presence').doc(SESSION_ID);
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
    return new Promise((resolve, reject) => {
      if (file.size > 5 * 1024 * 1024) { reject('File too large'); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        this.sendMessage(channelId, '', displayName, { fileUrl: e.target?.result as string, fileType: file.type });
        resolve();
      };
      reader.onerror = () => reject('Failed to read file');
      reader.readAsDataURL(file);
    });
  },

  // === UNREAD ===
  markChannelRead(channelId: string) {
    state.unreadCounts[channelId] = 0;
    this.saveUnread();
  },

  incrementUnread(channelId: string) {
    if (channelId === state.currentChannelId) return;
    state.unreadCounts[channelId] = (state.unreadCounts[channelId] || 0) + 1;
    this.saveUnread();
  },

  saveUnread() {
    try { localStorage.setItem('omix_unread', JSON.stringify(state.unreadCounts)); } catch {}
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
};

export { SESSION_ID, getUserColor };