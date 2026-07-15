function Layout({ isMobile, currentView, setView, displayName }) {
    return (
        <div className="flex flex-col h-full w-full" data-name="layout" data-file="components/Layout.js">
            <div className="flex flex-1 overflow-hidden">
                <ServerRail isMobile={isMobile} currentView={currentView} />
                <ChannelSidebar isMobile={isMobile} currentView={currentView} displayName={displayName} />
                <ChatPane isMobile={isMobile} currentView={currentView} displayName={displayName} />
            </div>
            {isMobile && <MobileNav currentView={currentView} setView={setView} />}
        </div>
    );
}
