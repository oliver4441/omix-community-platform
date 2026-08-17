"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWABanner() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      window.setTimeout(() => setShow(true), 1200);
    };
    const installed = () => {
      setShow(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    setShow(false);
    setDeferredPrompt(null);
  };

  if (!show || !deferredPrompt) return null;

  return (
    <aside className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 md:left-auto md:right-6 md:inset-x-auto z-[100] max-w-md rounded-2xl border border-border bg-background/95 p-3 shadow-2xl backdrop-blur-xl" role="dialog" aria-label="Install Omix">
      <div className="flex items-center gap-3">
        <img src="/logo-192-maskable.png" alt="Omix" className="h-11 w-11 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">Install Omix</p>
          <p className="text-xs text-muted-foreground">Add Omix to your Android home screen for a faster app-like experience.</p>
        </div>
        <button type="button" onClick={() => setShow(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Dismiss install prompt"><X className="h-4 w-4" /></button>
      </div>
      <button type="button" onClick={install} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><Download className="h-4 w-4" />Install now</button>
    </aside>
  );
}
