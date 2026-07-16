import { useState, useEffect, useRef } from 'react';
import { Store, getUserColor } from '../utils/store';
import type { Channel, User } from '../types';
import { SettingsModal } from './SettingsModal';

export function ChannelSidebar({
  isMobile,
  currentView,
  displayName,
}: { isMobile: boolean; currentView: string; displayName: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(Store.currentChannelId);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newChanName, setNewChanName] = useState('');
  const [unreadCounts, setUnreadCounts] = useState(Store.unreadCounts);
  const [showSettings, setShowSettings] = useState(false);
  const [avatar, setAvatar] = useState('');
  const unreadInterval = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const serverId = Store.currentServerId;
    const unsubChannels = Store.subscribeChannels(serverId, (_, data) => setChannels(data as Channel[]));
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

  // Load profile for avatar
  useEffect(() => {
    Store.getProfile(Store.sessionId).then(profile => {
      if (profile?.avatar) setAvatar(profile.avatar);
    });
    const unsub = Store.subscribeProfile(p => {
      if (p.avatar) setAvatar(p.avatar);
      else setAvatar('');
    });
    return unsub;
  }, []);

  const selectChannel = (channelId: string) => {
    Store.currentChannelId = channelId;
    Store.markChannelRead(channelId);
    setActiveChannel(channelId);
    setUnreadCounts({ ...Store.unreadCounts });
    window.dispatchEvent(new CustomEvent('channelChanged', { detail: channelId }));
  };

  const createChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChanName.trim()) return;
    Store.createChannel(Store.currentServerId, newChanName.trim());
    setShowCreate(false);
    setNewChanName('');
  };

  const deleteChannel = (e: React.MouseEvent, channelId: string, name: string) => {
    e.stopPropagation();
    if (!Store.isAdmin) return;
    if (confirm(`Delete #${name}? This cannot be undone.`)) {
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
        <svg className="icon-chevron-down text-lg text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </div>

      <div className="text-xs text-[var(--text-muted)] px-4 py-2 flex items-center gap-1.5 border-b border-[var(--bg-rail)]">
        <div className="w-2 h-2 rounded-full bg-[var(--online)]" style={{ animation: 'pulse 2s ease infinite' }} />
        <span>{onlineUsers.length} online</span>
        <div className="flex ml-2">
          {onlineUsers.slice(0, 5).map(u => (
            <div key={u.id} className="w-5 h-5 rounded-full bg-[var(--bg-hover)] -ml-1 border-2 border-[var(--bg-sidebar)] flex items-center justify-center text-[9px] font-bold"
              style={{ color: u.color || '#fff', backgroundColor: u.color ? u.color + '33' : '' }} title={u.name}>
              {u.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {onlineUsers.length > 5 && (
            <div className="w-5 h-5 rounded-full bg-[var(--bg-hover)] -ml-1 border-2 border-[var(--bg-sidebar)] flex items-center justify-center text-[9px] text-[var(--text-muted)]">
              +{onlineUsers.length - 5}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-custom p-2">
        {Object.entries(categories).map(([catName, chans]) => (
          <div key={catName}>
            <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 mt-4 px-2 flex justify-between items-center group cursor-pointer hover:text-[var(--text-primary)] transition-colors">
              {catName}
              <button onClick={() => setShowCreate(true)} className="icon-plus hidden group-hover:block text-lg hover:text-[var(--text-primary)] transition-colors">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
            {chans.map(channel => {
              const unread = unreadCounts[channel.id] || 0;
              return (
                <div
                  key={channel.id}
                  onClick={() => selectChannel(channel.id)}
                  className={`flex items-center px-2 py-1.5 mx-1 rounded-lg cursor-pointer group mb-[2px] transition-colors ${
                    activeChannel === channel.id
                      ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <svg className="icon-hash text-lg mr-1.5 opacity-60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-5m0 0l-5-5m5 5H6" /></svg>
                  <span className={`truncate flex-1 text-sm ${unread > 0 ? 'text-[var(--text-primary)] font-semibold' : ''}`}>{channel.name}</span>
                  {Store.isAdmin && (
                    <button onClick={e => deleteChannel(e, channel.id, channel.name)}
                      className="hidden group-hover:block text-xs text-[var(--text-muted)] hover:text-red-400 mr-1 transition-colors">✕</button>
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
                  <input type="text" placeholder="Channel name" onChange={e => setNewChanName(e.target.value)}
                    className="bg-[#1e1f22] text-[var(--text-primary)] rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]" autoFocus />
                  <div className="flex gap-2">
                    <button type="submit" className="btn-accent text-xs px-3 py-1.5 rounded flex-1">Create</button>
                    <button type="button" onClick={() => { setShowCreate(false); setNewChanName(''); }}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-3 py-1.5">Cancel</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="h-[52px] bg-[#232428] px-2 py-1.5 flex items-center gap-2 shrink-0">
        <div className="relative cursor-pointer hover:opacity-80 transition-opacity rounded-full w-8 h-8 flex-shrink-0"
          onClick={() => setShowSettings(true)}
          style={{ backgroundColor: avatar ? 'transparent' : (getUserColor(displayName) + '33') }}>
          {avatar ? (
            <img src={avatar} className="w-full h-full rounded-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full rounded-full flex items-center justify-center text-sm font-bold"
              style={{ color: getUserColor(displayName) }}>
              {(displayName || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-[var(--online)] rounded-full border-2 border-[#232428]" />
        </div>
        <div className="flex-col flex-1 min-w-0 cursor-pointer" onClick={() => setShowSettings(true)}>
          <div className="text-sm font-semibold text-[var(--text-primary)] truncate flex items-center gap-1">
            {displayName || 'Guest'}
            {Store.isAdmin && <span className="text-xs text-[var(--accent)] font-medium">🛡️</span>}
          </div>
          <div className="text-xs text-[var(--text-muted)] truncate">Online</div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setShowSettings(true)}
            className="w-8 h-8 rounded hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" title="Settings">
            <svg className="icon-settings text-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button onClick={() => { if (confirm('Sign out?')) { localStorage.removeItem('omix_username'); localStorage.removeItem('omix_admin'); window.location.reload(); } }}
            className="w-8 h-8 rounded hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" title="Sign out">
            <svg className="icon-log-out text-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>
      </div>

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