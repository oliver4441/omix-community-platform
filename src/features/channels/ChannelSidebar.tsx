"use client";

// Mutating the global Store singleton (src/lib/store.ts) from event handlers is
// this app's established state pattern (Store + window events). The React
// Compiler immutability rule doesn't apply to this architecture.
/* eslint-disable react-hooks/immutability */

import { useState, useEffect, useRef } from "react";
import { Store, getUserColor } from "@/lib/store";
import type { Channel, User, UserStats } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmModal";
import {
  Hash,
  Plus,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
  Trash2,
  X,
  Phone,
} from "@/components/ui/icons";

// ─── Inline Settings Modal ────────────────────────────────────────────────
function SettingsModal({
  onClose,
  displayName,
  currentAvatar,
}: {
  onClose: () => void;
  displayName: string;
  currentAvatar: string;
}) {
  const [tab, setTab] = useState<"general" | "account" | "danger">("general");
  const [name, setName] = useState(displayName);
  const [avatar, setAvatar] = useState(currentAvatar);
  const [avatarPreview, setAvatarPreview] = useState(currentAvatar);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const color = getUserColor(displayName);
  const { user, signOut, isAdmin } = useAuth();
  const { toast } = useToast();

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Account deletion
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Admin promote
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoting, setPromoting] = useState(false);

  const showMsg = (text: string, type: "success" | "error" = "success") => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(""), 4000);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast("Image too large. Max 2MB.", "error");
      return;
    }
    setAvatarPreview(URL.createObjectURL(file));
    Store.uploadAvatar(file)
      .then((url) => {
        setAvatar(url);
        setAvatarPreview(url);
      })
      .catch((err) => toast(typeof err === "string" ? err : "Upload failed", "error"));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await Store.saveProfile({
        name: name.trim() || undefined,
        avatar: avatar || undefined,
      });
      if (name.trim() && name.trim() !== displayName) {
        Store.displayName = name.trim();
      }
      showMsg("Saved!");
    } catch {
      showMsg("Failed to save", "error");
    }
    setSaving(false);
  };

  const removeAvatar = () => {
    setAvatarPreview("");
    setAvatar("");
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      showMsg("Fill in all password fields", "error");
      return;
    }
    if (newPassword.length < 6) {
      showMsg("New password must be at least 6 characters", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showMsg("Passwords do not match", "error");
      return;
    }
    setSaving(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) throw new Error("Not authenticated");
      // Supabase requires re-authentication via email + current password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (authError) throw new Error("Current password is incorrect");
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
      showMsg("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const e = err as { message?: string };
      showMsg(e.message || "Failed to change password", "error");
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      showMsg("Enter your password to delete", "error");
      return;
    }
    setDeleting(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) throw new Error("Not authenticated");
      // Re-authenticate first
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      });
      if (authError) throw new Error("Password is incorrect");
      // Delete profile
      await supabase.from("profiles").delete().eq("session_id", user.id);
      // Delete user account (requires service role — will fail gracefully)
      await supabase.auth.admin.deleteUser(user.id).catch(() => {});
      window.location.reload();
    } catch (err: unknown) {
      const e = err as { message?: string };
      showMsg(e.message || "Failed to delete account", "error");
    }
    setDeleting(false);
  };

  const handlePromoteAdmin = async () => {
    if (!promoteEmail.trim()) return;
    setPromoting(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      // Note: profiles table doesn't have email column — users are identified by session_id
      // For now, store admin by email in config
      const { error } = await supabase
        .from("config")
        .upsert({ id: "settings", data: { adminEmail: promoteEmail.trim() } });
      if (error) throw error;
      showMsg("Admin promoted! User must re-login");
      setPromoteEmail("");
    } catch {
      showMsg("Failed to promote user", "error");
    }
    setPromoting(false);
  };

  const tabs: { id: string; label: string; icon: typeof Settings }[] = [
    { id: "general", label: "General", icon: Settings },
    { id: "account", label: "Security", icon: Shield },
    { id: "danger", label: "Danger Zone", icon: Trash2 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(7, 11, 20, 0.8)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-[var(--color-bg-dark)] rounded-[20px] w-full max-w-lg shadow-2xl border border-[var(--color-border)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "scaleIn 0.15s ease" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-bold text-[var(--color-txt)]">User Settings</h2>
          <button
            onClick={onClose}
            className="btn-icon"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--color-border)] px-4">
          {tabs.map((t) => {
            const IconComp = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as typeof tab)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                  tab === t.id
                    ? "border-[var(--color-acc)] text-[var(--color-acc)]"
                    : "border-transparent text-[var(--color-txt-muted)] hover:text-[var(--color-txt)]"
                }`}
              >
                <IconComp size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Message */}
          {message && (
            <div
              className={`px-4 py-2 rounded-[20px] mb-4 text-sm ${
                messageType === "success"
                  ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                  : "bg-[var(--color-dnd)]/10 text-[var(--color-dnd)]"
              }`}
            >
              {message}
            </div>
          )}

          {/* Tab: General */}
          {tab === "general" && (
            <div className="space-y-5">
              {/* Avatar */}
              <div className="flex flex-col items-center">
                <div
                  className="relative group cursor-pointer mb-3"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      className="w-24 h-24 rounded-full object-cover border-4 border-[var(--color-border)]"
                      alt="Avatar"
                    />
                  ) : (
                    <div
                      className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white border-4 border-[var(--color-border)]"
                      style={{ backgroundColor: color }}
                    >
                      {(displayName || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
                    <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Change
                    </span>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-[var(--color-txt-muted)] hover:text-[var(--color-txt)] transition-colors"
                  >
                    Upload Photo
                  </button>
                  {avatarPreview && (
                    <button
                      onClick={removeAvatar}
                      className="text-xs text-[var(--color-dnd)] hover:text-[var(--color-danger-hover)] transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="text-xs font-semibold text-[var(--color-txt-muted)] uppercase tracking-wider block mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                  className="input-field"
                  placeholder="Your name"
                />
              </div>

              {/* Info */}
              <div className="surface p-3 text-xs text-[var(--color-txt-muted)] space-y-1">
                <div>
                  Email:{" "}
                  <span className="text-[var(--color-txt)]">{user?.email || "—"}</span>
                </div>
                <div>
                  ID:{" "}
                  <span className="text-[var(--color-txt)] font-mono">
                    {(user?.uid || "").substring(0, 12)}...
                  </span>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="btn-primary w-full disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}

          {/* Tab: Account Security */}
          {tab === "account" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-txt)] mb-3">
                  Change Password
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--color-txt-muted)] block mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="input-field"
                      placeholder="Current password"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--color-txt-muted)] block mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-field"
                      placeholder="At least 6 characters"
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[var(--color-txt-muted)] block mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-field"
                      placeholder="Confirm new password"
                    />
                  </div>
                  <button
                    onClick={handleChangePassword}
                    disabled={saving}
                    className="btn-primary w-full disabled:opacity-50"
                  >
                    {saving ? "Changing..." : "Change Password"}
                  </button>
                </div>
              </div>

              <div className="border-t border-[var(--color-border)] my-2" />

              {isAdmin && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-acc)] mb-3">
                    Admin Actions
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-[var(--color-txt-muted)] block mb-1">
                        Promote User to Admin (by email)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={promoteEmail}
                          onChange={(e) => setPromoteEmail(e.target.value)}
                          className="input-field flex-1"
                          placeholder="user@example.com"
                        />
                        <button
                          onClick={handlePromoteAdmin}
                          disabled={promoting || !promoteEmail.trim()}
                          className="px-4 py-2 rounded-[20px] text-sm font-medium bg-[var(--color-acc)] text-white disabled:opacity-50 hover:opacity-90 transition-all"
                        >
                          {promoting ? "..." : "Promote"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  signOut();
                  window.location.reload();
                }}
                className="w-full py-3 rounded-[20px] text-sm font-medium text-[var(--color-dnd)] hover:bg-[var(--color-dnd)]/10 transition-all border border-[var(--color-border)]"
              >
                Sign Out
              </button>
            </div>
          )}

          {/* Tab: Danger Zone */}
          {tab === "danger" && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-[var(--color-dnd)] border-b border-[var(--color-dnd)]/20 pb-3">
                <Trash2 size={18} />
                <span className="text-sm font-bold uppercase tracking-wider">
                  Danger Zone
                </span>
              </div>

              <div className="bg-[var(--color-dnd)]/5 border border-[var(--color-dnd)]/20 rounded-[20px] p-4">
                <h3 className="text-sm font-semibold text-[var(--color-dnd)] mb-1">
                  Delete Account
                </h3>
                <p className="text-xs text-[var(--color-txt-muted)] mb-3">
                  Permanently delete your account and all data. This cannot be
                  undone.
                </p>
                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="px-4 py-2 rounded-[20px] text-sm font-medium bg-[var(--color-dnd)]/20 text-[var(--color-dnd)] hover:bg-[var(--color-dnd)]/30 transition-all border border-[var(--color-dnd)]/30"
                  >
                    Delete My Account
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-[var(--color-dnd)] font-semibold">
                      Are you sure? This is permanent.
                    </p>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="input-field border-[var(--color-dnd)]/30"
                      placeholder="Enter your password to confirm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleting || !deletePassword}
                        className="flex-1 py-2 rounded-[20px] text-sm font-medium bg-[var(--color-dnd)] text-white disabled:opacity-50 hover:bg-[var(--color-danger-hover)] transition-all"
                      >
                        {deleting ? "Deleting..." : "Permanently Delete"}
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConfirm(false);
                          setDeletePassword("");
                        }}
                        className="px-4 py-2 rounded-[20px] text-sm font-medium text-[var(--color-txt-muted)] hover:text-[var(--color-txt)] border border-[var(--color-border)] transition-all"
                      >
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

// ─── Channel Sidebar ──────────────────────────────────────────────────────

export function ChannelSidebar({
  isMobile,
  currentView,
  displayName,
}: {
  isMobile: boolean;
  currentView: string;
  displayName: string;
}) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [activeChannel, setActiveChannel] = useState<string | null>(
    Store.currentChannelId
  );
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newChanName, setNewChanName] = useState("");
  const [newChanIconFile, setNewChanIconFile] = useState<File | null>(null);
  const [newChanIconPreview, setNewChanIconPreview] = useState("");
  const [unreadCounts, setUnreadCounts] = useState(Store.unreadCounts);
  const [showSettings, setShowSettings] = useState(false);
  const [avatar, setAvatar] = useState("");
  const [userStats, setUserStats] = useState<{
    level: number;
    xp: number;
    badges: string[];
  } | null>(null);
  const unreadInterval = useRef<ReturnType<typeof setInterval>>(undefined);
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const chanFileRef = useRef<HTMLInputElement>(null);

  // Load user profile
  useEffect(() => {
    void Store.getProfile(Store.sessionId).then((profile) => {
      if (profile?.avatar) setAvatar(profile.avatar);
    });
    const unsub = Store.subscribeProfile((p) => {
      if (p.avatar) setAvatar(p.avatar);
      else setAvatar("");
    });
    return () => void unsub();
  }, []);

  // Load user stats (XP / level)
  useEffect(() => {
    const unsub = Store.subscribeStats((stats) => {
      setUserStats({
        level: stats.level,
        xp: stats.xp,
        badges: stats.badges || [],
      });
    });
    return () => void unsub();
  }, []);

  // Subscribe to channels and presence
  useEffect(() => {
    const serverId = Store.currentServerId;
    const unsubChannels = Store.subscribeChannels(serverId, (_, data) => {
      setChannels(data as Channel[]);
      setChannelsLoaded(true);
    });
    Store.setPresence(displayName || "Guest");
    const unsubPresence = Store.subscribePresence(setOnlineUsers);

    unreadInterval.current = setInterval(
      () => setUnreadCounts({ ...Store.unreadCounts }),
      2000
    );

    const handler = (e: CustomEvent) => {
      Store.cleanup();
      Store.subscribeChannels(e.detail, (_, data) =>
        setChannels(data as Channel[])
      );
      Store.setPresence(displayName || "Guest");
      setActiveChannel(null);
    };
    window.addEventListener("serverChanged", handler as EventListener);

    return () => {
      unsubChannels();
      unsubPresence();
      if (unreadInterval.current) clearInterval(unreadInterval.current);
      window.removeEventListener("serverChanged", handler as EventListener);
    };
  }, [displayName]);

  const selectChannel = (channelId: string) => {
    Store.currentChannelId = channelId;
    Store.currentChannelType = "channel";
    Store.currentDMChannelName = "";
    Store.markChannelRead(channelId);
    setActiveChannel(channelId);
    setUnreadCounts({ ...Store.unreadCounts });
    window.dispatchEvent(
      new CustomEvent("channelChanged", { detail: channelId })
    );
  };

  const createChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChanName.trim()) return;
    const id = await Store.createChannel(
      Store.currentServerId,
      newChanName.trim(),
      "Text Channels"
    );
    if (newChanIconFile) {
      try {
        await Store.uploadChannelIcon(newChanIconFile, id);
      } catch (err) {
        console.error("Channel icon upload failed:", err);
      }
    }
    setShowCreate(false);
    setNewChanName("");
    setNewChanIconFile(null);
    setNewChanIconPreview("");
  };

  const deleteChannel = async (
    e: React.MouseEvent,
    channelId: string,
    name: string
  ) => {
    e.stopPropagation();
    if (!Store.isAdmin) return;
    const ok = await confirm({
      title: "Delete Channel",
      message: `Delete #${name}? This cannot be undone.`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (ok) {
      Store.deleteChannel(channelId);
    }
  };

  if (isMobile && currentView !== "channels") return null;

  const categories: Record<string, Channel[]> = {};
  channels.forEach((ch) => {
    const cat = ch.category || "Text Channels";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(ch);
  });

  return (
    <div
      className="w-[240px] bg-[var(--color-bg-dark)] h-full flex flex-col flex-shrink-0 border-r border-[var(--color-border)]"
      data-name="channel-sidebar"
      role="navigation"
      aria-label="Channel navigation"
    >
      {/* Server header */}
      <div className="h-12 border-b border-[var(--color-border)] flex items-center px-3 cursor-pointer transition-colors hover:bg-[var(--color-bg-hover)] gap-2 shrink-0">
        <div className="w-7 h-7 rounded-[12px] bg-[var(--color-pri)] flex items-center justify-center text-white text-xs font-bold shrink-0">
          O
        </div>
        <span className="font-bold text-[var(--color-txt)] text-sm truncate">
          Omix Community
        </span>
        {Store.isAdmin && (
          <span className="ml-auto text-[10px] bg-[var(--color-acc)] text-white px-1.5 py-0.5 rounded-[20px] font-medium">
            ADMIN
          </span>
        )}
        <ChevronDown
          size={16}
          className="text-[var(--color-txt-muted)] shrink-0"
        />
      </div>

      {/* Online indicator */}
      <div className="text-xs text-[var(--color-txt-muted)] px-4 py-2 flex items-center gap-1.5 border-b border-[var(--color-border)] shrink-0">
        <div
          className="w-2 h-2 rounded-full bg-[var(--color-online)]"
          style={{ animation: "pulse 2s ease infinite" }}
        />
        <span className="font-medium">{onlineUsers.length} online</span>
        <div className="flex ml-auto">
          {onlineUsers.slice(0, 8).map((u) => (
            <div
              key={u.id}
              className="w-5 h-5 rounded-full -ml-1 border-2 border-[var(--color-bg-dark)] overflow-hidden cursor-pointer transition-transform hover:scale-110"
              title={u.name}
            >
              {u.avatar ? (
                <img
                  src={u.avatar}
                  className="w-full h-full object-cover"
                  alt=""
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ backgroundColor: u.color || "#5865f2" }}
                >
                  {u.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ))}
          {onlineUsers.length > 8 && (
            <div className="w-5 h-5 rounded-full bg-[var(--color-bg-hover)] -ml-1 border-2 border-[var(--color-bg-dark)] flex items-center justify-center text-[9px] text-[var(--color-txt-muted)] font-bold">
              +{onlineUsers.length - 8}
            </div>
          )}
        </div>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto p-2">
        {!channelsLoaded ? (
          <div className="px-2 mt-4 space-y-1" aria-label="Loading channels">
            <div className="skeleton h-3 w-24 mb-3" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-2">
                <div className="skeleton h-4 w-4 rounded" />
                <div className="skeleton h-3 flex-1" />
              </div>
            ))}
            <div className="skeleton h-3 w-20 mt-4 mb-3" />
            {[1, 2].map((i) => (
              <div key={`s2-${i}`} className="flex items-center gap-2 px-2 py-2">
                <div className="skeleton h-4 w-4 rounded" />
                <div className="skeleton h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : Object.keys(categories).length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 px-4">
            <Hash size={28} className="text-[var(--color-txt-muted)] mb-3 opacity-40" />
            <p className="text-sm text-[var(--color-txt-muted)]">
              No channels in this server
            </p>
            {Store.isAdmin && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-3 btn-primary text-xs py-1.5"
                aria-label="Create a channel"
              >
                <Plus size={14} />
                Create Channel
              </button>
            )}
          </div>
        ) : (
          Object.entries(categories).map(([catName, chans]) => (
            <div key={catName}>
              <div className="text-[11px] font-semibold text-[var(--color-txt-muted)] uppercase tracking-wider mb-1 mt-4 px-2 flex justify-between items-center group cursor-pointer hover:text-[var(--color-txt)] transition-colors">
                {catName}
                <button
                  onClick={() => setShowCreate(true)}
                  className="hidden group-hover:block text-[var(--color-txt-muted)] hover:text-[var(--color-txt)] transition-colors p-0.5"
                  aria-label={`Create channel in ${catName}`}
                >
                  <Plus size={14} />
                </button>
              </div>
              <div role="list" aria-label={`${catName} channels`}>
                {chans.map((channel) => {
                  const unread = unreadCounts[channel.id] || 0;
                  const isVoiceChannel = channel.type === "voice";
                  return (
                    <div
                      key={channel.id}
                      onClick={() => selectChannel(channel.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectChannel(channel.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${isVoiceChannel ? 'Voice channel' : 'Channel'} #${channel.name}${unread > 0 ? `, ${unread} unread` : ''}`}
                      className={`flex items-center px-2 py-1.5 mx-1 rounded-[12px] cursor-pointer group mb-[2px] transition-all relative ${
                        activeChannel === channel.id
                          ? "bg-[var(--color-bg-active)] text-[var(--color-txt)]"
                          : "text-[var(--color-txt-muted)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-txt)]"
                      }`}
                    >
                    {/* Active indicator */}
                    <div
                      className={`absolute -left-1 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full transition-all ${
                        activeChannel === channel.id
                          ? "bg-[var(--color-acc)] scale-y-100"
                          : "bg-transparent scale-y-0 group-hover:scale-y-100 group-hover:bg-[var(--color-txt-muted)]"
                      }`}
                    />
                    {channel.icon ? (
                      <img
                        src={channel.icon}
                        className="w-4 h-4 rounded mr-1.5 object-cover shrink-0"
                        alt=""
                      />
                    ) : isVoiceChannel ? (
                      <Phone
                        size={16}
                        className="mr-1.5 opacity-60 shrink-0"
                      />
                    ) : (
                      <Hash
                        size={16}
                        className="mr-1.5 opacity-60 shrink-0"
                      />
                    )}
                    <span
                      className={`truncate flex-1 text-sm ${
                        unread > 0
                          ? "text-[var(--color-txt)] font-semibold"
                          : ""
                      }`}
                    >
                      {channel.name}
                    </span>
                    {isVoiceChannel && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] bg-[var(--color-acc-muted)] text-[var(--color-acc)] px-1.5 py-0.5 rounded-[20px] font-medium">
                          Voice
                        </span>
                      </div>
                    )}
                    {Store.isAdmin && (
                      <button
                        onClick={(e) =>
                          deleteChannel(e, channel.id, channel.name)
                        }
                        className="hidden group-hover:flex text-[var(--color-txt-muted)] hover:text-[var(--color-dnd)] mr-1 transition-colors items-center justify-center p-0.5"
                        aria-label={`Delete channel #${channel.name}`}
                      >
                        <X size={12} />
                      </button>
                    )}
                    {unread > 0 && (
                      <span className="ml-1 bg-[var(--color-acc)] text-white text-xs rounded-full px-1.5 py-0.5 font-bold min-w-[18px] text-center leading-tight">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                );
              })}
              </div>

              {/* Create channel form */}
              {showCreate && (
                <div className="mt-4 px-2">
                  <form onSubmit={createChannel} className="flex flex-col gap-2">
                    {/* Channel icon preview */}
                    <div className="flex justify-center mb-1">
                      <div
                        className="relative group cursor-pointer"
                        onClick={() => chanFileRef.current?.click()}
                        role="button"
                        tabIndex={0}
                        aria-label="Upload channel icon"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            chanFileRef.current?.click();
                          }
                        }}
                      >
                        {newChanIconPreview ? (
                          <img
                            src={newChanIconPreview}
                            className="w-10 h-10 rounded-[12px] object-cover"
                            alt="Channel icon preview"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-[12px] bg-[var(--color-bg-mid)] flex items-center justify-center text-[var(--color-txt-muted)] border border-[var(--color-border)]">
                            <Hash size={18} />
                          </div>
                        )}
                      </div>
                      <input
                        ref={chanFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        aria-hidden="true"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file || file.size > 2 * 1024 * 1024) {
                            toast("Image too large (max 2MB)", "error");
                            return;
                          }
                          setNewChanIconFile(file);
                          setNewChanIconPreview(URL.createObjectURL(file));
                        }}
                      />
                    </div>
                    <label
                      htmlFor="create-channel-name"
                      className="text-xs font-semibold text-[var(--color-txt-muted)] uppercase tracking-wider block"
                    >
                      Channel Name
                    </label>
                    <input
                      id="create-channel-name"
                      type="text"
                      placeholder="Channel name"
                      onChange={(e) => setNewChanName(e.target.value)}
                      className="input-field"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="btn-primary text-xs px-3 py-1.5 flex-1"
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreate(false);
                          setNewChanName("");
                          setNewChanIconFile(null);
                          setNewChanIconPreview("");
                        }}
                        className="text-xs text-[var(--color-txt-muted)] hover:text-[var(--color-txt)] px-3 py-1.5"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* User area at bottom */}
      <div
        className="h-[52px] bg-[var(--color-bg-mid)] px-3 flex items-center gap-2 shrink-0 border-t border-[var(--color-border)]"
        data-name="user-area"
        role="region"
        aria-label="User settings"
      >
        <div
          className="w-9 h-9 rounded-full overflow-hidden shrink-0 transition-transform hover:scale-105"
          onClick={() => setShowSettings(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShowSettings(true);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Open settings for ${displayName}`}
        >
          {avatar ? (
            <img
              src={avatar}
              className="w-full h-full object-cover"
              alt={`${displayName}'s avatar`}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: getUserColor(displayName) }}
            >
              {(displayName || "?").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setShowSettings(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShowSettings(true);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`User settings for ${displayName}`}
        >
          <div className="text-sm text-[var(--color-txt)] font-semibold truncate flex items-center gap-1.5">
            {displayName}
            {userStats && (
              <span className="text-[10px] bg-[var(--color-pri-muted)] text-[var(--color-pri)] px-1.5 py-0.5 rounded-[20px] font-bold">
                Lv.{userStats.level}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[var(--color-online)]" />
            <span className="text-xs text-[var(--color-txt-muted)]">Online</span>
            {userStats && userStats.xp > 0 && (
              <span className="text-[10px] text-[var(--color-txt-muted)] ml-1">
                {userStats.xp} XP
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="btn-icon"
          aria-label="Open settings"
        >
          <Settings size={18} />
        </button>
        <button
          onClick={() => {
            signOut();
            window.location.reload();
          }}
          className="btn-icon hover:!text-[var(--color-dnd)]"
          aria-label="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          displayName={displayName}
          currentAvatar={avatar}
        />
      )}
    </div>
  );
}
