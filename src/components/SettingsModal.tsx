import { useState, useRef } from 'react';
import { Store, SESSION_ID, getUserColor } from '../utils/store';

export function SettingsModal({
  onClose,
  displayName,
  currentAvatar,
}: {
  onClose: () => void;
  displayName: string;
  currentAvatar: string;
}) {
  const [name, setName] = useState(displayName);
  const [avatar, setAvatar] = useState(currentAvatar);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(currentAvatar);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const color = getUserColor(displayName);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage('Image too large. Max 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAvatarPreview(dataUrl);
      setAvatar(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await Store.saveProfile({
        name: name.trim() || undefined,
        avatar: avatar || undefined,
      });
      if (name.trim() && name.trim() !== displayName) {
        Store.displayName = name.trim();
      }
      setMessage('Saved!');
      setTimeout(onClose, 800);
    } catch {
      setMessage('Failed to save');
    }
    setSaving(false);
  };

  const removeAvatar = () => {
    setAvatarPreview('');
    setAvatar('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--bg-sidebar)] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-700"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeSlideUp 0.3s ease' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">User Settings</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all">
            ✕
          </button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-5">
          <div className="relative group cursor-pointer mb-3" onClick={() => fileInputRef.current?.click()}>
            {avatarPreview ? (
              <img src={avatarPreview}
                className="w-24 h-24 rounded-full object-cover border-4 border-[var(--bg-hover)]"
                alt="Avatar" />
            ) : (
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white border-4 border-[var(--bg-hover)]"
                style={{ backgroundColor: color }}>
                {(displayName || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center transition-all">
              <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">Change</span>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current?.click()}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              Upload Photo
            </button>
            {avatarPreview && (
              <button onClick={removeAvatar}
                className="text-xs text-red-400 hover:text-red-300 transition-colors">
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Display Name */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
            Display Name
          </label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            maxLength={20}
            className="w-full bg-[#1e1f22] text-[var(--text-primary)] rounded-lg p-3 outline-none focus:ring-2 focus:ring-[var(--accent)] border border-gray-700 transition-all"
            placeholder="Your name" />
        </div>

        {/* Info */}
        <div className="bg-[#232428] rounded-lg p-3 mb-4 text-xs text-[var(--text-muted)]">
          Your session ID: <span className="text-[var(--text-primary)] font-mono">{SESSION_ID.substring(0, 12)}...</span>
        </div>

        {/* Message */}
        {message && (
          <p className={`text-sm mb-3 text-center ${message === 'Saved!' ? 'text-green-400' : 'text-red-400'}`}>
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
      </div>
    </div>
  );
}
