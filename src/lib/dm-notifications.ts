export interface DMNotification {
  channelId: string;
  senderId: string;
  senderName: string;
  preview: string;
  createdAt: number;
}

const EVENT = "omix:dm-notification";

export function emitDMNotification(notification: DMNotification) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<DMNotification>(EVENT, { detail: notification }));
}

export function subscribeDMNotifications(handler: (notification: DMNotification) => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) => handler((event as CustomEvent<DMNotification>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export function getDMNotificationTitle(notification: DMNotification) {
  return `New message from ${notification.senderName}`;
}
