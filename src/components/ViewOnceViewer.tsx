import { useState, useEffect, useCallback } from 'react';

export function ViewOnceViewer({
  src,
  fileType,
  messageId,
  onClose,
}: {
  src: string;
  fileType?: string;
  messageId: string;
  onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [markedViewed, setMarkedViewed] = useState(false);

  // Prevent right-click / context menu
  useEffect(() => {
    const preventCtx = (e: MouseEvent) => e.preventDefault();
    const preventKey = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 's') || (e.ctrlKey && e.key === 'p')) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', preventCtx);
    document.addEventListener('keydown', preventKey);
    return () => {
      document.removeEventListener('contextmenu', preventCtx);
      document.removeEventListener('keydown', preventKey);
    };
  }, []);

  // Auto-reveal after countdown
  useEffect(() => {
    if (revealed) return;
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timer);
          setRevealed(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [revealed]);

  // Mark as viewed when revealed
  useEffect(() => {
    if (!revealed || markedViewed) return;
    setMarkedViewed(true);
    // Dynamically import store to mark viewed
    import('../utils/store').then(({ Store }) => {
      Store.markViewOnceViewed(messageId).catch(() => {});
    });
  }, [revealed, markedViewed, messageId]);

  const handleClose = useCallback(() => {
    // Ensure it's marked viewed before closing
    if (!markedViewed) {
      import('../utils/store').then(({ Store }) => {
        Store.markViewOnceViewed(messageId).catch(() => {});
      });
    }
    onClose();
  }, [markedViewed, messageId, onClose]);

  // Prevent accidental close on mobile with back gesture
  const isVideo = fileType?.startsWith('video/');

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black select-none"
      style={{
        animation: 'fadeIn 0.2s ease',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10 bg-gradient-to-b from-black/60 to-transparent">
        <span className="text-white/60 text-xs font-medium">View Once</span>
        <button
          onClick={handleClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Before reveal — blurred preview + tap to view */}
      {!revealed && (
        <div className="relative flex flex-col items-center justify-center flex-1 w-full">
          <div className="relative max-w-[90vw] max-h-[60vh] overflow-hidden rounded-xl">
            {isVideo ? (
              <video
                src={src}
                className="max-w-full max-h-[60vh] object-contain blur-2xl scale-110"
                preload="metadata"
                playsInline
              />
            ) : (
              <img
                src={src}
                alt=""
                className="max-w-full max-h-[60vh] object-contain blur-2xl scale-110"
                draggable={false}
              />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
              <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center mb-4 border border-white/20">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <p className="text-white/80 text-sm font-medium mb-2">View Once Media</p>
              <p className="text-white/40 text-xs mb-6">This media will disappear after viewing</p>
              <div className="flex items-center gap-3">
                <div className="w-1 h-1 rounded-full bg-white/30 animate-ping" style={{ animationDelay: '0s' }} />
                <div className="w-1 h-1 rounded-full bg-white/30 animate-ping" style={{ animationDelay: '0.5s' }} />
                <div className="w-1 h-1 rounded-full bg-white/30 animate-ping" style={{ animationDelay: '1s' }} />
              </div>
              <p className="text-white/50 text-xs mt-6 font-mono">Opening in {countdown}s</p>
            </div>
          </div>
          <button
            onClick={() => { setRevealed(true); setCountdown(0); }}
            className="mt-6 px-8 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium backdrop-blur-md border border-white/10 transition-all active:scale-95"
          >
            Tap to View
          </button>
          <p className="text-white/30 text-[10px] mt-3 max-w-xs text-center leading-relaxed">
            Screenshots and screen recording are blocked. The sender will know when this is opened.
          </p>
        </div>
      )}

      {/* After reveal — show media */}
      {revealed && (
        <div className="flex-1 flex items-center justify-center w-full">
          {isVideo ? (
            <video
              src={src}
              className="max-w-full max-h-full object-contain"
              controls={false}
              autoPlay
              playsInline
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              style={{ pointerEvents: 'none' }}
            />
          ) : (
            <img
              src={src}
              alt=""
              className="max-w-full max-h-full object-contain"
              draggable={false}
              style={{ pointerEvents: 'none' }}
            />
          )}
        </div>
      )}

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 px-6 py-4 bg-gradient-to-t from-black/60 to-transparent">
        <p className="text-center text-white/40 text-[10px]">
          {revealed ? 'Media viewed. Close to dismiss permanently.' : 'Only available once'}
        </p>
      </div>
    </div>
  );
}
