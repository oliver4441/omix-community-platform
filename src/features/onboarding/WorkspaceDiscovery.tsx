"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Store, getUserColor } from "@/lib/store";
import type { Server } from "@/lib/types";
import { Mso, Loader2 } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";

/**
 * Workspace Discovery (stitch 20) — the "set up your workspace" bridge screen.
 * Shown on first run when the user has no workspaces: create a workspace on the
 * left, browse public boardrooms on the right.
 */
export function WorkspaceDiscovery({
  displayName,
  onExplore,
}: {
  displayName: string;
  onExplore?: () => void;
}) {
  return (
    <div className="h-screen w-full bg-background overflow-y-auto relative">
      {/* Atmosphere */}
      <div className="hero-glow" aria-hidden />
      <div className="absolute inset-0 bg-grid opacity-60 pointer-events-none" aria-hidden />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto flex justify-between items-center px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-container-high flex items-center justify-center">
            <img src="/logo.jpg" alt="" className="w-full h-full object-cover" />
          </div>
          <span className="font-headline-md text-headline-sm font-bold text-primary">
            Omix
          </span>
        </div>
        <span className="text-on-surface-variant font-body-md text-body-md cursor-default">
          Support
        </span>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-grow flex items-start justify-center px-6 pb-16 pt-4">
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          <CreateWorkspacePanel displayName={displayName} />
          <BrowseBoardroomsPanel onExplore={onExplore} />
        </div>
      </main>
    </div>
  );
}

/* ──────────── Left: Create a New Workspace ──────────── */

