'use client';

import { lazy, Suspense } from 'react';
import { Send, Smile, Paperclip, X, AtSign, Reply } from '@/components/ui/icons';
import type { Message } from '@/lib/types';

const EmojiPicker = lazy(() =>
  import('./EmojiPicker').then((m) => ({ default: m.EmojiPicker }))
);

interface MessageInputProps {
  channelName: string;
  input: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  showEmoji: boolean;
  setShowEmoji: (show: boolean) => void;
  showMentions: boolean;
  replyTo: Message['replyTo'] | null;
  setReplyTo: (reply: Message['replyTo'] | null) => void;
  sendMsg: (e: React.FormEvent) => void;
  handleInput: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  insertMention: (name: string) => void;
  addEmoji: (emoji: string) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  filteredMentions: string[];
}

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
}

export function MessageInput({
  channelName,
  input,
  inputRef,
  showEmoji,
  setShowEmoji,
  showMentions,
  replyTo,
  setReplyTo,
  sendMsg,
  handleInput,
  insertMention,
  addEmoji,
  handleFileSelect,
  filteredMentions,
}: MessageInputProps) {
  return (
    <>
      {/* Reply indicator above input */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-[var(--color-bg-mid)] border-t border-[var(--color-border)] text-sm shrink-0">
          <Reply size={14} className="text-[var(--color-pri)]" />
          <span className="text-xs text-[var(--color-txt-muted)]">Replying to </span>
          <span
            className="text-xs font-semibold"
            style={{ color: replyTo.color || 'var(--color-pri)' }}
          >
            {replyTo.author}
          </span>
          <span className="text-xs text-[var(--color-txt-muted)] truncate flex-1">
            {replyTo.text}
          </span>
          <button
            onClick={() => setReplyTo(null)}
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-txt-muted)] hover:text-[var(--color-txt)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Message input */}
      <div className="px-4 py-3 bg-[var(--color-bg-dark)] border-t border-[var(--color-border)] shrink-0 relative">
        {/* Mention dropdown */}
        {showMentions && filteredMentions.length > 0 && (
          <div className="absolute bottom-full left-4 mb-1 bg-[var(--color-bg-dark)] border border-[var(--color-border)] rounded-[20px] shadow-xl overflow-hidden min-w-[180px]">
            {filteredMentions.map((name) => (
              <button
                key={name}
                onClick={() => insertMention(name)}
                className="w-full px-3 py-2 text-sm text-left text-[var(--color-txt)] hover:bg-[var(--color-bg-hover)] transition-colors flex items-center gap-2"
              >
                <AtSign size={14} className="text-[var(--color-txt-muted)]" />
                {name}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={sendMsg} className="flex items-end gap-2">
          <div className="flex-1 flex items-center bg-[var(--color-bg-mid)] rounded-[20px] px-3 border border-[var(--color-border)] focus-within:border-[var(--color-pri)] focus-within:bg-[var(--color-bg-mid)] transition-all">
            <button
              type="button"
              onClick={() => document.getElementById('file-input')?.click()}
              className="p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-txt-muted)] hover:text-[var(--color-txt)] transition-all shrink-0"
              aria-label="Attach file"
            >
              <Paperclip size={18} />
            </button>
            <textarea
              ref={inputRef}
              id="chat-input"
              value={input}
              onChange={handleInput}
              onInput={(e) => autoGrow(e.currentTarget)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={`Message #${channelName}`}
              className="flex-1 bg-transparent border-none outline-none py-2.5 px-2 text-sm text-[var(--color-txt)] placeholder-[var(--color-txt-muted)] resize-none max-h-40 leading-relaxed"
              autoFocus
            />
            <input
              id="file-input"
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => setShowEmoji(!showEmoji)}
              className={`p-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-all shrink-0 ${
                showEmoji
                  ? 'text-[var(--color-pri)] bg-[var(--color-pri-muted)]'
                  : 'text-[var(--color-txt-muted)] hover:text-[var(--color-txt)]'
              }`}
              aria-label="Toggle emoji picker"
            >
              <Smile size={18} />
            </button>
          </div>
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-10 h-10 rounded-[12px] bg-[var(--color-pri)] hover:bg-[var(--color-pri)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:scale-105 active:scale-95 shrink-0"
            aria-label="Send message"
          >
            <Send size={18} className="text-white" />
          </button>
        </form>

        {/* Emoji picker */}
        {showEmoji && (
          <Suspense fallback={null}>
            <EmojiPicker
              onSelect={addEmoji}
              onClose={() => setShowEmoji(false)}
            />
          </Suspense>
        )}
      </div>
    </>
  );
}
