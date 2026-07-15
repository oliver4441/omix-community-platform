function MobileNav({ currentView, setView }) {
    return (
        <div className="h-[60px] bg-[var(--bg-sidebar)] border-t border-[var(--bg-rail)] flex items-center justify-around shrink-0 md:hidden pb-safe" data-name="mobile-nav" data-file="components/MobileNav.js">
            <button 
                onClick={() => setView('servers')}
                className={`flex flex-col items-center justify-center w-16 h-full ${currentView === 'servers' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
            >
                <div className="icon-message-square text-2xl mb-1"></div>
            </button>
            <button 
                onClick={() => setView('channels')}
                className={`flex flex-col items-center justify-center w-16 h-full ${currentView === 'channels' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
            >
                <div className="icon-hash text-2xl mb-1"></div>
            </button>
            <button 
                onClick={() => setView('chat')}
                className={`flex flex-col items-center justify-center w-16 h-full ${currentView === 'chat' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
            >
                <div className="icon-users text-2xl mb-1"></div>
            </button>
        </div>
    );
}