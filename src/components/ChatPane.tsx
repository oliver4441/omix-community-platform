import { useState, useEffect, useRef } from 'react';
import { Store, SESSION_ID } from '../utils/store';
import type { Message, User, TypingUser } from '../types';

const EMOJIS = ['😀','😎','🔥','❤️','🎉','👍','😂','🥳','💯','👏','✨','🤣','🙌','💪','😍','🤔','👀','🚀','💀','🤝','😭','😤','💜','🌟'];
const MENTION_RE = /@(\w*)$/;

export function ChatPane({
  isMobile,
  currentView,
  displayName,
}: { isMobile: boolean; currentView: string; displayName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [channelName, setChannelName] = useState('general');
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [replyTo, setReplyTo] = useState<Message['replyTo'] | null>(null);
  const [pins, setPins] = useState<Message[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string; avatar: string; color: string }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const channelId = Store.currentChannelId;
    if (!channelId) return;

    const unsubMsg = Store.subscribeMessages(channelId, (_, data) => {
      const msgs = data as Message[];
      setMessages(msgs);
      // Load profiles for new authors
      const authorIds = new Set(msgs.map(m => m.sessionId).filter(Boolean));
      authorIds.forEach(async (sid) => {
        if (sid && !profiles[sid]) {
          const p = await Store.getProfile(sid);
          if (p) setProfiles(prev => ({ ...prev, [sid]: p }));
        }
      });
    });
    const unsubTyping = Store.subscribeTyping(channelId, setTypingUsers);
    const unsubPins = Store.subscribePins(channelId, setPins);
    const unsubPresence = Store.subscribePresence(setOnlineUsers);

    Store.markChannelRead(channelId);

    const handler = (e: CustomEvent) => {
      Store.cleanup();
      Store.markChannelRead(e.detail);
      Store.subscribeMessages(e.detail, (_, data) => {
        const msgs = data as Message[];
        setMessages(msgs);
        const authorIds = new Set(msgs.map(m => m.sessionId).filter(Boolean));
        authorIds.forEach(async (sid) => {
          if (sid && !profiles[sid]) {
            const p = await Store.getProfile(sid);
            if (p) setProfiles(prev => ({ ...prev, [sid]: p }));
          }
        });
      });
      Store.subscribeTyping(e.detail, setTypingUsers);
      Store.subscribePins(e.detail, setPins);
      const ch = Store.channels.find(c => c.id === e.detail);
      if (ch) setChannelName(ch.name);
      setShowEmoji(false);
      setReplyTo(null);
    };
    window.addEventListener('channelChanged', handler as EventListener);
    return () => { unsubMsg(); unsubTyping(); unsubPins(); unsubPresence(); window.removeEventListener('channelChanged', handler as EventListener); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMsg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const opts: { replyTo?: Message['replyTo'] } = {};
    if (replyTo) opts.replyTo = { id: replyTo.id, author: replyTo.author, text: replyTo.text.substring(0, 80) };
    Store.stopTyping(Store.currentChannelId);
    Store.sendMessage(Store.currentChannelId, input, displayName || 'Anonymous', opts);
    setInput('');
    setReplyTo(null);
    inputRef.current?.focus();
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    if (val.trim()) Store.startTyping(Store.currentChannelId, displayName || 'Anonymous');
    else Store.stopTyping(Store.currentChannelId);

    const cursorPos = e.target.selectionStart ?? 0;
    const beforeCursor = val.substring(0, cursorPos);
    const match = beforeCursor.match(MENTION_RE);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (name: string) => {
    const cursorPos = inputRef.current?.selectionStart ?? 0;
    const before = input.substring(0, cursorPos);
    const after = input.substring(cursorPos);
    const match = before.match(MENTION_RE);
    if (match) {
      const newVal = before.substring(0, before.length - match[0].length) + '@' + name + ' ' + after;
      setInput(newVal);
    }
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const addEmoji = (emoji: string) => { setInput(input + emoji); setShowEmoji(false); inputRef.current?.focus(); };
  const toggleReaction = (msgId: string, emoji: string) => Store.toggleReaction(msgId, emoji, displayName || 'Anonymous');
  const startEdit = (msg: Message) => { setEditing(msg.id); setEditText(msg.text); };
  const saveEdit = (msgId: string) => { if (editText.trim()) Store.editMessage(msgId, editText); setEditing(null); setEditText(''); };
  const confirmDelete = (msgId: string) => { if (confirm('Delete this message?')) Store.deleteMessage(msgId); };
  const togglePin = (msgId: string) => Store.togglePin(msgId);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      Store.sendMessage(Store.currentChannelId, '', displayName || 'Anonymous', { fileUrl: ev.target?.result as string, fileType: file.type });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const allNames = Array.from(new Set([
    ...onlineUsers.map(u => u.name),
    ...messages.map(m => m.author).filter(a => a !== displayName),
  ]));
  const filteredMentions = showMentions && mentionQuery
    ? allNames.filter(n => n.toLowerCase().includes(mentionQuery)).slice(0, 6)
    : [];

  if (isMobile && currentView !== 'chat') return null;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg-chat)]" data-name="chat-pane" data-file="components/ChatPane.tsx">
      <div className="h-12 border-b border-[var(--bg-rail)] flex items-center px-4 shadow-sm shrink-0">
        <svg className="icon-hash text-xl text-[var(--text-muted)] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-5m0 0l-5-5m5 5H6" /></svg>
        <span className="font-bold text-[var(--text-primary)] mr-4">{channelName}</span>
        <div className="w-[1px] h-6 bg-[var(--bg-hover)] mx-2" />
        <span className="text-sm text-[var(--text-muted)] truncate flex-1">#{channelName}</span>
        {pins.length > 0 && (
          <div className="text-xs text-[var(--accent)] flex items-center gap-1 mr-2" title={`${pins.length} pinned message${pins.length > 1 ? 's' : ''}`}>
            <span>📌</span><span>{pins.length}</span>
          </div>
        )}
        <svg className="icon-search text-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
      </div>

      {pins.length > 0 && (
        <div className="bg-[#232428] border-b border-[var(--bg-rail)] px-4 py-2 text-sm flex items-center gap-2 shrink-0">
          <span className="text-[var(--accent)] font-bold">📌 Pinned</span>
          <span className="text-[var(--text-muted)] truncate">{pins[0].text.substring(0, 60)}{pins[0].text.length > 60 ? '...' : ''}</span>
          <span className="text-[var(--text-muted)] text-xs">— {pins[0].author}</span>
          {pins.length > 1 && <span className="text-[var(--text-muted)] text-xs">+ {pins.length - 1} more</span>}
        </div>
      )}

      <div className="flex-1 overflow-y-auto scroll-custom p-4 flex flex-col gap-[2px]" id="messages-container">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">No messages yet. Say something!</div>
        )}
        {messages.map((msg, index) => {
            const isOwn = msg.sessionId === SESSION_ID;
            const reactions = msg.reactions || {};
            const hasFile = !!msg.fileUrl;
            const msgColor = msg.color || '#5865f2';
            const isPinned = msg.pinned;
            const avatarLetter = (msg.author || '?').charAt(0).toUpperCase();
            const msgProfile = profiles[msg.sessionId];
            const msgAvatar = msgProfile?.avatar;

            // Message grouping: same author within 5 minutes
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const getMsgTime = (ts: unknown): number => {
              if (!ts) return 0;
              if (ts instanceof Date) return ts.getTime();
              if (typeof ts === 'object' && ts !== null && 'toDate' in ts) return (ts as { toDate: () => Date }).toDate().getTime();
              return new Date(String(ts)).getTime();
            };

            const isGrouped = !!(
              prevMsg &&
              prevMsg.sessionId === msg.sessionId &&
              msg.timestamp && prevMsg.timestamp &&
              Math.abs(getMsgTime(msg.timestamp) - getMsgTime(prevMsg.timestamp)) < 300_000
            );

            const formatTime = (ts: unknown): string => {
              if (!ts) return '';
              const d = ts instanceof Date ? ts : typeof ts === 'object' && ts !== null && 'toDate' in ts ? (ts as { toDate: () => Date }).toDate() : new Date(String(ts));
              return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            };

            return (
              <div key={msg.id} className={`flex gap-3 -mx-4 px-4 py-1 rounded-lg group relative transition-all ${isOwn ? 'bg-[var(--msg-bg-own)]' : 'bg-[var(--msg-bg)]'} hover:bg-[var(--bg-message-hover)]`}
                style={{ animation: 'fadeSlideUp 0.2s ease both', animationDelay: `${Math.min(index * 15, 300)}ms` }}>
                {isGrouped ? (
                  /* Grouped message — no avatar, compact */
                  <>
                    <div className="w-10 shrink-0 flex items-start justify-center pt-0.5">
                      <span className="text-[10px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap select-none">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 -mt-1">
                      <div className="flex items-start gap-2">
                        <span className="text-[var(--text-primary)] leading-relaxed text-sm break-words flex-1">{msg.text}</span>
                        <span className="hidden group-hover:inline-flex gap-0.5 ml-auto transition-opacity shrink-0 pt-1">
                          <button onClick={() => setReplyTo({ id: msg.id, author: msg.author, text: msg.text })} className="w-6 h-6 rounded hover:bg-[var(--bg-hover)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" title="Reply">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l6 6m-6-6l6-6" /></svg>
                          </button>
                          <button onClick={() => toggleReaction(msg.id, '👍')} className="w-6 h-6 rounded hover:bg-[var(--bg-hover)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">😊</button>
                          {(isOwn || Store.isAdmin) && (
                            <button onClick={() => startEdit(msg)} className="w-6 h-6 rounded hover:bg-[var(--bg-hover)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" title="Edit">
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                          )}
                          {(isOwn || Store.isAdmin) && (
                            <button onClick={() => confirmDelete(msg.id)} className="w-6 h-6 rounded hover:bg-[var(--bg-hover)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors" title="Delete">
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                          {Store.isAdmin && (
                            <button onClick={() => togglePin(msg.id)} className="w-6 h-6 rounded hover:bg-[var(--bg-hover)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors" title={isPinned ? 'Unpin' : 'Pin'}>
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                            </button>
                          )}
                        </span>
                      </div>
                      {hasFile && msg.fileType?.startsWith('image') && (
                        <div className="mt-1"><img src={msg.fileUrl} className="max-w-xs max-h-72 rounded-xl border border-gray-700" alt="" /></div>
                      )}
                      {hasFile && msg.fileType && !msg.fileType.startsWith('image') && (
                        <div className="mt-1">
                          <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline text-sm flex items-center gap-1">📎 View attachment</a>
                        </div>
                      )}
                      {msg.replyTo && (
                        <div className="text-xs text-[var(--text-muted)] border-l-2 border-[var(--text-muted)] pl-2 mt-0.5 mb-0.5 italic">
                          Replying to <span className="font-medium text-[var(--text-primary)]">{msg.replyTo.author}</span>: {msg.replyTo.text}
                        </div>
                      )}
                      {editing === msg.id && (
                        <div className="flex gap-2 mt-1">
                          <input type="text" value={editText} onChange={e => setEditText(e.target.value)}
                            className="bg-[#1e1f22] text-[var(--text-primary)] rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] flex-1"
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(msg.id); if (e.key === 'Escape') setEditing(null); }} autoFocus />
                          <button onClick={() => saveEdit(msg.id)} className="text-xs text-[var(--accent)] hover:underline">Save</button>
                          <button onClick={() => setEditing(null)} className="text-xs text-[var(--text-muted)] hover:underline">Cancel</button>
                        </div>
                      )}
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {Object.entries(reactions).map(([emoji, users]) => {
                          const hasReacted = users.indexOf(displayName) > -1;
                          return (
                            <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                              className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-all ${
                                hasReacted ? 'bg-[var(--accent)] bg-opacity-20 border border-[var(--accent)]' : 'bg-[var(--bg-hover)] hover:bg-[var(--bg-hover)] border border-transparent'
                              }`}>
                              <span>{emoji}</span>
                              <span className="text-xs text-[var(--text-muted)]">{users.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Full message — with avatar + name */
                  <>
                    <div className="w-10 h-10 rounded-full shrink-0 mt-0.5 cursor-pointer overflow-hidden"
                      style={{ backgroundColor: msgAvatar ? 'transparent' : msgColor }}
                      title={msg.author} onClick={() => setReplyTo({ id: msg.id, author: msg.author, text: msg.text })}>
                      {msgAvatar ? (
                        <img src={msgAvatar} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">{avatarLetter}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold cursor-pointer hover:underline text-sm" style={{ color: msgColor }}>
                          {msg.author}
                          {msg.sessionId === SESSION_ID && <span className="text-xs text-[var(--text-muted)] font-normal ml-1">(you)</span>}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {formatTime(msg.timestamp)}
                          {msg.edited ? ' (edited)' : ''}
                          {isPinned ? ' 📌' : ''}
                        </span>
                        <span className="hidden group-hover:inline-flex gap-0.5 ml-2 transition-opacity">
                          <button onClick={() => setReplyTo({ id: msg.id, author: msg.author, text: msg.text })} className="w-6 h-6 rounded hover:bg-[var(--bg-hover)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" title="Reply">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l6 6m-6-6l6-6" /></svg>
                          </button>
                          <button onClick={() => toggleReaction(msg.id, '👍')} className="w-6 h-6 rounded hover:bg-[var(--bg-hover)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">😊</button>
                          {(isOwn || Store.isAdmin) && (
                            <button onClick={() => startEdit(msg)} className="w-6 h-6 rounded hover:bg-[var(--bg-hover)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" title="Edit">
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                          )}
                          {(isOwn || Store.isAdmin) && (
                            <button onClick={() => confirmDelete(msg.id)} className="w-6 h-6 rounded hover:bg-[var(--bg-hover)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors" title="Delete">
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                          {Store.isAdmin && (
                            <button onClick={() => togglePin(msg.id)} className="w-6 h-6 rounded hover:bg-[var(--bg-hover)] flex items-center justify-center text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors" title={isPinned ? 'Unpin' : 'Pin'}>
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                            </button>
                          )}
                        </span>
                      </div>

                      {msg.replyTo && (
                        <div className="text-xs text-[var(--text-muted)] border-l-2 border-[var(--text-muted)] pl-2 mt-0.5 mb-1 italic">
                          Replying to <span className="font-medium text-[var(--text-primary)]">{msg.replyTo.author}</span>: {msg.replyTo.text}
                        </div>
                      )}

                      {editing === msg.id ? (
                        <div className="flex gap-2 mt-1">
                          <input type="text" value={editText} onChange={e => setEditText(e.target.value)}
                            className="bg-[#1e1f22] text-[var(--text-primary)] rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)] flex-1"
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(msg.id); if (e.key === 'Escape') setEditing(null); }} autoFocus />
                          <button onClick={() => saveEdit(msg.id)} className="text-xs text-[var(--accent)] hover:underline">Save</button>
                          <button onClick={() => setEditing(null)} className="text-xs text-[var(--text-muted)] hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <>
                          <span className="text-[var(--text-primary)] leading-relaxed text-sm">{msg.text}</span>
                          {hasFile && msg.fileType?.startsWith('image') && (
                            <div className="mt-2"><img src={msg.fileUrl} className="max-w-xs max-h-72 rounded-xl border border-gray-700" alt="" /></div>
                          )}
                          {hasFile && msg.fileType && !msg.fileType.startsWith('image') && (
                            <div className="mt-2">
                              <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline text-sm flex items-center gap-1">📎 View attachment</a>
                            </div>
                          )}
                        </>
                      )}

                      <div className="flex gap-1 mt-1 flex-wrap">
                        {Object.entries(reactions).map(([emoji, users]) => {
                          const hasReacted = users.indexOf(displayName) > -1;
                          return (
                            <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                              className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition-all ${
                                hasReacted ? 'bg-[var(--accent)] bg-opacity-20 border border-[var(--accent)]' : 'bg-[var(--bg-hover)] hover:bg-[var(--bg-hover)] border border-transparent'
                              }`}>
                              <span>{emoji}</span>
                              <span className="text-xs text-[var(--text-muted)]">{users.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        <div ref={messagesEndRef} />
      </div>

      {typingUsers.length > 0 && (
        <div className="px-4 pb-1 text-xs text-[var(--text-muted)] italic flex items-center gap-2">
          <div className="flex gap-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" style={{ animation: 'pulse 1.5s ease infinite' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" style={{ animation: 'pulse 1.5s ease infinite', animationDelay: '0.2s' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" style={{ animation: 'pulse 1.5s ease infinite', animationDelay: '0.4s' }} />
          </div>
          <span>{typingUsers.map(u => u.name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
        </div>
      )}

      {showEmoji && (
        <div className="px-4 pb-1">
          <div className="bg-[var(--bg-sidebar)] rounded-xl p-2 flex flex-wrap gap-1 max-h-32 overflow-y-auto border border-gray-700">
            {EMOJIS.map(emoji => (
              <button key={emoji} onClick={() => addEmoji(emoji)} className="text-xl hover:bg-[var(--bg-hover)] rounded p-1 cursor-pointer transition-all hover:scale-110">{emoji}</button>
            ))}
          </div>
        </div>
      )}

      {showMentions && filteredMentions.length > 0 && (
        <div className="px-4 pb-1">
          <div className="bg-[var(--bg-sidebar)] rounded-xl p-1 border border-gray-700 max-h-36 overflow-y-auto">
            {filteredMentions.map(name => (
              <button key={name} onClick={() => insertMention(name)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg w-full cursor-pointer">
                <span className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs text-white">@</span>
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {replyTo && (
        <div className="px-4 pt-2 pb-0 flex items-center gap-2 text-sm bg-[#232428] mx-4 rounded-t-lg border-t border-l border-r border-gray-700">
          <span className="text-[var(--text-muted)]">💬 Replying to</span>
          <span className="font-medium text-[var(--text-primary)]">{replyTo.author}</span>
          <span className="text-[var(--text-muted)] truncate flex-1">{replyTo.text.substring(0, 40)}</span>
          <button onClick={() => setReplyTo(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">✕</button>
        </div>
      )}

      <div className="p-4 pt-2 shrink-0">
        <form onSubmit={sendMsg} className="bg-[#383a40] rounded-xl p-2 flex items-end gap-2 border border-gray-700 focus-within:border-[var(--accent)] transition-all duration-200">
          <label className="w-9 h-9 rounded-lg bg-[var(--bg-sidebar)] hover:bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0 cursor-pointer transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <input type="file" onChange={handleFileSelect} className="hidden" accept="image/*,.pdf,.doc,.docx,.txt" />
          </label>
          <div className="flex-1 flex items-end gap-2">
            <input
              ref={inputRef}
              id="chat-input"
              type="text"
              value={input}
              onChange={handleInput}
              placeholder={`Message #${channelName}${Store.isAdmin ? ' (Admin)' : ''}`}
              className="bg-transparent border-none outline-none text-[var(--text-primary)] w-full placeholder-[var(--text-muted)] text-sm py-1.5 leading-5"
              autoComplete="off"
            />
            <div className="flex items-center gap-1 shrink-0 pb-0.5">
              <button type="button" onClick={() => setShowEmoji(!showEmoji)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  showEmoji ? 'bg-[var(--accent)] bg-opacity-20 text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button type="submit" disabled={!input.trim()}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  input.trim()
                    ? 'bg-[var(--accent)] text-white hover:opacity-90'
                    : 'text-[var(--text-muted)]'
                }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}