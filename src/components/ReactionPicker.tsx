import { useRef, useEffect } from 'react';

const REACTIONS = ['👍', '❤️', '🔥', '😂', '🎉', '😎', '💯', '👏', '🙌', '🤣', '😍', '🚀', '💜', '✨', '🥳', '👀', '💪', '🤝'];

export function ReactionPicker({
  onReact,
  onClose,
}: {
  onReact: (emoji: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    setTimeout(() => document.addEventListener('click', handleClick), 0);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-1 bg-[var(--bg-sidebar)] rounded-xl p-1.5 shadow-2xl border border-gray-700 z-50 flex gap-0.5"
      style={{ animation: 'scaleIn 0.12s ease' }}
    >
      {REACTIONS.map(emoji => (
        <button
          key={emoji}
          onClick={e => { e.stopPropagation(); onReact(emoji); }}
          className="w-8 h-8 flex items-center justify-center text-lg hover:bg-[var(--bg-hover)] rounded-lg transition-all hover:scale-125 cursor-pointer"
          title={emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
