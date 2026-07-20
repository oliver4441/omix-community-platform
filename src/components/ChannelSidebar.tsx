import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Store, getUserColor } from '../utils/store';
import type { Channel, User } from '../types';
import { useAuth } from '../hooks/useAuth';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmProvider';
import { LoadingFallback } from './Fallbacks';
import { ErrorBoundary } from './ErrorBoundary';

const SettingsModal = lazy(() => import('./SettingsModal').then(m => ({ default: m.SettingsModal })));
const JitsiCall = lazy(() => import('./JitsiCall').then(m => ({ default: m.JitsiCall })));

export function ChannelSidebar({
  isMobile,
  currentView,
  displayName,
}: { isMobile: boolean; currentView: string; displayName: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [activeChannel, setActiveChannel] = useState<string | null>(Store.currentChannelId);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newChanName, setNewChanName] = useState('');
  const [newChanIconFile, setNewChanIconFile] = useState<File | null>(null);
  const [newChanIconPreview, setNewChanIconPreview] = useState('');
  const [unreadCounts, setUnreadCounts] = useState(Store.unreadCounts);
  const [showSettings, setShowSettings] = useState(false);
  const [avatar, setAvatar] = useState('');
  const [userStats, setUserStats] = useState<{ level: number; xp: number; badges: string[] } | null>(null);
  const [showJitsiCall, setShowJitsiCall] = useState(false);
  const [callChannelId, setCallChannelId] = useState<string | null>(null);
  const unreadInterval = useRef<ReturnType<typeof setInterval>>();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const chanFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load user profile
    Store.getProfile(Store.sessionId).then(profile => {
      if (profile?.avatar) setAvatar(profile.avatar);
    });
    const unsub = Store.subscribeProfile(p => {
      if (p.avatar) setAvatar(p.avatar);
      else setAvatar('');
    });
    return unsub;
  }, []);

  // Load user stats (XP / level) via Firestore snapshot
  useEffect(() => {
    const unsub = Store.subscribeStats(stats => {
      setUserStats({ level: stats.level, xp: stats.xp, badges: stats.badges || [] });
    });
    return unsub;
  }, []);

  // Subscribe to channels and presence
  useEffect(() => {
    const serverId = Store.currentServerId;
    const unsubChannels = Store.subscribeChannels(serverId, (_, data) => {
      setChannels(data as Channel[]);
      setChannelsLoaded(true);
    });
    Store.setPresence(displayName || 'Guest');
    const unsubPresence = Store.subscribePresence(setOnlineUsers);

    unreadInterval.current = setInterval(() => setUnreadCounts({ ...Store.unreadCounts }), 2000);

    const handler = (e: CustomEvent) => {
      Store.cleanup();
      Store.subscribeChannels(e.detail, (_, data) => setChannels(data as Channel[]));
      Store.setPresence(displayName || 'Guest');
      setActiveChannel(null);
    };
    window.addEventListener('serverChanged', handler as EventListener);

    return () => {
      unsubChannels();
      unsubPresence();
      if (unreadInterval.current) clearInterval(unreadInterval.current);
      window.removeEventListener('serverChanged', handler as EventListener);
    };
  }, [displayName]);

  const selectChannel = (channelId: string) => {
    Store.currentChannelId = channelId;
    Store.currentChannelType = 'channel';
    Store.currentDMChannelName = '';
    Store.markChannelRead(channelId);
    setActiveChannel(channelId);
    setUnreadCounts({ ...Store.unreadCounts });
    window.dispatchEvent(new CustomEvent('channelChanged', { detail: channelId }));
  };

  const createChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChanName.trim()) return;
    const id = await Store.createChannel(Store.currentServerId, newChanName.trim(), 'Text Channels');
    if (newChanIconFile) {
      try {
        await Store.uploadChannelIcon(newChanIconFile, id);
      } catch (err) {
        console.error('Channel icon upload failed:', err);
      }
    }
    setShowCreate(false);
    setNewChanName('');
    setNewChanIconFile(null);
    setNewChanIconPreview('');
  };

  const deleteChannel = async (e: React.MouseEvent, channelId: string, name: string) => {
    e.stopPropagation();
    if (!Store.isAdmin) return;
    const ok = await confirm({
      title: 'Delete Channel',
      message: `Delete #${name}? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (ok) {
      Store.deleteChannel(channelId);
    }
  };

  if (isMobile && currentView !== 'channels') return null;

  const categories: Record<string, Channel[]> = {};
  channels.forEach(ch => {
    const cat = ch.category || 'Text Channels';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(ch);
  });

  return (
    <div className="w-[240px] bg-[var(--bg-sidebar)] h-full flex flex-col flex-shrink-0" data-name="channel-sidebar" data-file="components/ChannelSidebar.tsx">
      <div className="h-12 border-b border-[var(--bg-rail)] flex items-center px-3 shadow-sm cursor-pointer transition-colors hover:bg-[var(--bg-hover)] gap-2">
        <img src="logo.jpg" className="w-7 h-7 rounded-md object-cover shrink-0" alt="" />
        <span className="font-bold text-[var(--text-primary)] text-sm truncate">Omix Community</span>
        {Store.isAdmin && <span className="ml-auto text-[10px] bg-[var(--accent)] text-white px-1.5 py-0.5 rounded font-medium">ADMIN</span>}
        <Icon name="chevron-down" size={16} className="text-[var(--text-muted)]" />
      </div>

      <div className="text-xs text-[var(--text-muted)] px-4 py-2 flex items-center gap-1.5 border-b border-[var(--bg-rail)]">
        <div className="w-2 h-2 rounded-full bg-[var(--online)]" style={{ animation: 'pulse 2s ease infinite' }} />
        <span className="font-medium">{onlineUsers.length} online</span>
        <div className="flex ml-auto">
          {onlineUsers.slice(0, 8).map(u => (
            <div key={u.id} className="w-5 h-5 rounded-full -ml-1 border-2 border-[var(--bg-sidebar)] overflow-hidden cursor-pointer transition-transform hover:scale-110" title={u.name}>
              {u.avatar ? (
                <img src={u.avatar} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ backgroundColor: u.color || '#5865f2' }}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ))}
          {onlineUsers.length > 8 && (
            <div className="w-5 h-5 rounded-full bg-[var(--bg-hover)] -ml-1 border-2 border-[var(--bg-sidebar)] flex items-center justify-center text-[9px] text-[var(--text-muted)] font-bold">
              +{onlineUsers.length - 8}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-custom p-2">
        {!channelsLoaded ? (
          /* Loading skeleton */
          <div className="px-2 mt-4 space-y-1">
            <div className="skeleton h-3 w-24 mb-3" />
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-2 px-2 py-2">
                <div className="skeleton h-4 w-4 rounded" />
                <div className="skeleton h-3 flex-1" />
              </div>
            ))}
            <div className="skeleton h-3 w-20 mt-4 mb-3" />
            {[1,2].map(i => (
              <div key={`s2-${i}`} className="flex items-center gap-2 px-2 py-2">
                <div className="skeleton h-4 w-4 rounded" />
                <div className="skeleton h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) :
        Object.entries(categories).map(([catName, chans]) => (
          <div key={catName}>
            <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 mt-4 px-2 flex justify-between items-center group cursor-pointer hover:text-[var(--text-primary)] transition-colors">
              {catName}
              <button onClick={() => setShowCreate(true)} className="hidden group-hover:block text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-0.5">
                <Icon name="plus" size={14} />
              </button>
            </div>
            {chans.map(channel => {
              const unread = unreadCounts[channel.id] || 0;
              const isVoiceChannel = channel.type === 'voice';
              return (
                <div
                  key={channel.id}
                  onClick={() => {
                    if (isVoiceChannel) {
                      setCallChannelId(channel.id);
                      setShowJitsiCall(true);
                    } else {
                      selectChannel(channel.id);
                    }
                  }}
                  className={`flex items-center px-2 py-1.5 mx-1 rounded-lg cursor-pointer group mb-[2px] transition-all relative ${
                    activeChannel === channel.id
                      ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className={`absolute -left-1 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full transition-all ${
                    activeChannel === channel.id ? 'bg-[var(--accent)] scale-y-100' : 'bg-transparent scale-y-0 group-hover:scale-y-100 group-hover:bg-[var(--text-muted)]'
                  }`} />
                  {channel.icon ? (
                    <img src={channel.icon} className="w-4 h-4 rounded mr-1.5 object-cover shrink-0" alt="" />
                  ) : (
                    <Icon name={isVoiceChannel ? 'phone' : 'hash'} size={16} className="mr-1.5 opacity-60 shrink-0" />
                  )}
                  <span className={`truncate flex-1 text-sm ${unread > 0 ? 'text-[var(--text-primary)] font-semibold' : ''}`}>{channel.name}</span>
                  {isVoiceChannel && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] bg-[var(--accent-subtle)] text-[var(--accent)] px-1.5 py-0.5 rounded font-medium">Voice</span>
                    </div>
                  )}
                  {Store.isAdmin && (
                    <button onClick={e => deleteChannel(e, channel.id, channel.name)}
                      className="hidden group-hover:flex text-[var(--text-muted)] hover:text-red-400 mr-1 transition-colors items-center justify-center p-0.5" aria-label={`Delete channel #${channel.name}`}>
                      <Icon name="close" size={12} />
                    </button>
                  )}
                  {unread > 0 && (
                    <span className="ml-1 bg-[var(--accent)] text-white text-xs rounded-full px-1.5 py-0.5 font-bold min-w-[18px] text-center leading-tight">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </div>
              );
            })}

            {showCreate && (
              <div className="mt-4 px-2">
                <form onSubmit={createChannel} className="flex flex-col gap-2">
                  {/* Channel icon preview */}
                  <div className="flex justify-center mb-1">
                    <div className="relative group cursor-pointer" onClick={() => chanFileRef.current?.click()}>
                      {newChanIconPreview ? (
                        <img src={newChanIconPreview} className="w-10 h-10 rounded-lg object-cover" alt="" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[#1e1f22] flex items-center justify-center text-[var(--text-muted)] border border-gray-700">
                          <Icon name="hash" size={18} />
                        </div>
                      )}
                    </div>
                    <input ref={chanFileRef} type="file" accept="image/*" className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file || file.size > 2 * 1024 * 1024) {
                          toast('Image too large (max 2MB)', 'error');
                          return;
                        }
                        setNewChanIconFile(file);
                        setNewChanIconPreview(URL.createObjectURL(file));
                      }} />
                  </div>
                  <input type="text" placeholder="Channel name" onChange={e => setNewChanName(e.target.value)}
                    className="bg-[#1e1f22] text-[var(--text-primary)] rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]" autoFocus />
                  <div className="flex gap-2">
                    <button type="submit" className="btn-accent text-xs px-3 py-1.5 rounded flex-1">Create</button>
                    <button type="button" onClick={() => { setShowCreate(false); setNewChanName(''); setNewChanIconFile(null); setNewChanIconPreview(''); }}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-3 py-1.5">Cancel</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* User area at bottom */}
      <div className="h-[52px] bg-[var(--bg-surface)] px-3 flex items-center gap-2 shrink-0 border-t border-[var(--bg-rail)]" data-name="user-area" data-file="components/ChannelSidebar.tsx">
        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 cursor-pointer transition-transform hover:scale-105"
          onClick={() => setShowSettings(true)}>
          {avatar ? (
            <img src={avatar} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: getUserColor(displayName) }}>
              {(displayName || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowSettings(true)}>
          <div className="text-sm text-[var(--text-primary)] font-semibold truncate flex items-center gap-1.5">
            {displayName}
            {userStats && (
              <span className="text-[10px] bg-[var(--accent-subtle)] text-[var(--accent)] px-1.5 py-0.5 rounded font-bold">
                Lv.{userStats.level}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-[var(--online)]" />
            <span className="text-xs text-[var(--text-muted)]">Online</span>
            {userStats && userStats.xp > 0 && (
              <span className="text-[10px] text-[var(--text-muted)] ml-1">
                {userStats.xp} XP
              </span>
            )}
          </div>
        </div>
        <button onClick={() => setShowSettings(true)}
          className="w-8 h-8 rounded-lg hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all" aria-label="Open settings">
          <Icon name="settings" size={18} />
        </button>
        <button onClick={() => { signOut(); window.location.reload(); }}
          className="w-8 h-8 rounded-lg hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 transition-all" aria-label="Sign out of account">
          <Icon name="sign-out" size={18} />
        </button>
      </div>

      {showSettings && (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback height="h-48" />}>
            <SettingsModal onClose={() => setShowSettings(false)} displayName={displayName} currentAvatar={avatar} />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Jitsi Call Modal */}
      {showJitsiCall && callChannelId && (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback height="h-48" />}>
            <JitsiCall
              callId={callChannelId}
              displayName={displayName}
              onClose={() => { setShowJitsiCall(false); setCallChannelId(null); }}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
}
