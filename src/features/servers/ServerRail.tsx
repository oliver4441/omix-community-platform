'use client';

// Mutating the global Store singleton (src/lib/store.ts) from event handlers is
// this app's established state pattern (Store + window events). The React
// Compiler immutability rule doesn't apply to this architecture.
/* eslint-disable react-hooks/immutability */

import { useState, useEffect, useRef } from 'react';
import { Store } from '@/lib/store';
import type { Server } from '@/lib/types';
import {
  Plus,
  Settings,
  Users,
  MessageSquare,
  Image as ImageIcon,
  X,
  Copy,
  Loader2,
} from '@/components/ui/icons';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { getUserColor } from '@/lib/store';

export function ServerRail({
  isMobile,
  currentView,
  onDMClick,
}: {
  isMobile: boolean;
  currentView: string;
  onDMClick: () => void;
}) {
  const [servers, setServers] = useState<Server[]>([]);
  const [serversLoaded, setServersLoaded] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [newName, setNewName] = useState('');
  const [settingsServerId, setSettingsServerId] = useState<string | null>(null);
  const [newIconFile, setNewIconFile] = useState<File | null>(null);
  const [newIconPreview, setNewIconPreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const unsub = Store.subscribeServers((_, data) => {
      setServers(data as Server[]);
      setServersLoaded(true);
    });
    return () => void unsub();
  }, []);

  const selectServer = (serverId: string) => {
    Store.currentServerId = serverId;
    Store.cleanup();
    Store.currentChannelId = '';
    window.dispatchEvent(
      new CustomEvent('serverChanged', { detail: serverId }),
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const id = await Store.createServer(newName.trim());
    if (newIconFile) {
      try {
        await Store.uploadServerIcon(newIconFile, id);
      } catch (err) {
        console.error('Icon upload failed:', err);
      }
    }
    setShowCreate(false);
    setNewName('');
    setNewIconFile(null);
    setNewIconPreview('');
    selectServer(id);
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('Image too large (max 2MB)', 'error');
      return;
    }
    setNewIconFile(file);
    setNewIconPreview(URL.createObjectURL(file));
  };

  const handleJoined = (serverId: string) => {
    setShowJoin(false);
    selectServer(serverId);
  };

  if (isMobile && currentView !== 'servers') return null;

  return (
    <div
      className="w-[72px] bg-[var(--color-bg-deeper)] h-full flex flex-col items-center py-3 gap-2 overflow-y-auto z-10 shrink-0"
      data-name="server-rail"
      role="navigation"
      aria-label="Server navigation"
    >
      {/* Home/DM */}
      <div
        className="w-12 h-12 radius-xl hover:radius-md bg-[var(--color-bg-dark)] flex items-center justify-center cursor-pointer transition-all duration-200 group relative overflow-hidden"
        role="button"
        tabIndex={0}
        aria-label="Home"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            Store.currentServerId = '';
            Store.cleanup();
            Store.currentChannelId = '';
            window.dispatchEvent(new CustomEvent('serverChanged', { detail: '' }));
          }
        }}
      >
        <img
          src="logo.jpg"
          className="w-full h-full object-cover"
          alt="Omix Social Home"
        />
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full hidden group-hover:block" />
      </div>

      <button
        onClick={onDMClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onDMClick();
          }
        }}
        className={`w-12 h-12 radius-xl hover:radius-md flex items-center justify-center cursor-pointer transition-all duration-200 overflow-hidden relative group ${
          currentView === 'dms'
            ? 'radius-md bg-[var(--color-pri)]'
            : 'bg-[var(--color-bg-dark)]'
        }`}
        title="Direct Messages"
        aria-label="Direct Messages"
      >
        <MessageSquare
          size={20}
          className={
            currentView === 'dms'
              ? 'text-white'
              : 'text-[var(--color-txt-muted)]'
          }
        />
        <div
          className={`absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full ${
            currentView === 'dms' ? 'block' : 'hidden group-hover:block'
          }`}
        />
      </button>

      <div className="w-8 h-[2px] bg-[var(--color-bg-hover)] my-1 rounded-full" />

      {/* Server list */}
      {!serversLoaded ? (
        <div className="flex flex-col items-center gap-2 mt-2 w-12" aria-label="Loading servers">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-12 h-12 rounded-[16px] skeleton"
            />
          ))}
        </div>
      ) : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-2 py-6 text-center" aria-label="No servers">
          <span className="text-xs text-[var(--color-txt-muted)] leading-relaxed">
            No servers yet
          </span>
          {Store.isAdmin && (
            <button
              onClick={() => { setShowCreate(true); }}
              className="mt-2 text-xs text-[var(--color-pri)] hover:underline"
              aria-label="Create a new server"
            >
              Create one
            </button>
          )}
        </div>
      ) : (
        <div role="list" aria-label="Server list">
          {servers.map((server) => {
            const isActive = Store.currentServerId === server.id;
            return (
              <div key={server.id} className="relative group">
                <div
                  onClick={() => selectServer(server.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectServer(server.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Switch to server ${server.name}`}
                  className={`w-12 h-12 radius-xl hover:radius-md flex items-center justify-center cursor-pointer transition-all duration-200 overflow-hidden relative ${
                    isActive
                      ? 'radius-md bg-[var(--color-pri)]'
                      : 'bg-[var(--color-bg-dark)]'
                  }`}
                >
                  {server.icon ? (
                    <img
                      src={server.icon}
                      alt={server.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[var(--color-txt)] text-sm font-medium">
                      {server.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div
                    className={`absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full ${
                      isActive ? 'block' : 'hidden group-hover:block'
                    }`}
                  />
                </div>
                {/* Settings gear on hover */}
                {Store.isAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSettingsServerId(server.id);
                    }}
                    className="absolute bottom-0 right-0 w-4 h-4 bg-[var(--color-bg-mid)] rounded-full flex items-center justify-center text-[var(--color-txt-secondary)] opacity-0 group-hover:opacity-100 hover:scale-110 transition-all hover:bg-[var(--color-pri)] hover:text-white"
                    title="Server settings"
                    aria-label={`Server settings for ${server.name}`}
                  >
                    <Settings size={10} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add server menu — admin only */}
      {Store.isAdmin && (
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setShowAddMenu(!showAddMenu);
              }
            }}
            className="w-12 h-12 radius-xl hover:radius-md bg-[var(--color-bg-dark)] flex items-center justify-center text-[var(--color-success)] hover:bg-[var(--color-success)] hover:text-white cursor-pointer transition-all duration-200 mt-2"
            aria-label="Add server"
            aria-expanded={showAddMenu}
          >
            <Plus size={24} />
          </button>

          {showAddMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowAddMenu(false)}
              />
              <div
                className="absolute left-[72px] bottom-0 surface-elevated z-50 py-1 min-w-[180px]"
                style={{ animation: 'scaleIn 0.12s ease' }}
              >
                <button
                  onClick={() => {
                    setShowAddMenu(false);
                    setShowCreate(true);
                  }}
                  className="w-full px-4 py-2.5 text-sm text-[var(--color-txt)] hover:bg-[var(--color-bg-hover)] text-left flex items-center gap-3 transition-colors"
                >
                  <Plus size={16} className="text-[var(--color-success)]" />
                  Create Server
                </button>
                <button
                  onClick={() => {
                    setShowAddMenu(false);
                    setShowJoin(true);
                  }}
                  className="w-full px-4 py-2.5 text-sm text-[var(--color-txt)] hover:bg-[var(--color-bg-hover)] text-left flex items-center gap-3 transition-colors"
                >
                  <Users size={16} className="text-[var(--color-pri)]" />
                  Join Server
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Create Server Modal */}
      {showCreate && (
        <CreateServerModal
          onClose={() => {
            setShowCreate(false);
            setNewName('');
            setNewIconFile(null);
            setNewIconPreview('');
          }}
          newName={newName}
          setNewName={setNewName}
          newIconPreview={newIconPreview}
          fileInputRef={fileInputRef}
          handleIconUpload={handleIconUpload}
          handleCreate={handleCreate}
        />
      )}

      {/* Server Settings Modal */}
      {settingsServerId && (
        <ServerSettingsModal
          serverId={settingsServerId}
          onClose={() => setSettingsServerId(null)}
        />
      )}

      {showJoin && (
        <JoinServerModal onClose={() => setShowJoin(false)} onJoined={handleJoined} />
      )}
    </div>
  );
}

/* ──────────── Create Server Modal ──────────── */

function CreateServerModal({
  onClose,
  newName,
  setNewName,
  newIconPreview,
  fileInputRef,
  handleIconUpload,
  handleCreate,
}: {
  onClose: () => void;
  newName: string;
  setNewName: (v: string) => void;
  newIconPreview: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleIconUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCreate: (e: React.FormEvent) => Promise<void>;
}) {
  return (
    <div
      className="fixed inset-0 bg-[var(--color-bg-overlay)] flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Create a new server"
    >
      <div
        className="surface p-6 w-80 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-[var(--color-txt)] mb-4">
          Create Server
        </h2>
        <form onSubmit={handleCreate}>
          {/* Icon upload */}
          <div className="flex justify-center mb-4">
            <div
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload server icon"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              {newIconPreview ? (
                <img
                  src={newIconPreview}
                  className="w-16 h-16 radius-md object-cover"
                  alt="Server icon preview"
                />
              ) : (
                <div className="w-16 h-16 radius-md bg-[var(--color-bg-mid)] flex items-center justify-center text-[var(--color-txt-muted)]">
                  <ImageIcon size={24} />
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleIconUpload}
              className="hidden"
              aria-hidden="true"
            />
          </div>
          <label
            htmlFor="create-server-name"
            className="text-xs font-semibold text-[var(--color-txt-muted)] uppercase tracking-wider block mb-1"
          >
            Server Name
          </label>
          <input
            id="create-server-name"
            type="text"
            placeholder="Server name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="input-field mb-4"
            autoFocus
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1 font-semibold">
              Create
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ──────────── Server Settings Modal ──────────── */

function ServerSettingsModal({
  serverId,
  onClose,
}: {
  serverId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [iconPreview, setIconPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [server, setServer] = useState<Server | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm } = useConfirm();

  useEffect(() => {
    Store.getServer(serverId).then((s) => {
      if (s) {
        setServer(s);
        setName(s.name);
        setIconPreview(s.icon || '');
      }
    });
  }, [serverId]);

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage('Image too large. Max 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setIconPreview(dataUrl);
      setIcon(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      await Store.updateServer(serverId, {
        name: name.trim(),
        icon: icon || undefined,
      });
      setMessage('Saved!');
      setTimeout(onClose, 800);
    } catch {
      setMessage('Failed to save');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete Server',
      message:
        'Delete this server and all its channels? This cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await Store.deleteServer(serverId);
      setMessage('Deleted');
      window.location.reload();
    } catch {
      setMessage('Failed to delete');
    }
  };

  const handleCopyInvite = async () => {
    try {
      const code = await Store.createInvite(serverId);
      await navigator.clipboard.writeText(code);
      setMessage('Invite code copied!');
    } catch {
      setMessage('Failed to create invite');
    }
  };

  if (!server) {
    return (
      <div className="fixed inset-0 bg-[var(--color-bg-overlay)] flex items-center justify-center z-50 p-4">
        <div className="surface-elevated p-6 w-full max-w-sm flex items-center justify-center">
          <Loader2
            size={24}
            className="text-[var(--color-pri)] animate-spin"
          />
        </div>
      </div>
    );
  }

  const color = getUserColor(server.name);

  return (
    <div
      className="fixed inset-0 bg-[var(--color-bg-overlay)] flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Server settings for ${server.name}`}
    >
      <div
        className="surface p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'scaleIn 0.15s ease' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--color-txt)]">
            Server Settings
          </h2>
          <button
            onClick={onClose}
            className="btn-icon"
            aria-label="Close server settings"
          >
            <X size={16} />
          </button>
        </div>

        {/* Icon */}
        <div className="flex flex-col items-center mb-5">
          <div
            className="relative group cursor-pointer mb-3"
            onClick={() => fileInputRef.current?.click()}
          >
            {iconPreview ? (
              <img
                src={iconPreview}
                className="w-20 h-20 radius-md object-cover border-4 border-[var(--color-border)]"
                alt="Server icon"
              />
            ) : (
              <div
                className="w-20 h-20 radius-md flex items-center justify-center text-2xl font-bold text-white border-4 border-[var(--color-border)]"
                style={{ backgroundColor: color }}
              >
                {(server.name || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 radius-md bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
              <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Change
              </span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleIconUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-[var(--color-txt-muted)] hover:text-[var(--color-txt)] transition-colors"
          >
            Upload Icon
          </button>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-[var(--color-txt-muted)] uppercase tracking-wider block mb-1">
            Server Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            className="input-field"
            placeholder="Server name"
          />
        </div>

        {/* Invite */}
        <button
          onClick={handleCopyInvite}
          className="w-full mb-4 py-2.5 radius-md text-sm font-medium text-[var(--color-pri)] hover:bg-[var(--color-pri-muted)] transition-all flex items-center justify-center gap-2 border border-[var(--color-border)]"
        >
          <Copy size={16} />
          Copy Invite Code
        </button>

        {/* Message */}
        {message && (
          <p
            className={`text-sm mb-3 text-center ${
              message === 'Saved!' || message === 'Invite code copied!'
                ? 'text-[var(--color-success)]'
                : 'text-[var(--color-danger)]'
            }`}
          >
            {message}
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="btn-primary flex-1 font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
        </div>

        {Store.isAdmin && (
          <button
            onClick={handleDelete}
            className="w-full mt-4 py-2.5 radius-md text-sm font-medium text-[var(--color-danger)] hover:bg-red-500/10 transition-all"
          >
            Delete Server
          </button>
        )}
      </div>
    </div>
  );
}

/* ──────────── Join Server Modal ──────────── */

function JoinServerModal({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: (serverId: string) => void;
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const serverId = await Store.joinServerByInvite(code.trim());
      if (serverId) {
        onJoined(serverId);
      } else {
        setError('Invalid invite code');
      }
    } catch {
      setError('Failed to join server');
    }
    setLoading(false);
  };

  return (
    <div
      className="fixed inset-0 bg-[var(--color-bg-overlay)] flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Join a server"
    >
      <div
        className="surface p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'scaleIn 0.15s ease' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--color-txt)]">
            Join a Server
          </h2>
          <button
            onClick={onClose}
            className="btn-icon"
            aria-label="Close join server dialog"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleJoin}>
          <label
            className="text-xs font-semibold text-[var(--color-txt-muted)] uppercase tracking-wider block mb-1"
            htmlFor="join-invite-code"
          >
            Invite Code
          </label>
          <input
            id="join-invite-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste invite code"
            className="input-field mb-4"
            autoFocus
            aria-label="Invite code"
          />

          {error && (
            <p className="text-[var(--color-danger)] text-sm mb-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="btn-primary w-full font-semibold disabled:opacity-50"
          >
            {loading ? 'Joining...' : 'Join Server'}
          </button>
        </form>

        <p className="text-center mt-4 text-xs text-[var(--color-txt-muted)]">
          Ask the server admin for an invite code
        </p>
      </div>
    </div>
  );
}
