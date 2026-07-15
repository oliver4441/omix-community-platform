import { useState, useEffect, useRef } from 'react';
import { Store, SESSION_ID, getUserColor } from '../utils/store';
import type { Message, User } from '../types';

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
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [replyTo, setReplyTo] = useState<Message['replyTo'] | null>(null);
  const [pins, setPins] = useState<Message[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const channelId = Store.currentChannelId;
    if (!channelId) return;

    const unsubMsg = Store.subscribeMessages(channelId, (_, data) => setMessages(data as Message[]));
    const unsubTyping = Store.subscribeTyping(channelId, setTypingUsers);
    const unsubPins = Store.subscribePins(channelId, setPins);
    const unsubPresence = Store.subscribePresence(setOnlineUsers);

    Store.markChannelRead(channelId);

    const handler = (e: CustomEvent) => {
      Store.cleanup();
      Store.markChannelRead(e.detail);
      Store.subscribeMessages(e.detail, (_, data) => setMessages(data as Message[]));
      Store.subscribeTyping(e.detail, setTypingUsers);
      Store.subscribePins(e.detail, setPins);
      const ch = Store.state.channels.find(c => c.id === e.detail);
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

    const cursorPos = e.target.selectionStart;
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
    const cursorPos = inputRef.current?.selectionStart || 0;
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
    Store.uploadFile(file, Store.currentChannelId, displayName || 'Anonymous');
    e.target.value = '';
  };

  const filteredMentions = showMentions && mentionQuery
    ? [...new Set([
        ...onlineUsers.map(u => u.name),
        ...messages.map(m => m.author).filter(a => a !== displayName),
      ]).filter(n => n.toLowerCase().includes(mentionQuery)).slice(0, 6)]
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
        {messages.map(msg => {
          const isOwn = msg.sessionId === SESSION_ID;
          const reactions = msg.reactions || {};
          const hasFile = !!msg.fileUrl;
          const msgColor = msg.color || '#5865f2';
          const isPinned = msg.pinned;
          const avatarLetter = (msg.author || '?').charAt(0).toUpperCase();

          return (
            <div key={msg.id} className="flex gap-3 hover:bg-[var(--bg-message-hover)] -mx-4 px-4 py-1.5 rounded-lg group relative transition-colors">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 mt-0.5 cursor-pointer" style={{ backgroundColor: msgColor }} title={msg.author}>
                {avatarLetter}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold cursor-pointer hover:underline text-sm" style={{ color: msgColor }}>
                    {msg.author}
                    {msg.sessionId === SESSION_ID && <span className="text-xs text-[var(--text-muted)] font-normal ml-1">(you)</span>}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {msg.timestamp ? (msg.timestamp instanceof Date ? msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date(msg.timestamp as unknown as string | number).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : ''}
                    {msg.edited ? ' (edited)' : ''}
                    {isPinned ? ' 📌' : ''}
                  </span>
                  <span className="hidden group-hover:inline-flex gap-1 ml-2 transition-opacity">
                    <button onClick={() => setReplyTo({ id: msg.id, author: msg.author, text: msg.text })} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" title="Reply">💬</button>
                    <button onClick={() => toggleReaction(msg.id, '👍')} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">😊</button>
                    {(isOwn || Store.isAdmin) && (
                      <button onClick={() => startEdit(msg)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" title="Edit">✏️</button>
                    )}
                    {(isOwn || Store.isAdmin) && (
                      <button onClick={() => confirmDelete(msg.id)} className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors" title="Delete">🗑️</button>
                    )}
                    {Store.isAdmin && (
                      <button onClick={() => togglePin(msg.id)} className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors" title={isPinned ? 'Unpin' : 'Pin'}>
                        {isPinned ? '📌' : '📍'}
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
                      <div className="mt-2"><img src={msg.fileUrl} className="max-w-xs max-h-72 rounded-xl border border-gray-700" alt="Shared image" /></div>
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
          <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
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
        <form onSubmit={sendMsg} className="bg-[#383a40] rounded-xl p-3 flex items-start gap-3 border border-gray-700 focus-within:border-[var(--accent)] transition-all duration-200">
          <label className="text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-sidebar)] rounded-full p-1 h-6 w-6 flex items-center justify-center shrink-0 cursor-pointer transition-colors">
            <svg className="icon-plus text-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            <input type="file" onChange={handleFileSelect} className="hidden" accept="image/*,.pdf,.doc,.docx,.txt" />
          </label>
          <input
            ref={inputRef}
            id="chat-input"
            type="text"
            value={input}
            onChange={handleInput}
            placeholder={`Message #${channelName}${Store.isAdmin ? ' (Admin)' : ''}`}
            className="bg-transparent border-none outline-none text-[var(--text-primary)] w-full placeholder-[var(--text-muted)] text-sm"
            autoComplete="off"
          />
          <div className="flex items-center gap-2 text-[var(--text-muted)] shrink-0">
            <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="icon-smile text-lg hover:text-[var(--text-primary)] cursor-pointer transition-colors">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            <button type="submit" className={`text-lg hover:text-[var(--text-primary)] cursor-pointer transition-colors ${input.trim() ? 'text-[var(--accent)]' : ''}`}>➤</button>
          </div>
        </form>
      </div>
    </div>
  );
}