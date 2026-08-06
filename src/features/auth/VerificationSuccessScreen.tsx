"use client";

import { Mso } from "@/components/ui/icons";

export function VerificationSuccessScreen({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background antialiased">
      {/* Code-like background grid */}
      <div className="absolute inset-0 bg-grid z-0" />

      <main className="relative z-10 w-full max-w-md px-4 flex flex-col items-center">
        <div className="bg-surface-container-low/80 backdrop-blur-md border border-outline-variant/30 rounded-xl p-8 w-full flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
          {/* Decorative accent line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-inverse-primary to-transparent opacity-70" />

          {/* Brand */}
          <div className="font-headline-sm text-headline-sm font-bold text-on-surface mb-6">
            Omix <span className="text-primary-fixed-dim">Community</span>
          </div>

          {/* Glowing success icon */}
          <div className="w-24 h-24 rounded-full bg-surface-container flex items-center justify-center mb-6 border border-outline-variant/20 relative">
            <div className="absolute inset-0 bg-inverse-primary/10 rounded-full animate-pulse" />
            <Mso
              name="check_circle"
              size={64}
              fill
              className="text-inverse-primary glow-effect relative z-10"
            />
          </div>

          <h1 className="font-headline-md text-headline-md text-on-surface mb-2">
            Email Verified Successfully!
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mb-6 max-w-sm">
            Your developer account is now active. You&apos;re ready to join the
            Omix ecosystem and start collaborating.
          </p>

          <button
            onClick={onLaunch}
            className="w-full bg-inverse-primary hover:bg-inverse-primary/90 text-on-surface font-body-md text-body-md font-semibold py-3 px-4 rounded flex items-center justify-center gap-2 transition-all active:scale-95 duration-200"
          >
            <span>Launch Workspace</span>
            <Mso name="arrow_forward" size={20} />
          </button>

          <div className="mt-5 pt-4 border-t border-outline-variant/20 w-full flex flex-col items-center gap-1 text-on-surface-variant">
            <Mso name="terminal" size={20} className="opacity-70" />
            <span className="font-code-md text-code-md opacity-70">
              Omix Community Developer Hub
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