function CreateWorkspacePanel({ displayName }: { displayName: string }) {
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<"private" | "public">("private");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const selectWorkspace = (serverId: string) => {
    // NOTE: deliberately no Store.cleanup() here — AppLayout's servers
    // subscription is what detects the new workspace and hides this screen.
    Store.currentServerId = serverId;
    Store.currentChannelId = "";
    window.dispatchEvent(new CustomEvent("serverChanged", { detail: serverId }));
  };

  const handleIcon = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Image too large (max 2MB)");
      return;
    }
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
    setError("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const id = await Store.createServer(name.trim(), { privacy });
      if (iconFile) {
        try {
          await Store.uploadServerIcon(iconFile, id);
        } catch {
          /* icon is decorative — don't block workspace creation */
        }
      }
      toast("Workspace created", "success");
      selectWorkspace(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="glass-panel rounded-xl p-8 flex flex-col relative overflow-hidden group animate-fade-in"
      aria-label="Create a new workspace"
    >
      <div
        className="absolute -top-32 -left-32 w-64 h-64 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-500"
        aria-hidden
      />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <Mso name="add_box" size={28} fill className="text-primary" />
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Create a New Workspace
          </h2>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-8">
          Establish a new command center for your team or project. Configure
          access, channels, and integrations.
        </p>

        <form className="space-y-6" onSubmit={handleCreate}>
          <div>
            <label
              htmlFor="discovery-workspace-name"
              className="block font-label-caps text-label-caps text-outline mb-2 uppercase"
            >
              Workspace Name
            </label>
            <input
              id="discovery-workspace-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Engineering Alpha"
              className="input-field glow-input"
              autoFocus
            />
          </div>

          <div>
            <span className="block font-label-caps text-label-caps text-outline mb-2 uppercase">
              Workspace Icon
            </span>
            <div className="flex items-center gap-4">
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className="w-16 h-16 rounded-lg bg-surface-container-highest border border-outline-variant border-dashed flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary transition-colors cursor-pointer overflow-hidden"
                aria-label="Upload workspace icon"
              >
                {iconPreview ? (
                  <img src={iconPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Mso name="upload" size={24} />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleIcon}
                className="hidden"
                aria-hidden
              />
              <div className="font-body-sm text-body-sm text-on-surface-variant">
                Upload a square image
                <br />
                <span className="text-outline text-xs">PNG or JPG, max 2MB</span>
              </div>
            </div>
          </div>

          <div>
            <span className="block font-label-caps text-label-caps text-outline mb-2 uppercase">
              Privacy Level
            </span>
            <div className="grid grid-cols-2 gap-2">
              <PrivacyCard
                label="Private"
                icon="lock"
                checked={privacy === "private"}
                onSelect={() => setPrivacy("private")}
              />
              <PrivacyCard
                label="Public"
                icon="public"
                checked={privacy === "public"}
                onSelect={() => setPrivacy("public")}
              />
            </div>
          </div>

          {error && (
            <p className="font-body-sm text-body-sm text-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="w-full bg-on-primary-fixed-variant hover:bg-inverse-primary disabled:opacity-50 disabled:cursor-not-allowed text-white font-body-md text-body-md font-medium py-3 px-6 rounded transition-colors flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Initializing…
              </>
            ) : (
              <>
                Initialize Workspace
                <Mso name="arrow_forward" size={16} />
              </>
            )}
          </button>
        </form>
      </div>
      <p className="relative z-10 mt-6 pt-5 border-t border-outline-variant font-body-sm text-body-sm text-outline">
        You&apos;re set up as <span className="text-on-surface-variant">{displayName}</span> —
        your workspace will be created under this account.
      </p>
    </section>
  );
}

function PrivacyCard({
  label,
  icon,
  checked,
  onSelect,
}: {
  label: string;
  icon: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name="discovery-privacy"
        className="sr-only"
        checked={checked}
        onChange={onSelect}
      />
      <div
        className={`p-3 border rounded-lg transition-colors text-center ${
          checked
            ? "border-primary bg-primary/15"
            : "border-outline-variant bg-surface-container-highest hover:bg-surface-container"
        }`}
      >
        <Mso
          name={icon}
          size={20}
          className={`block mx-auto mb-1 ${checked ? "text-primary" : "text-on-surface-variant"}`}
        />
        <span className="font-body-sm text-body-sm text-on-surface block">{label}</span>
      </div>
    </label>
  );
}

/* ──────────── Right: Browse Public Boardrooms ──────────── */

function BrowseBoardroomsPanel({ onExplore }: { onExplore?: () => void }) {
  const [boardrooms, setBoardrooms] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    Store.listPublicServers()
      .then((servers) => {
        if (active) setBoardrooms(servers);
      })
      .catch(() => {
        if (active) setBoardrooms([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return boardrooms;
    return boardrooms.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q)
    );
  }, [boardrooms, query]);

  const joinBoardroom = (server: Server) => {
    // Same as selectWorkspace: keep AppLayout's servers channel alive so the
    // discovery screen hides once the workspace list updates.
    Store.currentServerId = server.id;
    Store.currentChannelId = "";
    window.dispatchEvent(new CustomEvent("serverChanged", { detail: server.id }));
    toast(`Joined ${server.name}`, "success");
  };

  const [featured, ...rest] = filtered;

  return (
    <section
      className="glass-panel rounded-xl p-8 flex flex-col relative overflow-hidden group animate-fade-in"
      aria-label="Browse public boardrooms"
    >
      <div
        className="absolute -bottom-32 -right-32 w-64 h-64 bg-secondary/10 rounded-full blur-3xl group-hover:bg-secondary/20 transition-all duration-500"
        aria-hidden
      />
      <div className="relative z-10 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Mso name="explore" size={28} fill className="text-secondary" />
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Browse Public Boardrooms
          </h2>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
          Discover open communities, technical forums, and public project spaces
          across the network.
        </p>
        <div className="relative">
          <Mso
            name="search"
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by tags or keywords…"
            className="input-field glow-input !pl-9"
            aria-label="Search public boardrooms"
          />
        </div>
      </div>

      <div
        className="relative z-10 flex-grow grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-1 no-scrollbar"
        style={{ maxHeight: 400 }}
      >
        {loading ? (
          <div className="col-span-2 flex items-center justify-center py-16 text-on-surface-variant">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-2 flex flex-col items-center justify-center py-16 text-center gap-2">
            <Mso name="travel_explore" size={32} className="text-outline" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {query
                ? "No boardrooms match your search."
                : "No public boardrooms yet — create the first one."}
            </p>
          </div>
        ) : (
          <>
            {featured && (
              <BoardroomCard
                server={featured}
                featured
                onJoin={joinBoardroom}
              />
            )}
            {rest.map((server) => (
              <BoardroomCard
                key={server.id}
                server={server}
                onJoin={joinBoardroom}
              />
            ))}
          </>
        )}
      </div>

      <div className="mt-6 relative z-10 pt-4 text-center">
        <button
          onClick={onExplore}
          className="font-body-sm text-body-sm text-secondary hover:text-secondary-fixed transition-colors underline-offset-4 hover:underline"
        >
          View All Public Directories
        </button>
      </div>
    </section>
  );
}

function BoardroomCard({
  server,
  featured = false,
  onJoin,
}: {
  server: Server;
  featured?: boolean;
  onJoin: (server: Server) => void;
}) {
  const color = getUserColor(server.name);
  const members = server.memberCount ?? 1;

  return (
    <div
      className={`group/card rounded-lg p-4 transition-colors cursor-pointer flex flex-col justify-between ${
        featured
          ? "sm:col-span-2 sm:flex-row sm:items-center gap-4 bg-gradient-to-br from-surface-container to-surface-container-highest border border-secondary/30 hover:border-secondary"
          : "bg-surface-container-low border border-outline-variant hover:border-secondary/50"
      }`}
      onClick={() => onJoin(server)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onJoin(server);
        }
      }}
      aria-label={`Join boardroom ${server.name}`}
    >
      <div className={featured ? "flex-grow min-w-0" : ""}>
        <div
          className={`flex items-start justify-between mb-2 ${
            featured ? "items-center" : ""
          }`}
        >
          <div
            className={`shrink-0 rounded flex items-center justify-center font-headline-sm font-semibold ${
              featured ? "w-8 h-8 text-base bg-secondary/20 text-secondary" : "w-10 h-10"
            }`}
            style={{ backgroundColor: featured ? undefined : `${color}33`, color: featured ? undefined : color }}
          >
            {featured ? <Mso name="terminal" size={16} fill /> : server.name.charAt(0).toUpperCase()}
          </div>
          {!featured && (
            <Mso
              name="arrow_outward"
              size={16}
              className="text-outline-variant group-hover/card:text-secondary transition-colors"
            />
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-body-md text-body-md text-on-surface font-medium mb-0.5">
            {server.name}
          </h3>
          {featured && (
            <span className="bg-secondary/10 text-secondary border border-secondary/20 rounded-full px-2 py-0.5 text-[10px] font-label-caps uppercase">
              Official
            </span>
          )}
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
          {server.description || "A public Omix community boardroom."}
        </p>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="flex items-center gap-1 text-outline font-code-md text-code-md text-xs">
          <Mso name="group" size={14} />
          {members >= 1000 ? `${(members / 1000).toFixed(1)}k` : members}
        </span>
        {featured && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onJoin(server);
            }}
            className="ml-auto shrink-0 border border-secondary text-secondary hover:bg-secondary/10 font-body-sm text-body-sm py-1.5 px-3 rounded transition-colors whitespace-nowrap"
          >
            Join Boardroom
          </button>
        )}
      </div>
    </div>
  );
}
