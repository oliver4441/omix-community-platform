export function MobileNav({ currentView, setView }: { currentView: string; setView: (view: string) => void }) {
  return (
    <div className="h-[60px] bg-[var(--bg-sidebar)] border-t border-[var(--bg-rail)] flex items-center justify-around shrink-0 md:hidden pb-safe" data-name="mobile-nav" data-file="components/MobileNav.tsx">
      <button
        onClick={() => setView('servers')}
        className={`flex flex-col items-center justify-center w-16 h-full ${currentView === 'servers' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
      >
        <svg className="icon-message-square text-2xl mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
      <button
        onClick={() => setView('channels')}
        className={`flex flex-col items-center justify-center w-16 h-full ${currentView === 'channels' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
      >
        <svg className="icon-hash text-2xl mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-5m0 0l-5-5m5 5H6" />
        </svg>
      </button>
      <button
        onClick={() => setView('chat')}
        className={`flex flex-col items-center justify-center w-16 h-full ${currentView === 'chat' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
      >
        <svg className="icon-users text-2xl mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </button>
    </div>
  );
}