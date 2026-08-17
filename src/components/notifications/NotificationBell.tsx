"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Store } from "@/lib/store";
import { addNotification, getDMSeenAt, markAllNotificationsRead, markNotificationRead, requestBrowserNotifications, setDMSeenAt, showBrowserNotification, subscribeNotifications, type OmixNotification } from "@/lib/notifications";

export function NotificationBell() {
  const [items, setItems] = useState<OmixNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeNotifications(setItems), []);

  // DMChannel polling is already the Store's fallback synchronization path.
  // Turn a newly observed remote message into a local notification without
  // adding another polling loop or another realtime provider.
  useEffect(() => {
    return Store.subscribeDMChannels((dms) => {
      const now = Date.now();
      for (const dm of dms) {
        if (!dm.lastMessageAt || !dm.lastMessageText) continue;
        const timestamp = new Date(dm.lastMessageAt as Date).getTime();
        if (!Number.isFinite(timestamp) || timestamp <= getDMSeenAt(dm.id)) continue;
        setDMSeenAt(dm.id, timestamp);
        if (dm.lastMessageAuthor === Store.displayName) continue;
        const other = dm.participants.find((id) => id !== Store.sessionId);
        const sender = other ? dm.participantNames[other] || dm.lastMessageAuthor || "Someone" : dm.lastMessageAuthor || "Someone";
        const notification: OmixNotification = {
          id: `dm:${dm.id}:${timestamp}`,
          type: "dm",
          title: `New message from ${sender}`,
          body: dm.lastMessageText,
          href: `/?dm=${encodeURIComponent(dm.id)}`,
          createdAt: now,
          read: false,
        };
        addNotification(notification);
        if (document.hidden) void showBrowserNotification(notification);
      }
    });
  }, []);

  const unread = items.filter((item) => !item.read).length;

  const openNotification = (item: OmixNotification) => {
    markNotificationRead(item.id);
    setOpen(false);
    if (item.href) window.location.href = item.href;
  };

  return <div className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} className="relative rounded-xl p-2 text-muted-foreground hover:bg-muted" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
      <Bell className="h-5 w-5" />
      {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">{unread > 9 ? "9+" : unread}</span>}
    </button>
    {open && <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b border-border p-3"><span className="font-semibold">Notifications</span><div className="flex items-center gap-3">{unread > 0 && <button type="button" onClick={markAllNotificationsRead} className="text-xs text-primary">Mark all read</button>}<button type="button" onClick={() => void requestBrowserNotifications()} className="text-xs text-muted-foreground hover:text-foreground">Enable alerts</button></div></div>
      <div className="max-h-80 overflow-y-auto">
        {items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</p> : items.map((item) => <button key={item.id} type="button" onClick={() => openNotification(item)} className={`block w-full border-b border-border p-3 text-left text-sm hover:bg-muted ${item.read ? "opacity-60" : "bg-primary/5"}`}><p className="font-medium">{item.title}</p>{item.body && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>}</button>)}
      </div>
    </div>}
  </div>;
}
