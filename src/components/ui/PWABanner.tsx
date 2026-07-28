"use client";

import { useEffect, useState } from "react";
import { X } from "@/components/ui/icons";

export function PWABanner() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<Event | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show banner after 3 seconds if not already installed
      setTimeout(() => {
        if (
          !window.matchMedia("(display-mode: standalone)").matches
        ) {
          setShow(true);
        }
      }, 3000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () =>
      window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = () => {
    if (!deferredPrompt) return;
    (deferredPrompt as unknown as { prompt: () => Promise<void> })
      .prompt()
      .catch(() => {});
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-bg-mid)] border border-[var(--color-border)] rounded-[20px] px-5 py-3 shadow-lg flex items-center gap-4 animate-[slideUp_0.3s_ease]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[12px] bg-[var(--color-pri)] flex items-center justify-center text-white font-bold text-sm">
          OS
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-txt)]">
            Install OS
          </p>
          <p className="text-xs text-[var(--color-txt-muted)]">
            Add to home screen for the best experience
          </p>
        </div>
      </div>
      <button
        onClick={handleInstall}
        className="btn-primary text-sm px-4 py-1.5"
      >
        Install
      </button>
      <button
        onClick={() => setShow(false)}
        className="btn-icon"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
