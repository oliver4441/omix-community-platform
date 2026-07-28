export interface User {
  id: string;
  name: string;
  color: string;
  online: boolean;
  avatar?: string;
  status?: "online" | "idle" | "dnd" | "invisible" | "offline";
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
  type: "text" | "voice" | "category" | "announcement";
  topic?: string;
  nsfw?: boolean;
  position: number;
  icon?: string;
  createdAt: Date | { toDate: () => Date };
  permissionOverwrites?: PermissionOverwrite[];
}

export interface PermissionOverwrite {
  id: string;
  type: "role" | "member";
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
    color?: string;
  };
  threadId?: string;
  mentions?: string[];
  nonce?: string;
  viewOnce?: boolean;
  viewOnceViewed?: boolean;
  viewOnceViewedAt?: Date | { toDate: () => Date };
}

export interface TypingUser {
  name: string;
  sessionId: string;
  channelId: string;
}

export interface UnreadCounts {
  [channelId: string]: number;
}

export interface UserStats {
  xp: number;
  level: number;
  messagesSent: number;
  reactionsReceived: number;
  repliesReceived: number;
  badges: string[];
  lastMessageDate?: string;
  joinDate?: string;
  streakCount?: number;
}

export interface DMChannel {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  createdAt: Date | { toDate: () => Date };
  lastMessageAt?: Date | { toDate: () => Date };
  lastMessageText?: string;
  lastMessageAuthor?: string;
}

export interface DMChannelWithDetails extends DMChannel {
  otherUser: User;
  unreadCount: number;
}

export interface ActiveCall {
  channelId: string;
  channelName: string;
  roomName: string;
  startedBy: string;
  startedByDisplayName: string;
  startedAt: Date | { toDate: () => Date };
  active: boolean;
  participantCount: number;
}
