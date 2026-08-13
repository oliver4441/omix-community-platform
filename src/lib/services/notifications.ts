/**
 * Notification center service (client).
 *
 * Polls unread count on an interval (shared/refcounted), keeps a lightweight
 * in-memory cache of recent notifications, and exposes mark-read actions.
 */
import { api } from "@/lib/api";
import { pollRef } from "./subscriptions";
import { publish } from "./events";

export interface ClientNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface NotificationOverride {
  id: string;
  scope: "channel" | "thread";
  targetId: string;
  level: "default" | "all" | "mentions" | "muted";
}

let unread = 0;
let cached: ClientNotification[] = [];

export function getUnreadCount(): number {
  return unread;
}

export function getCachedNotifications(): ClientNotification[] {
  return cached;
}

export async function refreshUnread(): Promise<void> {
  try {
    const { count } = await api.notifications.unreadCount();
    if (count !== unread) {
      unread = count;
      publish("notifications:unread", { count });
    }
  } catch {
    /* offline — keep last known count */
  }
}

export function subscribeUnread(cb: (count: number) => void): () => void {
  return pollRef("notifications:unread", () => {
    refreshUnread().then(() => cb(unread));
  }, 20_000);
}

export async function fetchNotifications(limit = 50): Promise<ClientNotification[]> {
  try {
    const rows = await api.notifications.list(limit);
    cached = rows;
    return rows;
  } catch {
    return cached;
  }
}

export async function markRead(ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await api.notifications.markRead(id);
    } catch {
      /* offline — retried next poll */
    }
  }
  cached = cached.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n));
  unread = Math.max(0, unread - ids.length);
  publish("notifications:unread", { count: unread });
}

export async function markAllRead(): Promise<void> {
  try {
    await api.notifications.markAllRead();
  } catch {
    /* offline */
  }
  cached = cached.map((n) => ({ ...n, read: true }));
  unread = 0;
  publish("notifications:unread", { count: 0 });
}

export async function fetchOverrides(): Promise<NotificationOverride[]> {
  try {
    const rows = await api.notifications.listOverrides();
    return rows.map((r) => ({
      ...r,
      level: r.level as NotificationOverride["level"],
    }));
  } catch {
    return [];
  }
}

export async function setOverride(
  targetId: string,
  level: "default" | "all" | "mentions" | "muted",
  scope: "channel" | "thread" = "channel"
): Promise<void> {
  await api.notifications.putOverride({ scope, targetId, level });
}

export async function clearOverride(id: string): Promise<void> {
  await api.notifications.deleteOverride(id);
}
