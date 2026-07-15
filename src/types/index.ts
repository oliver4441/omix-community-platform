export interface Session {
  id: string;
  username: string;
  isAdmin: boolean;
}

export interface User {
  id: string;
  name: string;
  color: string;
  online: boolean;
  avatar?: string;
  status?: 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';
  customStatus?: string;
  bio?: string;
  mutualServers?: string[];
}

export interface Server {
  id: string;
  name: string;
  icon?: string;
  ownerId: string;
  createdAt: Date | { toDate: () => Date };
  members?: string[];
  roles?: Role[];
}

export interface Role {
  id: string;
  name: string;
  color: string;
  permissions: string[];
  position: number;
}

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  category: string;
  type: 'text' | 'voice' | 'category' | 'announcement';
  topic?: string;
  nsfw?: boolean;
  position: number;
  createdAt: Date | { toDate: () => Date };
  permissionOverwrites?: PermissionOverwrite[];
}

export interface PermissionOverwrite {
  id: string;
  type: 'role' | 'member';
  allow: string[];
  deny: string[];
}

export interface Message {
  id: string;
  channelId: string;
  author: string;
  authorId: string;
  sessionId: string;
  text: string;
  color: string;
  timestamp: Date | { toDate: () => Date };
  reactions: Record<string, string[]>;
  edited?: boolean;
  editedAt?: Date | { toDate: () => Date };
  pinned?: boolean;
  pinnedAt?: Date | { toDate: () => Date };
  fileUrl?: string;
  fileType?: string;
  fileName?: string;
  fileSize?: number;
  replyTo?: {
    id: string;
    author: string;
    text: string;
  };
  threadId?: string;
  mentions?: string[];
  nonce?: string;
}

export interface Reaction {
  emoji: string;
  users: string[];
  count: number;
}

export interface TypingUser {
  name: string;
  sessionId: string;
  channelId: string;
}

export interface UnreadCounts {
  [channelId: string]: number;
}

export interface Invite {
  id: string;
  code: string;
  serverId: string;
  channelId?: string;
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date;
  maxUses?: number;
  uses: number;
  temporary: boolean;
}

export interface NotificationSettings {
  allMessages: boolean;
  onlyMentions: boolean;
  nothing: boolean;
  mobilePush: boolean;
  desktopPush: boolean;
}

export interface UserSettings {
  theme: 'dark' | 'light' | 'system';
  compactMode: boolean;
  showAvatars: boolean;
  messageDisplay: 'cozy' | 'compact';
  reducedMotion: boolean;
  notifications: NotificationSettings;
  language: string;
  keyboardShortcuts: boolean;
}

export interface Thread {
  id: string;
  channelId: string;
  messageId: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  archived: boolean;
  locked: boolean;
  autoArchiveDuration: number;
  memberCount: number;
}

export interface VoiceState {
  userId: string;
  channelId: string;
  sessionId: string;
  deaf: boolean;
  mute: boolean;
  selfDeaf: boolean;
  selfMute: boolean;
  streaming: boolean;
  video: boolean;
  joinedAt: Date;
}

export interface FileAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
  messageId?: string;
}