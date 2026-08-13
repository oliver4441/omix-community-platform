"use client";

/**
 * Mobile navigation drawer — the mobile-first community → channel → conversation
 * model (desktop keeps the rails; mobile never shrinks them).
 *
 * Levels:
 *   0. Communities + DMs      (pick a workspace, or jump into your DMs)
 *   1. Channels of a workspace (with back to communities)
 *   2. Conversation            (ChatPane takes over; drawer closes)
 */
import { useState, useEffect, useCallback } from "react";
import { Store } from "@/lib/store";
import type { Server } from "@/lib/types";
import {
  X,
  ChevronLeft,
  Hash,
  MessageSquare,
  Plus,
  Globe,
  Lock,
} from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";

export function MobileChannelDrawer({ onClose }: { onClose: () => void }) {
  const [level, setLevel] = useState<0 | 1>(0);
  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<import("@/lib/types").Channel[]>([]);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubServers = Store.subscribeServers((_, data) => setServers(data as Server[]));
    return () => {
      unsubServers();
    };
  }, []);

  const openServer = useCallback((server: Server) => {
    setActiveServer(server);
    setLevel(1);
    Store.currentServerId = server.id;
    Store.cleanup();
    Store.currentChannelId = "";
    window.dispatchEvent(new CustomEvent("serverChanged", { detail: server.id }));
  }, []);

  useEffect(() => {
    if (level !== 1 || !activeServer) return;
    const unsubChannels = Store.subscribeChannels(activeServer.id, (_, data) => {
      setChannels(data as import("@/lib/types").Channel[]);
    });
    return () => {
      unsubChannels();
    };
  }, [level, activeServer]);

  const openChannel = useCallback(
    (channelId: string) => {
      Store.currentChannelId = channelId;
      Store.currentChannelType = "channel";
      window.dispatchEvent(new CustomEvent("channelChanged", { detail: channelId }));
      onClose();
    },
    [onClose]
  );

  const openDMs = useCallback(() => {
    window.dispatchEvent(new CustomEvent("navigateDMs"));
    onClose();
  }, [onClose]);

  const createChannel = useCallback(async () => {
    const name = createName.trim();
    if (!name || !activeServer) return;
    setCreating(true);
    try {
      const id = await Store.createChannel(activeServer.id, name);
      openChannel(id);
    } catch {
      toast("Couldn't create channel", "error");
    } finally {
      setCreating(false);
      setCreateName("");
    }
  }, [createName, activeServer, openChannel, toast]);

  return (
    <div
      className="fixed inset-0 z-[9990] bg-[var(--color-bg-overlay)] md:hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Channels"
    >
      <div className="absolute inset-y-0 left-0 w-[85%] max-w-sm bg-[var(--color-bg-dark)] border-r border-[var(--color-border)] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="h-12 px-4 border-b border-[var(--color-border)] flex items-center gap-2 shrink-0">
          {level === 1 && (
            <button
              onClick={() => setLevel(0)}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-[var(--color-bg-hover)]"
              aria-label="Back to communities"
            >
              <ChevronLeft size={18} className="text-[var(--color-txt-muted)]" />
            </button>
          )}
          <span className="font-bold text-sm text-[var(--color-txt)] truncate">
            {level === 1 ? activeServer?.name || "Channels" : "Communities"}
          </span>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)]"
            aria-label="Close navigation"
          >
            <X size={16} className="text-[var(--color-txt-muted)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {level === 0 ? (
            <>
              <button
                onClick={openDMs}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-[var(--color-pri-muted)] flex items-center justify-center">
                  <MessageSquare size={16} className="text-[var(--color-pri)]" />
                </div>
                <span className="text-sm font-medium text-[var(--color-txt)]">Direct Messages</span>
              </button>
              <div className="px-4 pt-4 pb-1 text-[10px] uppercase tracking-wider text-[var(--color-txt-muted)]">
                Your communities
              </div>
              {servers.length === 0 && (
                <p className="px-4 py-2 text-xs text-[var(--color-txt-muted)]">
                  No communities yet — create one from a desktop session or join with an invite.
                </p>
              )}
              {servers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openServer(s)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <div className="w-9 h-9 rounded-[12px] bg-[var(--color-bg-mid)] overflow-hidden flex items-center justify-center shrink-0">
                    {s.icon ? (
                      <img src={s.icon} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-[var(--color-txt-muted)]">
                        {s.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[var(--color-txt)] truncate">
                      {s.name}
                    </span>
                    <span className="text-[10px] text-[var(--color-txt-muted)]">
                      {s.memberCount || 1} member{(s.memberCount || 1) === 1 ? "" : "s"}
                    </span>
                  </div>
                  {s.privacy === "public" ? (
                    <Globe size={14} className="text-[var(--color-txt-muted)] shrink-0" />
                  ) : (
                    <Lock size={14} className="text-[var(--color-txt-muted)] shrink-0" />
                  )}
                </button>
              ))}
            </>
          ) : (
            <>
              <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-[var(--color-txt-muted)]">
                Channels
              </div>
              {channels.length === 0 && (
                <p className="px-4 py-2 text-xs text-[var(--color-txt-muted)]">No channels yet.</p>
              )}
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => openChannel(ch.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                    Store.currentChannelId === ch.id
                      ? "bg-[var(--color-pri-muted)]/20 text-[var(--color-pri)]"
                      : "hover:bg-[var(--color-bg-hover)] text-[var(--color-txt)]"
                  }`}
                >
                  <Hash size={16} className="shrink-0" />
                  <span className="text-sm truncate">{ch.name}</span>
                  {Store.unreadCounts[ch.id] ? (
                    <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {Store.unreadCounts[ch.id]}
                    </span>
                  ) : null}
                </button>
              ))}
              <div className="px-4 pt-3">
                <div className="flex gap-2">
                  <input
                    className="input-field !py-2 text-xs"
                    placeholder="New channel name"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createChannel()}
                    aria-label="New channel name"
                  />
                  <button
                    onClick={createChannel}
                    disabled={creating || !createName.trim()}
                    className="btn-primary !px-3 !py-2 text-xs shrink-0 disabled:opacity-50"
                    aria-label="Create channel"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
