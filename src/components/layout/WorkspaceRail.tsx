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
  { view: "boards", label: "Forums", icon: "forum" },
  { view: "boards", label: "Updates", icon: "campaign" },
  { view: "dms", label: "Calls", icon: "videocam" },
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
      className="hidden lg:flex flex-col h-full w-[280px] shrink-0 bg-surface-container-low border-r border-outline-variant z-20 overflow-y-auto no-scrollbar"
      role="navigation"
      aria-label="Workspace navigation"
    >
      {/* Brand / Workspace Header */}
      <div className="flex items-center gap-4 p-4 border-b border-outline-variant">
        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surface-container-high flex items-center justify-center">
          <img
            src="/logo.jpg"
            alt="Omix logo"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <h1 className="font-headline-sm text-headline-sm text-primary font-bold leading-none">
            Omix Community
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 truncate">
            omix.dev/workspace
          </p>
        </div>
      </div>

      {/* Navigation Drawer Items */}
      <div className="flex flex-col gap-1 p-4 flex-grow">
        {NAV_ITEMS.map((item) => {
          const active = item.view === currentView;
          return (
            <button
              key={item.label}
              onClick={() => onNavigate(item.view)}
              className={`flex items-center gap-4 px-4 py-2 rounded-lg text-left transition-colors duration-100 ${
                active
                  ? "bg-primary-container/20 text-primary border-l-2 border-primary"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest border-l-2 border-transparent"
              }`}
            >
              <Mso name={item.icon} size={20} fill={active} />
              <span className="font-body-md text-body-md font-medium">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Workspaces / servers */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-4 mb-1">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider text-[10px]">
              Your Workspaces
            </span>
            <button
              onClick={() => setShowAdd((s) => !s)}
              className="text-on-surface-variant hover:text-primary transition-colors"
              aria-label="Add workspace"
            >
              <Mso name="add" size={18} />
            </button>
          </div>
          {showAdd && (
            <div className="mb-2 flex flex-col gap-1 px-2">
              {createOpen ? (
                <div className="flex flex-col gap-2 p-2 bg-surface-container rounded-md border border-outline-variant">
                  <input
                    className="input-field !py-1.5"
                    placeholder="Workspace name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && create()}
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn-primary !px-3 !py-1 !text-[10px] flex-1"
                      onClick={create}
                    >
                      Create
                    </button>
                    <button
                      className="btn-ghost !px-3 !py-1 !text-[10px]"
                      onClick={() => setCreateOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : joinOpen ? (
                <div className="flex flex-col gap-2 p-2 bg-surface-container rounded-md border border-outline-variant">
                  <input
                    className="input-field !py-1.5"
                    placeholder="Invite code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && join()}
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn-ghost !px-3 !py-1 !text-[10px] flex-1"
                      onClick={join}
                    >
                      Join
                    </button>
                    <button
                      className="btn-ghost !px-3 !py-1 !text-[10px]"
                      onClick={() => setJoinOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-1 px-1">
                  <button
                    className="flex-1 flex items-center gap-2 px-3 py-1.5 text-body-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-md transition-colors"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Mso name="add" size={16} />
                    New
                  </button>
                  <button
                    className="flex-1 flex items-center gap-2 px-3 py-1.5 text-body-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-md transition-colors"
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
              <p className="px-4 py-2 font-body-sm text-body-sm text-txt-muted">
                No workspaces yet
              </p>
            )}
            {servers.map((s) => (
              <button
                key={s.id}
                onClick={() => selectServer(s.id)}
                className={`flex items-center gap-3 px-4 py-2 rounded-md text-left transition-colors ${
                  activeServerId === s.id
                    ? "bg-surface-container-highest text-on-surface border-l-2 border-primary"
                    : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface border-l-2 border-transparent"
                }`}
              >
                <div className="w-7 h-7 rounded-md overflow-hidden shrink-0 bg-surface-container-high flex items-center justify-center font-code-md text-[11px] text-on-surface-variant">
                  {s.icon ? (
                    <img src={s.icon} alt="" className="w-full h-full object-cover" />
                  ) : (
                    s.name.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="font-body-sm text-body-sm truncate">
                  {s.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* User Profile Area (Bottom) */}
      <div className="mt-auto p-4 border-t border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-high flex items-center justify-center font-code-md text-on-surface">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (displayName || "U").charAt(0).toUpperCase()
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-secondary rounded-full border-2 border-surface-container-low" />
          </div>
          <div className="min-w-0">
            <div className="font-body-md text-body-md font-medium truncate">
              {displayName}
            </div>
            <div className="font-body-sm text-body-sm text-secondary">Online</div>
          </div>
        </div>
        <button
          onClick={() => onNavigate("settings")}
          className="text-on-surface-variant hover:text-primary transition-colors"
          aria-label="Settings"
        >
          <Mso name="settings" size={20} />
        </button>
      </div>
    </nav>
  );
}
