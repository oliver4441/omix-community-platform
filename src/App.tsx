import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Store } from './utils/store';

function App() {
  const [view, setView] = useState('chat');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setTimeout(() => setLoaded(true), 100);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const savedName = localStorage.getItem('omix_username');
  if (!savedName) {
    return <WelcomeScreen onEnter={name => { localStorage.setItem('omix_username', name); window.location.reload(); }} />;
  }

  Store.displayName = savedName;
  Store.setPresence(savedName);

  return (
    <div className={`h-screen w-full flex bg-[var(--bg-chat)] overflow-hidden ${loaded ? 'opacity-100' : 'opacity-0'}`}
      style={{ transition: 'opacity 0.3s ease' }}>
      <Layout isMobile={isMobile} currentView={view} setView={setView} displayName={savedName} />
    </div>
  );
}

export { App };