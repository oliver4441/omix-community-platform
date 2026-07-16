import { useState, useEffect, useRef } from 'react';
import { Store } from '../utils/store';
import type { DMChannel, User } from '../types';

export function DMSidebar({
  isMobile,
  currentView,
  displayName,
  setView,
}: { isMobile: boolean; currentView: string; displayName: string; setView: (view: string) => void }) {
  const [dmChannels, setDmChannels] = useState<DMChannel[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [showNewDM, setShowNewDM] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const unreadInterval = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const unsubDMs = Store.subscribeDMChannels((dms) => setDmChannels(dms as DMChannel[]));
    const unsubPresence = Store.subscribePresence(setOnlineUsers);

    unreadInterval.current = setInterval(() => setDmChannels([...dmChannels]), 2000);

    return () => {
      unsubDMs();
      unsubPresence();
      if (unreadInterval.current) clearInterval(unreadInterval.current);
      Store.cleanupDMChannels();
    };
  }, []);

  const selectDM = async (dmChannel: DMChannel) => {
    Store.currentChannelId = dmChannel.id;
    Store.markChannelRead(dmChannel.id);
    window.dispatchEvent(new CustomEvent('channelChanged', { detail: dmChannel.id }));
    if (isMobile) setView('chat');
  };

  const createNewDM = async (otherUserId: string) => {
    try {
      const dmId = await Store.createOrGetDMChannel(otherUserId);
      setShowNewDM(false);
      selectDM({ id: dmId } as DMChannel);
    } catch (e) {
      alert('Failed to create DM');
    }
  };

  const filteredDMs = dmChannels.filter(dm => {
    const otherParticipant = dm.participants.find(p => p !== Store.sessionId);
    if (!otherParticipant) return false;
    const otherName = dm.participantNames[otherParticipant] || 'Unknown';
    return otherName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const availableUsers = onlineUsers.filter(u => u.id !== Store.sessionId);

  if (isMobile && currentView !== 'dms') return null;

  return (
    <div className="w-[240px] bg-[var(--bg-sidebar)] h-full flex flex-col flex-shrink-0" data-name="dm-sidebar" data-file="components/DMSidebar.tsx">
      <div className="h-12 border-b border-[var(--bg-rail)] flex items-center px-3 shadow-sm">
        <svg className="icon-message-square text-xl text-[var(--text-muted)] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="font-bold text-[var(--text-primary)] text-sm truncate">Direct Messages</span>
      </div>

      <div className="p-2 border-b border-[var(--bg-rail)]">
        <input
          type="text"
          placeholder="Search or start new DM..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-[#1e1f22] text-[var(--text-primary)] rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] border border-gray-700"
        />
        <button
          onClick={() => setShowNewDM(true)}
          className="w-full mt-2 btn-accent text-xs py-1.5 rounded flex items-center justify-center gap-1"
        >
          <svg className="icon-plus text-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Message
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-custom p-2">
        {filteredDMs.length === 0 && searchQuery && (
          <div className="text-center text-[var(--text-muted)] text-sm py-4">
            No DMs found
          </div>
        )}

        {filteredDMs.length === 0 && !searchQuery && (
          <div className="text-center text-[var(--text-muted)] text-sm py-4">
            No direct messages yet
          </div>
        )}

        {filteredDMs.map(dm => {
          const otherParticipant = dm.participants.find(p => p !== Store.sessionId);
          if (!otherParticipant) return null;
          const otherName = dm.participantNames[otherParticipant] || 'Unknown';
          const otherUser = onlineUsers.find(u => u.id === otherParticipant);
          const isOnline = !!otherUser;
          const unreadCount = Store.unreadCounts[dm.id] || 0;

          return (
            <div
              key={dm.id}
              onClick={() => selectDM(dm)}
              className={`flex items-center gap-3 px-2 py-2 mx-1 rounded-lg cursor-pointer group mb-[2px] transition-colors ${
                Store.currentChannelId === dm.id
                  ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="relative w-10 h-10 shrink-0">
                <div className="w-full h-full rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: otherUser?.color || '#5865f2' }}>
                  {otherName.charAt(0).toUpperCase()}
                </div>
                {isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-[var(--online)] rounded-full border-2 border-[var(--bg-sidebar)]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="truncate font-medium text-sm">{otherName}</span>
                  {dm.lastMessageAt && (
                    <span className="text-xs text-[var(--text-muted)] whitespace-nowrap ml-2">
                      {new Date(dm.lastMessageAt as unknown as string | number).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between truncate">
                  <span className="text-xs text-[var(--text-muted)] truncate flex-1">
                    {dm.lastMessageText ? (dm.lastMessageAuthor === displayName ? 'You: ' : '') + dm.lastMessageText : 'No messages yet'}
                  </span>
                  {unreadCount > 0 && (
                    <span className="ml-1 bg-[var(--accent)] text-white text-xs rounded-full px-1.5 py-0.5 font-bold min-w-[18px] text-center leading-tight flex-shrink-0">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showNewDM && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
          onClick={e => { if (e.target === e.currentTarget) setShowNewDM(false); }}
        >
          <div className="bg-[var(--bg-sidebar)] rounded-xl p-6 w-80 shadow-2xl border border-gray-700"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">New Direct Message</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">Select a user to start a direct message</p>
            <div className="max-h-60 overflow-y-auto">
              {availableUsers.length === 0 ? (
                <p className="text-center text-[var(--text-muted)] py-4">No other users online</p>
              ) : (
                availableUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => createNewDM(user.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: user.color }}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-[var(--text-primary)] truncate">{user.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">Online</div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => setShowNewDM(false)}
              className="w-full mt-4 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}