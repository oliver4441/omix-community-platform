"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { getNotifications, getUnreadNotificationCount, markAllNotificationsRead, subscribeNotifications, type OmixNotification } from "@/lib/notifications";

export function NotificationBell() {
  const [items, setItems] = useState<OmixNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeNotifications(setItems), []);
  const unread = items.filter((item) => !item.read).length;

  return <div className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} className="relative rounded-xl p-2 text-muted-foreground hover:bg-muted" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
      <Bell className="h-5 w-5" />
      {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">{unread > 9 ? "9+" : unread}</span>}
    </button>
    {open && <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b border-border p-3"><span className="font-semibold">Notifications</span>{unread > 0 && <button type="button" onClick={markAllNotificationsRead} className="text-xs text-primary">Mark all read</button>}</div>
      <div className="max-h-80 overflow-y-auto">
        {items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</p> : items.map((item) => <div key={item.id} className={`border-b border-border p-3 text-sm ${item.read ? "opacity-60" : "bg-primary/5"}`}><p className="font-medium">{item.title}</p>{item.body && <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>}</div>)}
      </div>
    </div>}
  </div>;
}
