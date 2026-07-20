import { Store } from '../utils/store';
import { renderFormattedText } from '../utils/format';
import type { Message } from '../types';
import { Icon } from './Icon';

// Helper
function formatTime(ts: unknown): string {
  if (!ts) return '';
  const d = ts instanceof Date ? ts : typeof ts === 'object' && ts !== null && 'toDate' in ts ? (ts as { toDate: () => Date }).toDate() : new Date(String(ts));
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface MessageBubbleProps {
  msg: Message;
  messages: Message[];
  isOwn: boolean;
  profile: { name: string; avatar: string; color: string } | null;
  showAvatar: boolean;
  dateSep: string | null;
  isSameAuthor: boolean;
  isEditing: boolean;
  editText: string;
  displayName: string;
  editing: string | null;
  setEditing: (id: string | null) => void;
  setEditText: (text: string) => void;
  setReplyTo: (reply: Message['replyTo'] | null) => void;
  toggleReaction: (msgId: string, emoji: string) => void;
  startEdit: (msg: Message) => void;
  saveEdit: (msgId: string) => void;
  togglePin: (msgId: string) => void;
  setThreadMessage: (msg: Message | null) => void;
  setLightboxSrc: (src: string | null) => void;
  confirmDelete: (msgId: string) => void;
}

export function MessageBubble({
  msg,
  messages,
  isOwn,
  profile,
  showAvatar,
  dateSep,
  isSameAuthor,
  isEditing,
  editText,
  displayName,
  setEditing,
  setEditText,
  setReplyTo,
  toggleReaction,
  startEdit,
  saveEdit,
  togglePin,
  setThreadMessage,
  setLightboxSrc,
  confirmDelete,
}: MessageBubbleProps) {
  return (
    <div key={msg.id}>
      {/* Date separator */}
      {dateSep && (
        <div className="date-separator">
          <span>{dateSep}</span>
        </div>
      )}

      <div
        id={`msg-${msg.id}`}
        className={`group relative flex ${isOwn ? 'justify-end' : 'justify-start'} ${isSameAuthor ? 'msg-group-same' : 'msg-group-first'}`}
        data-message-id={msg.id}
      >
        {/* Other user's avatar — first message in group only */}
        {!isOwn && showAvatar && (
          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 mt-0.5 mr-2.5 cursor-pointer transition-transform hover:scale-105 self-start">
            {profile?.avatar ? (
              <img src={profile.avatar} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white"
                style={{ backgroundColor: msg.color || '#5865f2' }}>
                {(msg.author || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* Spacer for own messages (keeps alignment) */}
        {isOwn && <div className="w-9 shrink-0 mr-2.5" />}

        <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
          {/* Author name + timestamp — first message in group */}
          {showAvatar && (
            <div className={`flex items-baseline gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
              <span className="text-xs font-semibold" style={{ color: msg.color || '#5865f2' }}>
                {msg.author}
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">{formatTime(msg.timestamp)}</span>
              {msg.edited && <span className="text-[10px] text-[var(--text-muted)] italic">(edited)</span>}
            </div>
          )}

          {/* Reply indicator */}
          {msg.replyTo && (
            <div className={`text-xs text-[var(--text-muted)] flex items-center gap-1 mb-0.5 cursor-pointer hover:text-[var(--accent)] transition-colors max-w-full ${isOwn ? 'flex-row-reverse' : ''}`}
              onClick={() => {
                const el = document.getElementById(`msg-${msg.replyTo?.id}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el?.classList.add('ring-2', 'ring-[var(--accent)]');
                setTimeout(() => el?.classList.remove('ring-2', 'ring-[var(--accent)]'), 2000);
              }}>
              <Icon name="reply" size={10} />
              <span className="truncate max-w-[200px]">
                <span className="font-medium">{msg.replyTo.author}</span>: {msg.replyTo.text}
              </span>
            </div>
          )}

          {/* The bubble */}
          <div className={`relative px-3 py-2 ${isOwn ? 'bubble-own' : 'bubble-other'}`}>
            {/* Edit mode */}
            {isEditing ? (
              <div className="flex gap-2">
                <input type="text" value={editText} onChange={e => setEditText(e.target.value)}
                  className="flex-1 bg-[#1e1f22] text-[var(--text-primary)] rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[var(--accent)]" autoFocus />
                <button onClick={() => saveEdit(msg.id)} className="text-xs text-[var(--accent)] hover:underline">Save</button>
                <button onClick={() => { setEditing(null); setEditText(''); }} className="text-xs text-[var(--text-muted)] hover:underline">Cancel</button>
              </div>
            ) : (
              <div className={`text-sm leading-relaxed break-words ${isOwn ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                {renderFormattedText(msg.text)}
              </div>
            )}

            {/* File attachment */}
            {msg.fileUrl && (
              <div className="mt-1.5">
                {msg.fileType?.startsWith('image/') ? (
                  <img src={msg.fileUrl} className="max-w-xs max-h-60 rounded-lg object-cover cursor-pointer transition-transform hover:scale-[1.02]"
                    alt="Image" onClick={() => setLightboxSrc(msg.fileUrl ? msg.fileUrl : null)} />
                ) : (
                  <a href={msg.fileUrl} download className={`flex items-center gap-2 text-sm ${isOwn ? 'text-blue-200' : 'text-[var(--accent)]'} hover:underline`}>
                    <Icon name="file" size={14} />
                    {msg.fileName || 'Attachment'}
                  </a>
                )}
              </div>
            )}

            {/* Thread reply count */}
            {(() => {
              const count = messages.filter(m => m.threadId === msg.id).length;
              if (count === 0) return null;
              return (
                <button onClick={() => setThreadMessage(msg)}
                  className={`flex items-center gap-1.5 mt-1.5 text-xs hover:underline transition-colors ${
                    isOwn ? 'text-blue-200/70' : 'text-[var(--accent)]'
                  }`}>
                  <Icon name="message-circle" size={12} />
                  {count} {count === 1 ? 'reply' : 'replies'}
                </button>
              );
            })()}

            {/* Reactions */}
            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
              <div className={`flex flex-wrap gap-1 ${isOwn ? 'justify-end' : 'justify-start'} ${msg.text || msg.fileUrl ? 'mt-1.5' : ''}`}>
                {Object.entries(msg.reactions).map(([emoji, users]) => {
                  const hasReacted = (users as string[]).includes(displayName);
                  const count = (users as string[]).length;
                  return (
                    <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-all ${
                        hasReacted
                          ? isOwn ? 'bg-white/20 text-white border border-white/30' : 'bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]'
                          : 'bg-black/20 text-[var(--text-muted)] hover:bg-black/40 border border-transparent'
                      }`}>
                      <span>{emoji}</span>
                      <span className="font-medium">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Timestamp inside bubble for same-author group */}
            {isSameAuthor && (
              <div className={`text-[10px] mt-1 ${isOwn ? 'text-right text-blue-200/60' : 'text-left text-[var(--text-muted)] opacity-60'}`}>
                {formatTime(msg.timestamp)}
              </div>
            )}

            {/* Hover actions */}
            <div className={`absolute top-1 ${isOwn ? '-left-1 -translate-x-full' : '-right-1 translate-x-full'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5`}>
              <div className="bg-[var(--bg-sidebar)] border border-gray-700 rounded-lg shadow-lg flex items-center gap-0.5 p-0.5">
                <button onClick={() => { setReplyTo({ id: msg.id, author: msg.author, text: msg.text, color: msg.color }); }}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all" title="Reply">
                  <Icon name="reply" size={13} />
                </button>
                <button onClick={() => setThreadMessage(msg)}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-all" title="Thread">
                  <Icon name="message-circle" size={13} />
                </button>
                <button onClick={() => toggleReaction(msg.id, '👍')}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all" title="React">
                  <Icon name="thumbs-up" size={13} />
                </button>
                {isOwn && (
                  <button onClick={() => startEdit(msg)}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all" title="Edit">
                    <Icon name="edit" size={13} />
                  </button>
                )}
                {(isOwn || Store.isAdmin) && (
                  <button onClick={() => confirmDelete(msg.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-red-400 transition-all" title="Delete">
                    <Icon name="trash" size={13} />
                  </button>
                )}
                {Store.isAdmin && (
                  <button onClick={() => togglePin(msg.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-all" title={msg.pinned ? 'Unpin' : 'Pin'}>
                    <Icon name="pin" size={13} className={msg.pinned ? 'text-[var(--accent)]' : ''} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}