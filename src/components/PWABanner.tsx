import { useState, useEffect, useRef } from 'react';

type BannerType = 'install' | 'update' | null;

export function PWABanner() {
  const [banner, setBanner] = useState<BannerType>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const deferredPrompt = useRef<Event | null>(null);
  const [updateSW, setUpdateSW] = useState<ServiceWorker | null>(null);

  // --- ONLINE/OFFLINE ---
  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // --- INSTALL BANNER ---
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || !!(navigator as any).standalone;
    if (isStandalone) return;

    const dismissed = localStorage.getItem('omix_install_banner_dismissed');
    if (dismissed === 'true') return;

    // Listen for beforeinstallprompt
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      showInstallAfterDelay();
    };

    const handleInstalled = () => {
      deferredPrompt.current = null;
      setBanner(null);
      localStorage.setItem('omix_install_banner_dismissed', 'true');
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    // Fallback: show banner after 6s even if beforeinstallprompt hasn't fired
    const fallbackTimer = setTimeout(() => {
      if (!banner && !localStorage.getItem('omix_install_banner_dismissed')) {
        setBanner('install');
      }
    }, 6000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const showInstallAfterDelay = () => {
    setTimeout(() => {
      if (!localStorage.getItem('omix_install_banner_dismissed')) {
        setBanner('install');
      }
    }, 2000);
  };

  const handleInstall = () => {
    if (deferredPrompt.current) {
      const prompt = deferredPrompt.current as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };
      prompt.prompt();
      prompt.userChoice.then((result) => {
        if (result.outcome === 'accepted') {
          localStorage.setItem('omix_install_banner_dismissed', 'true');
        }
        deferredPrompt.current = null;
        setBanner(null);
      });
    } else {
      // iOS or unsupported — show instructions
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !!(window as any).MSStream;
      if (isIOS) {
        alert('Tap Share → Add to Home Screen to install Omix Community.');
      } else {
        // Try the standard install through browser menu
        setBanner(null);
      }
    }
  };

  const dismissInstall = () => {
    localStorage.setItem('omix_install_banner_dismissed', 'true');
    setBanner(null);
  };

  // --- SERVICE WORKER + AUTO-UPDATE (every 2min) ---
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let refreshing = false;
    const intervalRef = { current: 0 as unknown as ReturnType<typeof setInterval> };
    const visibleHandler = { current: () => {} };

    // Listen for controller change (after skipWaiting) — reload
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Initial registration
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // If a new SW is already waiting after initial load, show banner (user just arrived)
      if (registration.waiting && navigator.serviceWorker.controller) {
        setUpdateSW(registration.waiting);
        setBanner('update');
      }

      // When a new SW is found during install phase
      registration.addEventListener('updatefound', () => {
        const newSW = registration.installing;
        if (!newSW) return;

        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            // New SW is installed and waiting — auto-update
            setUpdateSW(newSW);
            newSW.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      // Auto-check for updates every 2 minutes
      intervalRef.current = setInterval(() => {
        registration.update().catch(() => {});
      }, 120_000);

      // Also check on visibility change (user comes back to tab)
      visibleHandler.current = () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      };
      document.addEventListener('visibilitychange', visibleHandler.current);
    }).catch(() => {
      // SW registration failed — silent
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', visibleHandler.current);
    };
  }, []);

  const handleUpdate = () => {
    if (updateSW) {
      updateSW.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
    setBanner(null);
  };

  const dismissUpdate = () => {
    setBanner(null);
  };

  // Only show offline indicator if no other banner
  if (offline && !banner) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-600 text-white text-xs font-medium text-center py-1.5 px-4">
        You're offline — some features may be limited
      </div>
    );
  }

  if (!banner) return null;

  return (
    <div className="fixed left-0 right-0 z-[9999] px-4"
      style={{ [banner === 'update' ? 'top' : 'bottom']: 0, animation: 'fadeSlideUp 0.4s ease' }}>
      {banner === 'update' ? (
        <div className="bg-[var(--accent)] text-white rounded-2xl shadow-2xl mx-auto max-w-md mb-4 mt-4 p-4 flex items-center gap-3 border border-[var(--accent)] border-opacity-30">
          <div className="w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-xl shrink-0">📦</div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">New Update Available</div>
            <div className="text-xs text-white text-opacity-80">A fresh version of Omix Community is ready</div>
          </div>
          <button onClick={handleUpdate}
            className="bg-white text-[var(--accent)] rounded-xl px-4 py-2 text-sm font-bold hover:bg-opacity-90 transition-all whitespace-nowrap shrink-0">
            Update
          </button>
          <button onClick={dismissUpdate}
            className="text-white text-opacity-60 hover:text-opacity-100 text-lg transition-opacity shrink-0">✕</button>
        </div>
      ) : banner === 'install' ? (
        <div className="bg-[#2b2d31] text-white rounded-2xl shadow-2xl mx-auto max-w-md mb-4 p-4 flex items-center gap-3 border border-gray-700">
          <div className="w-10 h-10 rounded-full bg-[var(--accent)] bg-opacity-20 flex items-center justify-center text-xl shrink-0">🚀</div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">Install Omix Community</div>
            <div className="text-xs text-[var(--text-muted)]">Get the full experience &mdash; fast, offline-ready</div>
          </div>
          <button onClick={handleInstall}
            className="bg-[var(--accent)] text-white rounded-xl px-5 py-2 text-sm font-bold hover:opacity-90 transition-all whitespace-nowrap shrink-0">
            Install
          </button>
          <button onClick={dismissInstall}
            className="text-[var(--text-muted)] hover:text-white text-lg transition-colors shrink-0">✕</button>
        </div>
      ) : null}
    </div>
  );
}
