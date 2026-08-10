import * as Ably from "ably";
import type { ConnectionStateChange } from "ably";
import { ChatClient, LogLevel } from "@ably/chat";
import type { Room } from "@ably/chat";
import { getAblyAuthUrl } from "@/lib/api";

// Fallback key — used only until the omix-gateway worker is deployed and
// NEXT_PUBLIC_API_BASE_URL is set (then the key can be removed entirely).
const ABLY_KEY = "DLQnWQ.ilKOxQ:aBK0tJBczKW2zUJ04TsRUkgpT0l4T5gMMiRc_3-UkVg";

let chatClient: ChatClient | null = null;
let connected = false;

function getClientId(): string {
  if (typeof window === "undefined") return "anon";
  try {
    const uid = localStorage.getItem("os_uid");
    if (uid) return uid;
  } catch {}
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function isAblyConnected(): boolean {
  return connected;
}

export function onAblyConnectionState(cb: (connected: boolean) => void): () => void {
  const realtime = getChatClient().realtime;
  const handler = (stateChange: ConnectionStateChange) => {
    cb(stateChange.current === "connected");
  };
  realtime.connection.on(handler);
  cb(realtime.connection.state === "connected");
  return () => realtime.connection.off(handler);
}

export function getChatClient(): ChatClient {
  if (!chatClient) {
    const clientId = getClientId();
    const authUrl = getAblyAuthUrl();
    const realtime = new Ably.Realtime(
      authUrl ? { authUrl, clientId } : { key: ABLY_KEY, clientId }
    );
    realtime.connection.on((stateChange) => {
      connected = stateChange.current === "connected";
      if (stateChange.current === "failed") {
        console.warn("[ably] connection failed — falling back to polling");
      }
    });
    chatClient = new ChatClient(realtime, { logLevel: LogLevel.Warn });
  }
  return chatClient;
}

export function getRoomId(channelId: string, isDM: boolean): string {
  return isDM ? `dm-${channelId}` : `chat-${channelId}`;
}

const roomCache = new Map<string, Promise<Room>>();

export function getRoom(roomId: string): Promise<Room> {
  if (!roomCache.has(roomId)) {
    const pending = getChatClient()
      .rooms.get(roomId, {
        presence: { enableEvents: true },
        typing: { heartbeatThrottleMs: 800 },
        occupancy: { enableEvents: false },
      })
      .then((room) => room.attach().then(() => room));
    roomCache.set(roomId, pending);
  }
  return roomCache.get(roomId)!;
}

export function releaseRoom(roomId: string): void {
  const pending = roomCache.get(roomId);
  roomCache.delete(roomId);
  if (pending) {
    pending.then((room) => getChatClient().rooms.release(room.name)).catch(() => {});
  }
}
