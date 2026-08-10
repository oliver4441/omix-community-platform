'use client';

import { useState, useEffect, useRef } from 'react';
import { Store } from '@/lib/store';
import type { Message } from '@/lib/types';
import { MessageCircle, X, Send, Trash2 } from '@/components/ui/icons';
import { Markdown } from '@/components/Markdown';

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

export function ThreadPanel({
  parentMessage,
  onClose,
  displayName,
}: {
  parentMessage: Message;
  onClose: () => void;
  displayName: string;
}) {
  const [replies, setReplies] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = Store.subscribeThread(parentMessage.id, (_, data) => {
      setReplies(data as Message[]);
    });
    inputRef.current?.focus();
    return () => void unsub();
  }, [parentMessage.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  const sendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    Store.sendMessage(Store.currentChannelId, input.trim(), displayName, {
      replyTo: {
        id: parentMessage.id,
        author: parentMessage.author,
        text: parentMessage.text,
        color: parentMessage.color,
      },
      threadId: parentMessage.id,
    });
    setInput('');
  };

  return (
    <div
      className="w-[340px] max-md:w-full max-md:absolute max-md:inset-0 max-md:z-50 bg-[var(--color-bg-dark)] h-full flex flex-col border-l border-[var(--color-border)] shrink-0"
      data-name="thread-panel"
    >
      {/* Header */}
      <div className="h-12 border-b border-[var(--color-border)] flex items-center px-4 gap-2 shrink-0">
        <MessageCircle size={18} className="text-[var(--color-pri)]" />
        <span className="font-bold text-sm text-[var(--color-txt)]">Thread</span>
        <button
          onClick={onClose}
          className="ml-auto w-7 h-7 rounded-lg hover:bg-[var(--color-bg-hover)] flex items-center justify-center text-[var(--color-txt-muted)] hover:text-[var(--color-txt)] transition-all"
        >
          <X size={14} />
        </button>
      </div>

      {/* Parent message */}
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex gap-2.5">
          <div
            className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: parentMessage.color || 'var(--color-pri)' }}
          >
            {(parentMessage.author || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span
                className="text-sm font-semibold"
                style={{ color: parentMessage.color || 'var(--color-pri)' }}
              >
                {parentMessage.author}
              </span>
              <span className="text-[10px] text-[var(--color-txt-muted)]">
                {formatTime(parentMessage.timestamp)}
              </span>
            </div>
            <div className="text-sm text-[var(--color-txt)] mt-0.5 leading-relaxed break-words">
              <Markdown>{parentMessage.text || ""}</Markdown>
            </div>
            {parentMessage.fileUrl && parentMessage.fileType?.startsWith('image/') && (
              <img
                src={parentMessage.fileUrl}
                className="max-w-[200px] max-h-40 rounded-[12px] object-cover mt-1.5"
                alt=""
              />
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {replies.map((reply) => {
          const isOwn = reply.sessionId === Store.sessionId;
          return (
            <div key={reply.id} className="flex gap-2.5 group">
              <div
                className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-white mt-0.5"
                style={{ backgroundColor: reply.color || 'var(--color-pri)' }}
              >
                {(reply.author || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: reply.color || 'var(--color-pri)' }}
                  >
                    {reply.author}
                  </span>
                  <span className="text-[10px] text-[var(--color-txt-muted)]">
                    {formatTime(reply.timestamp)}
                  </span>
                  {isOwn && (
                    <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                      <button
                        onClick={() => Store.deleteMessage(reply.id)}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--color-bg-hover)] text-[var(--color-txt-muted)] hover:text-red-400 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-sm text-[var(--color-txt)] mt-0.5 leading-relaxed break-words">
                  <Markdown>{reply.text || ""}</Markdown>
                </div>
                {reply.fileUrl && reply.fileType?.startsWith('image/') && (
                  <img
                    src={reply.fileUrl}
                    className="max-w-[180px] max-h-32 rounded-[12px] object-cover mt-1"
                    alt=""
                  />
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Reply input */}
      <div className="p-3 border-t border-[var(--color-border)] shrink-0">
        <form onSubmit={sendReply} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Reply in thread..."
            className="flex-1 bg-[var(--color-bg-mid)] text-[var(--color-txt)] rounded-[12px] px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[var(--color-pri)] border border-[var(--color-border)]"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-9 h-9 rounded-[12px] bg-[var(--color-pri)] hover:bg-[var(--color-pri)] disabled:opacity-40 flex items-center justify-center transition-all shrink-0"
          >
            <Send size={15} className="text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}
