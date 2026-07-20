import { useState, useRef, useEffect } from 'react';
import { Store, getUserColor } from '../utils/store';
import type { Server } from '../types';
import { Icon } from './Icon';

export function ServerSettingsModal({
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

  useEffect(() => {
    Store.getServer(serverId).then(s => {
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
    if (!confirm('Delete this server and all its channels? This cannot be undone.')) return;
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
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-[var(--bg-sidebar)] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-700">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full mx-auto" style={{ animation: 'spin 0.8s linear infinite' }} />
        </div>
      </div>
    );
  }

  const color = getUserColor(server.name);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--bg-sidebar)] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-700"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeSlideUp 0.3s ease' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Server Settings</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
            ✕
          </button>
        </div>

        {/* Icon */}
        <div className="flex flex-col items-center mb-5">
          <div className="relative group cursor-pointer mb-3" onClick={() => fileInputRef.current?.click()}>
            {iconPreview ? (
              <img src={iconPreview}
                className="w-20 h-20 rounded-2xl object-cover border-4 border-[var(--bg-hover)]"
                alt="Server icon" />
            ) : (
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white border-4 border-[var(--bg-hover)]"
                style={{ backgroundColor: color }}>
                {(server.name || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 rounded-2xl bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center transition-all">
              <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">Change</span>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleIconUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            Upload Icon
          </button>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
            Server Name
          </label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            maxLength={30}
            className="w-full bg-[#1e1f22] text-[var(--text-primary)] rounded-lg p-3 outline-none focus:ring-2 focus:ring-[var(--accent)] border border-gray-700 transition-all"
            placeholder="Server name" />
        </div>

        {/* Invite */}
        <button onClick={handleCopyInvite}
          className="w-full mb-4 py-2.5 rounded-lg text-sm font-medium text-[var(--accent)] hover:bg-blue-500/10 transition-all flex items-center justify-center gap-2 border border-gray-700">
          <Icon name="copy" size={16} />
          Copy Invite Code
        </button>

        {/* Message */}
        {message && (
          <p className={`text-sm mb-3 text-center ${message === 'Saved!' || message === 'Invite code copied!' ? 'text-green-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="btn-accent flex-1 py-3 rounded-lg font-semibold text-sm disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button onClick={onClose}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] px-4 py-3 transition-colors">
            Cancel
          </button>
        </div>

        {Store.isAdmin && (
          <button onClick={handleDelete}
            className="w-full mt-4 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all">
            Delete Server
          </button>
        )}
      </div>
    </div>
  );
}
