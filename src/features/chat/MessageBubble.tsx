'use client';

import { Store } from '@/lib/store';
import type { Message } from '@/lib/types';
import { Markdown } from '@/components/Markdown';
import {
  Reply,
  MessageCircle,
  ThumbsUp,
  Edit3,
  Trash2,
  Pin,
  FileText,
} from '@/components/ui/icons';

function formatTime(ts: unknown): string {
  if (!ts) return '';
  const d =
    ts instanceof Date
      ? ts
      : typeof ts === 'object' && ts !== null && 'toDate' in ts
        ? (ts as { toDate: () => Date }).toDate()
        : new Date(String(ts));
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
  const threadReplies = messages.filter((m) => m.threadId === msg.id);
  const threadReplyCount = threadReplies.length;

  const handleOpenImage = (url: string) => {
    setLightboxSrc(url);
  };

  const openAuthorProfile = () => {
    if (isOwn || !msg.sessionId) return;
    window.dispatchEvent(
      new CustomEvent('openProfile', { detail: { userId: msg.sessionId } })
    );
  };

  const handleReplyClick = () => {
    const el = document.getElementById(`msg-${msg.replyTo?.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[var(--color-pri)]');
      setTimeout(() => el.classList.remove('ring-2', 'ring-[var(--color-pri)]'), 2000);
    }
  };

  return (
    <div key={msg.id}>
      {/* Date separator */}
      {dateSep && (
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-[var(--color-border)]" />
          <span className="text-xs font-medium text-[var(--color-txt-muted)] shrink-0">
            {dateSep}
          </span>
          <div className="flex-1 h-px bg-[var(--color-border)]" />
        </div>
      )}

      <div
        id={`msg-${msg.id}`}
        className={`group relative flex ${isOwn ? 'justify-end' : 'justify-start'} ${isSameAuthor ? 'mt-0.5' : 'mt-3'}`}
        data-message-id={msg.id}
      >
        {/* Other user's avatar — first message in group only */}
        {!isOwn && showAvatar && (
          <div
            className="w-9 h-9 rounded-full overflow-hidden shrink-0 mt-0.5 mr-2.5 self-start cursor-pointer transition-transform hover:scale-105"
            onClick={openAuthorProfile}
            title="View profile"
            role="button"
            aria-label={`View ${msg.author}'s profile`}
          >
            {profile?.avatar ? (
              <img
                src={profile.avatar}
                className="w-full h-full object-cover"
                alt=""
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-sm font-bold text-white"
                style={{ backgroundColor: msg.color || 'var(--color-pri)' }}
              >
                {(msg.author || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* Spacer for own messages */}
        {isOwn && showAvatar && <div className="w-9 shrink-0 mr-2.5" />}
        {isOwn && !showAvatar && <div className="w-[11px] shrink-0 mr-2.5" />}

        <div
          className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}
        >
          {/* Author name + timestamp — first message in group */}
          {showAvatar && (
            <div
              className={`flex items-baseline gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}
            >
              <button
                onClick={openAuthorProfile}
                className={`text-xs font-semibold ${
                  isOwn ? '' : 'hover:underline cursor-pointer'
                }`}
                style={{ color: msg.color || 'var(--color-pri)' }}
                title={isOwn ? undefined : 'View profile'}
              >
                {msg.author}
              </button>
              <span className="text-[10px] text-[var(--color-txt-muted)]">
                {formatTime(msg.timestamp)}
              </span>
              {msg.edited && (
                <span className="text-[10px] text-[var(--color-txt-muted)] italic">
                  (edited)
                </span>
              )}
            </div>
          )}

          {/* Reply indicator */}
          {msg.replyTo && (
            <div
              className={`text-xs text-[var(--color-txt-muted)] flex items-center gap-1 mb-0.5 cursor-pointer hover:text-[var(--color-pri)] transition-colors max-w-full ${isOwn ? 'flex-row-reverse' : ''}`}
              onClick={handleReplyClick}
            >
              <Reply size={10} />
              <span className="truncate max-w-[200px]">
                <span className="font-medium">{msg.replyTo.author}</span>:{' '}
                {msg.replyTo.text}
              </span>
            </div>
          )}

          {/* The bubble */}
          <div
            className={`relative px-3 py-2 rounded-[12px] ${
              isOwn
                ? 'bg-[var(--msg-bg-own)] text-[var(--color-txt)]'
                : 'bg-[var(--msg-bg)] text-[var(--color-txt)]'
            }`}
          >
            {/* Edit mode */}
            {isEditing ? (
              <div className="flex flex-col gap-2 items-end">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      saveEdit(msg.id);
                    }
                  }}
                  rows={Math.min(8, Math.max(1, editText.split("\n").length))}
                  className="flex-1 w-full min-w-[220px] bg-[var(--color-bg-mid)] text-[var(--color-txt)] rounded-xl px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[var(--color-pri)] resize-y"
                  autoFocus
                  aria-label="Edit message text"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(msg.id)}
                    className="text-xs text-[var(--color-pri)] hover:underline"
                    aria-label="Save edited message"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditing(null);
                      setEditText("");
                    }}
                    className="text-xs text-[var(--color-txt-muted)] hover:underline"
                    aria-label="Cancel editing message"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <Markdown>{msg.text}</Markdown>
            )}

            {/* File attachment */}
            {msg.fileUrl && (
              <div className="mt-1.5">
                {msg.fileType?.startsWith('image/') ? (
                  <img
                    src={msg.fileUrl}
                    className="max-w-xs max-h-60 rounded-[12px] object-cover cursor-pointer transition-transform hover:scale-[1.02]"
                    alt="Image"
                    onClick={() => handleOpenImage(msg.fileUrl!)}
                  />
                ) : (
                  <a
                    href={msg.fileUrl}
                    download
                    className={`flex items-center gap-2 text-sm ${
                      isOwn
                        ? 'text-[var(--color-txt-secondary)]'
                        : 'text-[var(--color-pri)]'
                    } hover:underline`}
                  >
                    <FileText size={14} />
                    {msg.fileName || 'Attachment'}
                  </a>
                )}
              </div>
            )}

            {/* Thread reply count */}
            {threadReplyCount > 0 && (
              <button
                onClick={() => setThreadMessage(msg)}
                className={`flex items-center gap-1.5 mt-1.5 text-xs hover:underline transition-colors ${
                  isOwn
                    ? 'text-[var(--color-txt-secondary)]'
                    : 'text-[var(--color-pri)]'
                }`}
                aria-label={`${threadReplyCount} ${threadReplyCount === 1 ? 'reply' : 'replies'}. Click to view thread.`}
              >
                <MessageCircle size={12} />
                {threadReplyCount}{' '}
                {threadReplyCount === 1 ? 'reply' : 'replies'}
              </button>
            )}

            {/* Reactions */}
            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
              <div
                className={`flex flex-wrap gap-1 pt-1 ${
                  isOwn ? 'justify-end' : 'justify-start'
                }`}
                role="group"
                aria-label="Reactions"
              >
                {Object.entries(msg.reactions).map(([emoji, users]) => {
                  const hasReacted = (users as string[]).includes(displayName);
                  const count = (users as string[]).length;
                  return (
                    <button
                      key={emoji}
                      onClick={() => toggleReaction(msg.id, emoji)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-all ${
                        hasReacted
                          ? isOwn
                            ? 'bg-white/20 text-white border border-white/30'
                            : 'bg-[var(--color-pri-muted)] text-[var(--color-pri)] border border-[var(--color-pri)]'
                          : 'bg-black/20 text-[var(--color-txt-muted)] hover:bg-black/40 border border-transparent'
                      }`}
                      aria-label={`${emoji} reaction${hasReacted ? ' (reacted)' : ''}, ${count} ${count === 1 ? 'person' : 'people'}`}
                    >
                      <span>{emoji}</span>
                      <span className="font-medium">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Timestamp inside bubble for same-author group */}
            {isSameAuthor && !isEditing && (
              <div
                className={`text-[10px] mt-1 ${
                  isOwn
                    ? 'text-right text-[var(--color-txt-muted)]'
                    : 'text-left text-[var(--color-txt-muted)]'
                }`}
              >
                {formatTime(msg.timestamp)}
              </div>
            )}

            {/* Hover actions */}
            <div
              className={`absolute top-1 ${
                isOwn ? 'right-0 translate-x-[calc(100%+4px)]' : 'left-0 -translate-x-[calc(100%+4px)]'
              } opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5`}
            >
              <div className="bg-[var(--color-bg-mid)] border border-[var(--color-border)] rounded-[12px] shadow-lg flex items-center gap-0.5 p-0.5">
                <button
                  onClick={() => {
                    setReplyTo({
                      id: msg.id,
                      author: msg.author,
                      text: msg.text,
                      color: msg.color,
                    });
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-txt-muted)] hover:text-[var(--color-txt)] transition-all"
                  title="Reply"
                  aria-label={`Reply to ${msg.author}'s message`}
                >
                  <Reply size={13} />
                </button>
                <button
                  onClick={() => setThreadMessage(msg)}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-txt-muted)] hover:text-[var(--color-pri)] transition-all"
                  title="Thread"
                  aria-label={`Open thread for ${msg.author}'s message`}
                >
                  <MessageCircle size={13} />
                </button>
                <button
                  onClick={() => toggleReaction(msg.id, '👍')}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-txt-muted)] hover:text-[var(--color-txt)] transition-all"
                  title="React"
                  aria-label="React with thumbs up"
                >
                  <ThumbsUp size={13} />
                </button>
                {isOwn && (
                  <button
                    onClick={() => startEdit(msg)}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-txt-muted)] hover:text-[var(--color-txt)] transition-all"
                    title="Edit"
                    aria-label="Edit your message"
                  >
                    <Edit3 size={13} />
                  </button>
                )}
                {(isOwn || Store.isAdmin) && (
                  <button
                    onClick={() => confirmDelete(msg.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-txt-muted)] hover:text-red-400 transition-all"
                    title="Delete"
                    aria-label="Delete message"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
                {Store.isAdmin && (
                  <button
                    onClick={() => togglePin(msg.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-txt-muted)] hover:text-[var(--color-pri)] transition-all"
                    title={msg.pinned ? 'Unpin' : 'Pin'}
                    aria-label={msg.pinned ? 'Unpin message' : 'Pin message'}
                  >
                    <Pin
                      size={13}
                      className={msg.pinned ? 'text-[var(--color-pri)]' : ''}
                    />
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
