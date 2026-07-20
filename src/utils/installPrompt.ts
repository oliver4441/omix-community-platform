// Shared install prompt state — used by PWABanner and SettingsModal
// Stores the deferred beforeinstallprompt event so any component can trigger it

type InstallPromptEvent = Event & {
  prompt: () => void;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: InstallPromptEvent | null = null;
let listeners: Array<(available: boolean) => void> = [];

export function setDeferredPrompt(e: Event | null) {
  if (e) {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
  } else {
    deferredPrompt = null;
  }
  const available = !!deferredPrompt;
  listeners.forEach(fn => fn(available));
}

export function getDeferredPrompt(): InstallPromptEvent | null {
  return deferredPrompt;
}

export function clearDeferredPrompt() {
  deferredPrompt = null;
  listeners.forEach(fn => fn(false));
}

export function isInstallAvailable(): boolean {
  return !!deferredPrompt;
}

export function onInstallAvailableChange(fn: (available: boolean) => void) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter(f => f !== fn);
  };
}

export async function triggerInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const result = await deferredPrompt.userChoice;
  if (result.outcome === 'accepted') {
    deferredPrompt = null;
    listeners.forEach(fn => fn(false));
    return true;
  }
  return false;
}
