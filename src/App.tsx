import { useState, useEffect, lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
import { AuthScreen } from './components/AuthScreen';
import { PWABanner } from './components/PWABanner';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmProvider';
import { LoadingFallback } from './components/Fallbacks';
import { ErrorBoundary } from './components/ErrorBoundary';

const SearchModal = lazy(() => import('./components/SearchModal').then(m => ({ default: m.SearchModal })));
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Store } from './utils/store';
import { messaging } from './utils/firebase';

function AppInner() {
  const [view, setView] = useState('chat');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [loaded, setLoaded] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { user, loading } = useAuth();

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Request notification permission and set up FCM
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      Store.requestNotificationPermission();
    }, 5000);
    // Listen for foreground messages
    if (messaging) {
      const unsubMessage = messaging.onMessage((payload) => {
        const data = payload.data || {};
        const title = data.title || 'New message';
        const body = data.body || '';
        if (Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/logo-192.png',
            tag: data.channelId || 'omix',
          });
        }
      });
      return () => {
        clearTimeout(timer);
        unsubMessage();
      };
    }
    return () => clearTimeout(timer);
  }, [user]);

  // Ctrl+K to open search
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-chat)]">
        <div className="w-10 h-10 border-2 border-[var(--accent)] border-t-transparent rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const displayName = user.displayName || localStorage.getItem('omix_username') || 'User';
  Store.displayName = displayName;
  Store.setPresence(displayName);

  return (
    <div className={`h-screen w-full flex bg-[var(--bg-chat)] overflow-hidden ${loaded ? 'opacity-100' : 'opacity-0'}`}
      style={{ transition: 'opacity 0.3s ease' }}>
      <Layout isMobile={isMobile} currentView={view} setView={setView} displayName={displayName} />
      <PWABanner />
      {showSearch && (
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback height="h-32" />}>
            <SearchModal onClose={() => setShowSearch(false)} />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AppInner />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export { App };
