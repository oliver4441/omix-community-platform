import { useState, useEffect, useRef } from 'react';

type BannerType = 'install' | 'update' | null;

export function PWABanner() {
  const [banner, setBanner] = useState<BannerType>(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const deferredPrompt = useRef<Event | null>(null);
  const [updateSW, setUpdateSW] = useState<ServiceWorker | null>(null);
  const [countdown, setCountdown] = useState(0);
  const autoReloadTimer = useRef<ReturnType<typeof setTimeout>>();
  const countdownInterval = useRef<ReturnType<typeof setInterval>>();

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

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !!(window as any).MSStream;

    // Listen for beforeinstallprompt (Chrome/Android/Desktop)
    const handlePrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setBanner('install');
    };

    const handleInstalled = () => {
      deferredPrompt.current = null;
      setBanner(null);
      localStorage.setItem('omix_install_banner_dismissed', 'true');
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    // iOS fallback: show banner with instructions after 6s
    if (isIOS) {
      const iosTimer = setTimeout(() => {
        if (!localStorage.getItem('omix_install_banner_dismissed')) {
          setBanner('install');
        }
      }, 6000);
      return () => {
        window.removeEventListener('beforeinstallprompt', handlePrompt);
        window.removeEventListener('appinstalled', handleInstalled);
        clearTimeout(iosTimer);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

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
      // No beforeinstallprompt — must be iOS or browser doesn't support it
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !!(window as any).MSStream;
      if (isIOS) {
        alert('Tap Share → Add to Home Screen to install Omix Community.');
      } else {
        alert('To install: open this site in Chrome, tap the ⋮ menu → "Add to Home Screen"');
      }
      setBanner(null);
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
    const updateInterval = { current: 0 as unknown as ReturnType<typeof setInterval> };
    const visibilityHandler = { current: () => {} };

    // Listen for controller change (after skipWaiting) — reload
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const triggerUpdate = (sw: ServiceWorker) => {
      setUpdateSW(sw);
      setBanner('update');
      setCountdown(5);
      // Auto-reload after 5 seconds if user doesn't click
      clearTimeout(autoReloadTimer.current);
      clearInterval(countdownInterval.current);
      countdownInterval.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(countdownInterval.current); return 0; }
          return prev - 1;
        });
      }, 1000);
      autoReloadTimer.current = setTimeout(() => {
        clearInterval(countdownInterval.current);
        sw.postMessage({ type: 'SKIP_WAITING' });
      }, 5000);
    };

    // Initial registration
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // If a new SW is already waiting after initial load, show banner
      if (registration.waiting && navigator.serviceWorker.controller) {
        triggerUpdate(registration.waiting);
      }

      // When a new SW is found during install phase (from update() call)
      registration.addEventListener('updatefound', () => {
        const newSW = registration.installing;
        if (!newSW) return;

        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            triggerUpdate(newSW);
          }
        });
      });

      // Auto-check for updates every 2 minutes
      updateInterval.current = setInterval(() => {
        registration.update().catch(() => {});
      }, 120_000);

      // Also check on visibility change (user comes back to tab)
      visibilityHandler.current = () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler.current);
    }).catch(() => {
      // SW registration failed — silent
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      clearInterval(updateInterval.current);
      clearTimeout(autoReloadTimer.current);
      clearInterval(countdownInterval.current);
      document.removeEventListener('visibilitychange', visibilityHandler.current);
    };
  }, []);

  const handleUpdate = () => {
    clearTimeout(autoReloadTimer.current);
    clearInterval(countdownInterval.current);
    if (updateSW) {
      updateSW.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
    setBanner(null);
  };

  const dismissUpdate = () => {
    clearTimeout(autoReloadTimer.current);
    clearInterval(countdownInterval.current);
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
            <div className="text-xs text-white text-opacity-80">Refreshing in {countdown}s &mdash; a fresh version is ready</div>
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
