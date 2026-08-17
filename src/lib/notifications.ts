export type OmixNotificationType = "dm" | "call" | "follow" | "reward" | "system";

export interface OmixNotification {
  id: string;
  type: OmixNotificationType;
  title: string;
  body?: string;
  href?: string;
  createdAt: number;
  read: boolean;
}

const STORAGE_KEY = "omix:notifications";
const EVENT = "omix:notifications-changed";

function read(): OmixNotification[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}

function write(items: OmixNotification[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 100)));
  window.dispatchEvent(new Event(EVENT));
}

export function addNotification(notification: OmixNotification) {
  const items = read().filter((item) => item.id !== notification.id);
  write([notification, ...items]);
  if (!notification.read) showBrowserNotification(notification);
}

export function showBrowserNotification(notification: OmixNotification) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(notification.title, { body: notification.body, tag: `omix-${notification.id}` });
    if (notification.href) n.onclick = () => { window.focus(); window.location.assign(notification.href!); };
  } catch {}
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

export function markNotificationRead(id: string) {
  write(read().map((item) => item.id === id ? { ...item, read: true } : item));
}

export function markAllNotificationsRead() {
  write(read().map((item) => ({ ...item, read: true })));
}

export function getNotifications() { return read(); }
export function getUnreadNotificationCount() { return read().filter((item) => !item.read).length; }

export function subscribeNotifications(handler: (items: OmixNotification[]) => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = () => handler(read());
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  listener();
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener("storage", listener); };
}
