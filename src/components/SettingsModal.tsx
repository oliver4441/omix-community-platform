import { useState, useRef } from 'react';
import { Store, getSessionId, getUserColor } from '../utils/store';
import { auth, db, firebase } from '../utils/firebase';
import { useAuth } from '../hooks/useAuth';
import { Icon } from './Icon';
import { triggerInstall } from '../utils/installPrompt';
import { useToast } from './Toast';
import type { IconName } from './Icon';

type Tab = 'general' | 'account' | 'danger';

export function SettingsModal({
  onClose,
  displayName,
  currentAvatar,
}: {
  onClose: () => void;
  displayName: string;
  currentAvatar: string;
}) {
  const [tab, setTab] = useState<Tab>('general');
  const [name, setName] = useState(displayName);
  const [avatar, setAvatar] = useState(currentAvatar);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [avatarPreview, setAvatarPreview] = useState(currentAvatar);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const color = getUserColor(displayName);
  const { user, signOut, isAdmin } = useAuth();
  const { toast } = useToast();

  // Install app state
  const [showInstallManual, setShowInstallManual] = useState(false);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || !!(navigator as any).standalone;

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Account deletion
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Admin promote
  const [promoteEmail, setPromoteEmail] = useState('');
  const [promoting, setPromoting] = useState(false);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 4000);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('Image too large. Max 2MB.', 'error');
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    // Upload immediately and update avatar
    Store.uploadAvatar(file)
      .then(url => {
        setAvatar(url);
        setAvatarPreview(url);
      })
      .catch(err => toast(typeof err === 'string' ? err : 'Upload failed', 'error'));
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
      showMsg('Saved!');
    } catch {
      showMsg('Failed to save', 'error');
    }
    setSaving(false);
  };

  const removeAvatar = () => {
    setAvatarPreview('');
    setAvatar('');
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      showMsg('Fill in all password fields', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showMsg('New password must be at least 6 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showMsg('Passwords do not match', 'error');
      return;
    }
    setSaving(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) throw new Error('Not authenticated');
      const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, currentPassword);
      await currentUser.reauthenticateWithCredential(credential);
      await currentUser.updatePassword(newPassword);
      showMsg('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'auth/wrong-password') {
        showMsg('Current password is incorrect', 'error');
      } else {
        showMsg(e.message || 'Failed to change password', 'error');
      }
    }
    setSaving(false);
  };

  // unused
  // const handleEmailChange = async () => {
  //   // This is a simplified version - ideally we'd have an input field
  //   showMsg('Contact admin to change email', 'error');
  // };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      showMsg('Enter your password to delete', 'error');
      return;
    }
    setDeleting(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) throw new Error('Not authenticated');
      const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, deletePassword);
      await currentUser.reauthenticateWithCredential(credential);
      // Delete user profile from Firestore
      await db.collection('profiles').doc(currentUser.uid).delete().catch(() => {});
      await currentUser.delete();
      window.location.reload();
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'auth/wrong-password') {
        showMsg('Password is incorrect', 'error');
      } else {
        showMsg(e.message || 'Failed to delete account', 'error');
      }
    }
    setDeleting(false);
  };

  const handlePromoteAdmin = async () => {
    if (!promoteEmail.trim()) return;
    setPromoting(true);
    try {
      // Find user by email in profiles collection
      const snap = await db.collection('profiles').where('email', '==', promoteEmail.trim()).get();
      if (snap.empty) {
        showMsg('No user found with that email', 'error');
        setPromoting(false);
        return;
      }
      const uid = snap.docs[0].id;
      await db.collection('config').doc('settings').set({ adminUid: uid }, { merge: true });
      showMsg(`Admin promoted! User must re-login`);
      setPromoteEmail('');
    } catch {
      showMsg('Failed to promote user', 'error');
    }
    setPromoting(false);
  };

  const tabs: { id: Tab; label: string; icon: IconName }[] = [
    { id: 'general', label: 'General', icon: 'user' },
    { id: 'account', label: 'Security', icon: 'shield' },
    { id: 'danger', label: 'Danger Zone', icon: 'alert-triangle' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[var(--bg-sidebar)] rounded-2xl w-full max-w-lg shadow-2xl border border-gray-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeSlideUp 0.3s ease' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">User Settings</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all" aria-label="Close settings">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 px-4">
          {tabs.map(t => (
            <button key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                tab === t.id
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}>
              <Icon name={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scroll">
          {/* Message */}
          {message && (
            <div className={`px-4 py-2 rounded-lg mb-4 text-sm ${
              messageType === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {message}
            </div>
          )}

          {/* === TAB: GENERAL === */}
          {tab === 'general' && (
            <div className="space-y-5">
              {/* Avatar */}
              <div className="flex flex-col items-center">
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
                <div className="flex gap-3">
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
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                  Display Name
                </label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  maxLength={20}
                  className="w-full bg-[#1e1f22] text-[var(--text-primary)] rounded-lg p-3 outline-none focus:ring-2 focus:ring-[var(--accent)] border border-gray-700 transition-all"
                  placeholder="Your name" />
              </div>

              {/* Info */}
              <div className="bg-[#232428] rounded-lg p-3 text-xs text-[var(--text-muted)] space-y-1">
                <div>Email: <span className="text-[var(--text-primary)]">{user?.email || '—'}</span></div>
                <div>ID: <span className="text-[var(--text-primary)] font-mono">{getSessionId().substring(0, 12)}...</span></div>
              </div>

              {/* Install App — only if not already in standalone mode */}
              {!isStandalone && (
                <div className="bg-[var(--accent-subtle)] border border-[var(--accent)]/20 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-0">
                    <div className="w-9 h-9 rounded-full bg-[var(--accent)]/20 flex items-center justify-center shrink-0">
                      <Icon name="download" size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">Install App</div>
                      <div className="text-xs text-[var(--text-muted)]">Add to your home screen for the best experience</div>
                    </div>
                  </div>
                  {!showInstallManual ? (
                    <button onClick={async () => {
                      const installed = await triggerInstall();
                      if (!installed) setShowInstallManual(true);
                    }}
                      className="mt-3 w-full btn-accent py-2.5 rounded-lg font-semibold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all">
                      Install Omix Community
                    </button>
                  ) : (
                    <div className="mt-3 bg-[#1e1f22] rounded-xl p-3 text-xs text-[var(--text-muted)] space-y-2">
                      <div className="font-medium text-white text-sm mb-1">How to install:</div>
                      <div>• Chrome/Edge: tap menu (⋮) → "Add to Home Screen"</div>
                      <div>• Safari (iPhone/iPad): tap Share (☐↑) → "Add to Home Screen"</div>
                      <div>• Samsung Internet: tap menu (☰) → "Add page to" → "Home screen"</div>
                      <button onClick={() => setShowInstallManual(false)}
                        className="text-[var(--accent)] hover:underline mt-1 text-xs">
                        Try automatic install
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button onClick={handleSave} disabled={saving || !name.trim()}
                className="btn-accent w-full py-3 rounded-lg font-semibold text-sm disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* === TAB: ACCOUNT SECURITY === */}
          {tab === 'account' && (
            <div className="space-y-5">
              {/* Change Password */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Change Password</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Current Password</label>
                    <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                      className="w-full bg-[#1e1f22] text-[var(--text-primary)] rounded-lg p-3 outline-none focus:ring-2 focus:ring-[var(--accent)] border border-gray-700"
                      placeholder="Current password" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">New Password</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      className="w-full bg-[#1e1f22] text-[var(--text-primary)] rounded-lg p-3 outline-none focus:ring-2 focus:ring-[var(--accent)] border border-gray-700"
                      placeholder="At least 6 characters" minLength={6} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">Confirm New Password</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full bg-[#1e1f22] text-[var(--text-primary)] rounded-lg p-3 outline-none focus:ring-2 focus:ring-[var(--accent)] border border-gray-700"
                      placeholder="Confirm new password" />
                  </div>
                  <button onClick={handleChangePassword} disabled={saving}
                    className="btn-accent w-full py-3 rounded-lg font-semibold text-sm disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]">
                    {saving ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-700 my-2" />

              {/* Admin Section */}
              {isAdmin && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--accent)] mb-3">Admin Actions</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-[var(--text-muted)] block mb-1">
                        Promote User to Admin (by email)
                      </label>
                      <div className="flex gap-2">
                        <input type="email" value={promoteEmail} onChange={e => setPromoteEmail(e.target.value)}
                          className="flex-1 bg-[#1e1f22] text-[var(--text-primary)] rounded-lg p-3 outline-none focus:ring-2 focus:ring-[var(--accent)] border border-gray-700"
                          placeholder="user@example.com" />
                        <button onClick={handlePromoteAdmin} disabled={promoting || !promoteEmail.trim()}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-white disabled:opacity-50 hover:opacity-90 transition-all">
                          {promoting ? '...' : 'Promote'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sign Out */}
              <button onClick={() => { signOut(); window.location.reload(); }}
                className="w-full py-3 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all border border-gray-700">
                Sign Out
              </button>
            </div>
          )}

          {/* === TAB: DANGER ZONE === */}
          {tab === 'danger' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-red-400 border-b border-red-500/20 pb-3">
                <Icon name="alert-triangle" size={18} />
                <span className="text-sm font-bold uppercase tracking-wider">Danger Zone</span>
              </div>

              {/* Delete Account */}
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-red-400 mb-1">Delete Account</h3>
                <p className="text-xs text-[var(--text-muted)] mb-3">
                  Permanently delete your account and all data. This cannot be undone.
                </p>
                {!deleteConfirm ? (
                  <button onClick={() => setDeleteConfirm(true)}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all border border-red-500/30">
                    Delete My Account
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-red-400 font-semibold">
                      Are you sure? This is permanent.
                    </p>
                    <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)}
                      className="w-full bg-[#1e1f22] text-[var(--text-primary)] rounded-lg p-3 outline-none focus:ring-2 focus:ring-red-500 border border-red-500/30"
                      placeholder="Enter your password to confirm" />
                    <div className="flex gap-2">
                      <button onClick={handleDeleteAccount} disabled={deleting || !deletePassword}
                        className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-500 text-white disabled:opacity-50 hover:bg-red-600 transition-all">
                        {deleting ? 'Deleting...' : 'Permanently Delete'}
                      </button>
                      <button onClick={() => { setDeleteConfirm(false); setDeletePassword(''); }}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-gray-700 transition-all">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
