import { Icon } from './Icon';

const tabs = [
  { id: 'servers', label: 'Servers', icon: 'grid' as const },
  { id: 'channels', label: 'Channels', icon: 'hash' as const },
  { id: 'chat', label: 'Chat', icon: 'message-square' as const },
  { id: 'dms', label: 'Messages', icon: 'mail' as const },
];

export function MobileNav({ currentView, setView }: { currentView: string; setView: (view: string) => void }) {
  return (
    <div className="h-[60px] bg-[var(--bg-sidebar)] border-t border-[var(--bg-rail)] flex items-stretch justify-around shrink-0 md:hidden"
      data-name="mobile-nav" data-file="components/MobileNav.tsx">
      {tabs.map(tab => {
        const isActive = currentView === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${
              isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
            }`}
          >
            {isActive && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-[var(--accent)] rounded-b-full" />
            )}
            <Icon name={tab.icon} size={20} className="mb-0.5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
