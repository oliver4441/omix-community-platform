import { ServerRail } from './ServerRail';
import { ChannelSidebar } from './ChannelSidebar';
import { ChatPane } from './ChatPane';
import { MobileNav } from './MobileNav';
import { DMSidebar } from './DMSidebar';

export function Layout({
  isMobile,
  currentView,
  setView,
  displayName,
}: {
  isMobile: boolean;
  currentView: string;
  setView: (view: string) => void;
  displayName: string;
}) {
  return (
    <div className="flex flex-col h-full w-full" data-name="layout" data-file="components/Layout.tsx">
      <div className="flex flex-1 overflow-hidden">
        <ServerRail isMobile={isMobile} currentView={currentView} onDMClick={() => setView('dms')} />
        {currentView === 'dms' ? (
          <DMSidebar isMobile={isMobile} currentView={currentView} displayName={displayName} setView={setView} />
        ) : (
          <>
            <ChannelSidebar isMobile={isMobile} currentView={currentView} displayName={displayName} />
            <ChatPane isMobile={isMobile} currentView={currentView} displayName={displayName} />
          </>
        )}
      </div>
      {isMobile && <MobileNav currentView={currentView} setView={setView} />}
    </div>
  );
}