"use client";

import { useState, useEffect, useCallback } from "react";
import { Store } from "@/lib/store";
import type { ClientNotification } from "@/lib/services/notifications";
import { Bell, CheckCheck, X, AtSign, MessageCircle, MessageSquare, Smile, Link, Phone, Calendar, Shield, Info } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";

const TYPE_ICONS: Record<string, { icon: typeof Bell; label: string }> = {
  mention: { icon: AtSign, label: "Mention" },
  reply: { icon: MessageCircle, label: "Reply" },
  dm: { icon: MessageSquare, label: "Direct message" },
  reaction: { icon: Smile, label: "Reaction" },
  invite: { icon: Link, label: "Invite" },
  call: { icon: Phone, label: "Call" },
  event: { icon: Calendar, label: "Event" },
  moderation: { icon: Shield, label: "Moderation" },
  system: { icon: Info, label: "System" },
};

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  const delta = Date.now() - then;
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<ClientNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubUnread = Store.notifications.subscribeUnread((count) => {
      setUnread(count);
    });
    return () => {
      unsubUnread();
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await Store.notifications.fetchNotifications();
    setItems(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [open, load]);

  const handleOpenItem = useCallback(
    (n: ClientNotification) => {
      void Store.notifications.markRead([n.id]);
      const data = n.data || {};
      const channelId = data.channelId as string | undefined;
      const serverId = data.serverId as string | undefined;
      if (channelId) {
        if (serverId) Store.currentServerId = serverId;
        Store.currentChannelId = channelId;
        Store.currentChannelType = "channel";
        window.dispatchEvent(new CustomEvent("channelChanged", { detail: channelId }));
        window.dispatchEvent(new CustomEvent("navigateChat", { detail: channelId }));
      }
      setOpen(false);
    },
    []
  );

  const markAll = useCallback(async () => {
    await Store.notifications.markAllRead();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    toast("All notifications marked as read", "success");
  }, [toast]);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      >
        <Bell size={19} className="text-[var(--color-txt-muted)]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9995] flex justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-md h-full md:h-auto md:max-h-[80vh] md:m-4 md:rounded-[20px] bg-[var(--color-bg-dark)] border-l md:border border-[var(--color-border)] shadow-2xl flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
          >
            <div className="h-12 px-4 border-b border-[var(--color-border)] flex items-center gap-3 shrink-0">
              <Bell size={18} className="text-[var(--color-pri)]" />
              <span className="font-bold text-sm text-[var(--color-txt)]">Notifications</span>
              <button
                onClick={markAll}
                className="ml-auto flex items-center gap-1 text-xs text-[var(--color-pri)] hover:underline"
                aria-label="Mark all notifications as read"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)]" aria-label="Close notifications">
                <X size={16} className="text-[var(--color-txt-muted)]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-9 h-9 rounded-full skeleton shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-3 w-40" />
                        <div className="skeleton h-4 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-[var(--color-pri-muted)] flex items-center justify-center mb-3">
                    <Bell size={24} className="text-[var(--color-pri)]" />
                  </div>
                  <h3 className="font-semibold text-sm text-[var(--color-txt)]">You&rsquo;re all caught up</h3>
                  <p className="text-xs text-[var(--color-txt-muted)] mt-1">
                    Mentions, replies, DMs and invites will show up here.
                  </p>
                </div>
              ) : (
                items.map((n) => {
                  const meta = TYPE_ICONS[n.type] || TYPE_ICONS.system;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleOpenItem(n)}
                      className={`w-full text-left px-4 py-3 border-b border-[var(--color-border)] flex gap-3 transition-colors ${
                        n.read ? "opacity-70" : "bg-[var(--color-pri-muted)]/20"
                      } hover:bg-[var(--color-bg-hover)]`}
                    >
                      <div
                        className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center ${
                          n.read ? "bg-[var(--color-bg-mid)]" : "bg-[var(--color-pri-muted)]"
                        }`}
                      >
                        <Icon size={16} className="text-[var(--color-pri)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className={`text-sm truncate ${n.read ? "" : "font-semibold"} text-[var(--color-txt)]`}>
                            {n.title}
                          </span>
                          <span className="ml-auto text-[10px] text-[var(--color-txt-muted)] shrink-0">
                            {formatWhen(n.createdAt)}
                          </span>
                        </div>
                        {n.body && (
                          <p className="text-xs text-[var(--color-txt-muted)] truncate mt-0.5">{n.body}</p>
                        )}
                        <span className="text-[10px] uppercase tracking-wide text-[var(--color-pri)] mt-0.5 block">
                          {meta.label}
                        </span>
                      </div>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-[var(--color-pri)] shrink-0 mt-1.5" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
