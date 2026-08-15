"use client";

import { useEffect, useState } from "react";
import { Store } from "@/lib/store";
import type { Server } from "@/lib/types";
import { Mso } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import type { AppView } from "@/lib/views";

const NAV_ITEMS: { view: AppView; label: string; icon: string }[] = [
  { view: "chat", label: "Workspaces", icon: "grid_view" },
  { view: "chat", label: "Threads", icon: "chat" },
  { view: "boards", label: "Boardroom RFCs", icon: "forum" },
  { view: "feed", label: "Updates & Feed", icon: "campaign" },
  { view: "dms", label: "Voice & Calls", icon: "videocam" },
];

export function WorkspaceRail({
  currentView,
  onNavigate,
  displayName,
  avatarUrl,
}: {
  currentView: AppView;
  onNavigate: (v: AppView) => void;
  displayName: string;
  avatarUrl?: string | null;
}) {
  const [servers, setServers] = useState<Server[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const unsub = Store.subscribeServers((_, data) => {
      setServers(data as Server[]);
    });
    return () => void unsub();
  }, []);

  const selectServer = (serverId: string) => {
    Store.currentServerId = serverId;
    Store.cleanup();
    Store.currentChannelId = "";
    window.dispatchEvent(
      new CustomEvent("serverChanged", { detail: serverId })
    );
  };

  const create = async () => {
    if (!name.trim()) return;
    try {
      const id = await Store.createServer(name.trim());
      setCreateOpen(false);
      setShowAdd(false);
      setName("");
      selectServer(id);
      toast("Workspace created", "success");
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "Failed to create workspace",
        "error"
      );
    }
  };

  const join = async () => {
    if (!code.trim()) return;
    const id = await Store.joinServerByInvite(code.trim());
    if (!id) {
      toast("Invalid invite code", "error");
      return;
    }
    setJoinOpen(false);
    setShowAdd(false);
    setCode("");
    selectServer(id);
    toast("Joined workspace", "success");
  };

  const activeServerId = Store.currentServerId;

  return (
    <nav
      className="hidden lg:flex flex-col h-full w-[280px] shrink-0 bg-surface-container-lowest border-r border-outline-variant/40 z-20 overflow-y-auto no-scrollbar"
      role="navigation"
      aria-label="Workspace navigation"
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 p-4 border-b border-outline-variant/30 bg-surface-container-low/40">
        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-primary-container to-secondary-container p-0.5 shadow-[0_0_12px_rgba(208,188,255,0.2)]">
          <div className="w-full h-full bg-surface-container-lowest rounded-[10px] flex items-center justify-center">
            <img
              src="/logo-192.png"
              alt="Omix logo"
              className="w-7 h-7 object-contain"
            />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-headline-sm text-base text-on-surface font-black leading-none tracking-tight">
            Omix Community
          </h1>
          <span className="font-label-caps text-[10px] text-primary tracking-widest uppercase">
            Developer Workspace
          </span>
        </div>
      </div>

      {/* Navigation Drawer Items */}
      <div className="flex flex-col gap-1 p-3 flex-grow">
        <span className="font-label-caps text-[10px] text-on-surface-variant/80 uppercase tracking-widest px-3 pt-2 pb-1">
          Navigation
        </span>
        {NAV_ITEMS.map((item) => {
          const active = item.view === currentView;
          return (
            <button
              key={item.label}
              onClick={() => onNavigate(item.view)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                active
                  ? "bg-primary-container/20 text-primary font-bold shadow-[0_0_10px_rgba(208,188,255,0.15)] border-l-2 border-primary"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50 border-l-2 border-transparent"
              }`}
            >
              <Mso name={item.icon} size={20} fill={active} />
              <span className="font-body-sm text-sm">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Workspaces / Servers */}
        <div className="mt-5 pt-3 border-t border-outline-variant/30">
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="font-label-caps text-[10px] text-on-surface-variant/80 uppercase tracking-widest">
              Your Workspaces
            </span>
            <button
              onClick={() => setShowAdd((s) => !s)}
              className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
              aria-label="Add workspace"
            >
              <Mso name="add" size={18} />
            </button>
          </div>

          {showAdd && (
            <div className="mb-3 flex flex-col gap-1.5 p-2 bg-surface-container-low rounded-lg border border-outline-variant/50">
              {createOpen ? (
                <div className="flex flex-col gap-2">
                  <input
                    className="input-field !py-1.5 text-xs"
                    placeholder="Workspace name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && create()}
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn-primary !px-3 !py-1 !text-[11px] flex-1"
                      onClick={create}
                    >
                      Create
                    </button>
                    <button
                      className="btn-ghost !px-3 !py-1 !text-[11px]"
                      onClick={() => setCreateOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : joinOpen ? (
                <div className="flex flex-col gap-2">
                  <input
                    className="input-field !py-1.5 text-xs"
                    placeholder="Invite code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && join()}
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn-primary !px-3 !py-1 !text-[11px] flex-1"
                      onClick={join}
                    >
                      Join
                    </button>
                    <button
                      className="btn-ghost !px-3 !py-1 !text-[11px]"
                      onClick={() => setJoinOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-1">
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-md transition-colors"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Mso name="add" size={16} />
                    Create
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-md transition-colors"
                    onClick={() => setJoinOpen(true)}
                  >
                    <Mso name="group_add" size={16} />
                    Join
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1">
            {servers.length === 0 && (
              <p className="px-3 py-2 font-body-sm text-xs text-on-surface-variant/70 italic">
                No workspaces joined yet
              </p>
            )}
            {servers.map((s) => {
              const active = activeServerId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => selectServer(s.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                    active
                      ? "bg-surface-container-high text-on-surface font-semibold border-l-2 border-secondary shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container-high/50 hover:text-on-surface border-l-2 border-transparent"
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 bg-primary-container/20 text-primary flex items-center justify-center font-bold text-xs border border-outline-variant/30">
                    {s.icon ? (
                      <img src={s.icon} alt="" className="w-full h-full object-cover" />
                    ) : (
                      s.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="font-body-sm text-xs truncate flex-1">
                    {s.name}
                  </span>
                  {active && (
                    <span className="w-2 h-2 rounded-full bg-secondary shrink-0 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* User Profile Footer */}
      <div className="mt-auto p-3 border-t border-outline-variant/30 bg-surface-container-low/50 flex items-center justify-between">
        <button
          onClick={() => onNavigate("profile")}
          className="flex items-center gap-3 min-w-0 flex-1 hover:bg-surface-container-high/50 p-1.5 rounded-lg transition-colors text-left"
        >
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs border border-primary/30">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (displayName || "U").charAt(0).toUpperCase()
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-secondary rounded-full border-2 border-surface-container-lowest" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-body-sm text-xs font-bold text-on-surface truncate">
              {displayName}
            </div>
            <div className="font-code-md text-[10px] text-secondary">
              Online
            </div>
          </div>
        </button>
        <button
          onClick={() => onNavigate("settings")}
          className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-lg transition-colors"
          aria-label="Settings"
        >
          <Mso name="settings" size={18} />
        </button>
      </div>
    </nav>
  );
}
