"use client";

import { useState } from "react";
import { Github } from "@/components/ui/icons";
import { Mso } from "@/components/ui/icons";

export function LandingPage({
  onGetStarted,
  onGithub,
}: {
  onGetStarted: () => void;
  onGithub: () => void;
}) {
  const [githubBusy, setGithubBusy] = useState(false);
  const [githubError, setGithubError] = useState("");

  const handleGithub = async () => {
    setGithubBusy(true);
    setGithubError("");
    try {
      await onGithub();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setGithubError(
        e.message ||
          "GitHub sign-in unavailable — enable the GitHub provider in Supabase"
      );
      setGithubBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md flex flex-col overflow-x-hidden selection:bg-primary-container selection:text-on-primary-container">
      {/* Top navigation */}
      <header className="absolute top-0 w-full z-50">
        <div className="flex justify-between items-center px-6 lg:px-10 py-6 w-full max-w-7xl mx-auto">
          <div className="font-headline-md text-headline-md font-black text-primary tracking-tight">
            Omix
          </div>
          <div className="flex items-center gap-4">
            <a
              href="mailto:support@omix.dev"
              className="text-on-surface-variant font-body-md text-body-md hover:opacity-80 transition-opacity"
            >
              Support
            </a>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow flex flex-col relative w-full max-w-7xl mx-auto px-6 lg:px-10 pt-32 pb-10">
        <div className="hero-glow" />

        {/* Hero section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center min-h-[716px]">
          {/* Value prop & CTAs */}
          <div className="flex flex-col items-start gap-6 z-10">
            <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full border border-outline-variant bg-surface-container-low text-secondary font-label-caps text-label-caps">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              v2.0 Beta Live
            </div>
            <h1 className="font-display-lg text-display-lg text-on-surface">
              The Unified Communication Ecosystem for{" "}
              <span className="text-primary">Developers</span>.
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
              Merge the real-time intimacy of chat with the structured
              permanence of forum-based threading. Engineered for
              high-velocity collaboration.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mt-1">
              <button
                onClick={onGetStarted}
                className="w-full sm:w-auto bg-primary text-on-primary px-6 py-3 rounded font-label-caps text-label-caps hover:bg-primary-container transition-colors shadow-[0_0_15px_rgba(208,188,255,0.3)] flex items-center justify-center gap-2"
              >
                Get Started
                <Mso name="arrow_forward" size={20} fill />
              </button>
              <button
                onClick={handleGithub}
                disabled={githubBusy}
                className="w-full sm:w-auto glass-panel text-on-surface px-6 py-3 rounded font-label-caps text-label-caps hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Github size={20} />
                {githubBusy ? "Redirecting…" : "Sign in with GitHub"}
              </button>
            </div>
            {githubError && (
              <p
                className="text-sm text-[var(--color-dnd)] bg-surface-container rounded-lg px-4 py-2.5 border border-outline-variant/60"
                role="alert"
              >
                {githubError}
              </p>
            )}
          </div>

          {/* Interface visualization */}
          <div className="relative w-full h-[500px] z-10 hidden lg:block">
            <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 gap-2">
              {/* Sidebar mock */}
              <div className="col-span-3 row-span-6 glass-panel rounded-lg p-2 flex flex-col gap-2 border-r-0">
                <div className="h-8 w-8 rounded bg-primary-container text-on-primary-container flex items-center justify-center font-headline-sm mb-4">
                  O
                </div>
                <div className="flex items-center gap-2 bg-primary-container/20 text-primary rounded px-2 py-1 border-l-2 border-primary">
                  <Mso name="terminal" size={18} />
                  <div className="h-2 w-16 bg-primary/50 rounded" />
                </div>
                <div className="flex items-center gap-2 text-on-surface-variant px-2 py-1">
                  <Mso name="chat" size={18} />
                  <div className="h-2 w-20 bg-outline-variant/50 rounded" />
                </div>
                <div className="flex items-center gap-2 text-on-surface-variant px-2 py-1">
                  <Mso name="campaign" size={18} />
                  <div className="h-2 w-12 bg-outline-variant/50 rounded" />
                </div>
              </div>

              {/* Main chat mock */}
              <div className="col-span-9 row-span-4 glass-panel rounded-lg p-4 flex flex-col gap-4">
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-surface-container-highest flex-shrink-0" />
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-24 bg-on-surface-variant rounded" />
                      <div className="h-2 w-12 bg-outline-variant rounded" />
                    </div>
                    <div className="h-4 w-3/4 bg-surface-container-highest rounded" />
                    <div className="h-4 w-1/2 bg-surface-container-highest rounded" />
                  </div>
                </div>
                {/* System message */}
                <div className="w-full py-1 px-2 bg-secondary-container/10 border-l-2 border-secondary text-secondary font-code-md text-code-md flex items-center gap-2">
                  <Mso name="commit" size={16} />
                  Deployed b7f9a2c to production
                </div>
                {/* Code block mock */}
                <div className="w-full code-block-bg rounded-lg border border-outline-variant p-2 flex flex-col gap-1 mt-1">
                  <div className="flex justify-between items-center mb-1 border-b border-outline-variant/50 pb-1">
                    <div className="h-2 w-16 bg-outline-variant rounded" />
                    <Mso name="content_copy" size={14} className="text-on-surface-variant" />
                  </div>
                  <div className="h-2 w-full bg-secondary/30 rounded" />
                  <div className="h-2 w-4/5 bg-tertiary/30 rounded ml-1" />
                  <div className="h-2 w-3/5 bg-tertiary/30 rounded ml-1" />
                  <div className="h-2 w-1/2 bg-secondary/30 rounded" />
                </div>
              </div>

              {/* Input mock */}
              <div className="col-span-9 row-span-2 glass-panel rounded-lg p-2 flex items-end">
                <div className="w-full h-12 rounded border border-outline-variant bg-surface-container-lowest flex items-center px-2 gap-2 shadow-[0_0_0_1px_rgba(208,188,255,0.2)]">
                  <Mso name="add_circle" className="text-on-surface-variant" />
                  <div className="h-4 w-32 bg-outline-variant/30 rounded" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section className="mt-10 border-t border-outline-variant/30 pt-10 flex flex-col items-center gap-6">
          <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest text-center">
            Engineered for teams scaling infrastructure
          </p>
          <div className="flex flex-wrap justify-center gap-10 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            {["Partner 1", "Partner 2", "Partner 3"].map((p) => (
              <div
                key={p}
                className="w-24 h-8 flex items-center justify-center border border-dashed border-outline-variant font-code-md text-code-md text-[11px]"
              >
                {p}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
