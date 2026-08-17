"use client";

import { useState } from "react";
import { Github, Google } from "@/components/ui/icons";
import { Mso } from "@/components/ui/icons";

interface LandingPageProps {
  onSignIn: () => void;
  onSignUp: () => void;
  onGoogle: () => void;
  onGithub: () => void;
}

export function LandingPage({
  onSignIn,
  onSignUp,
  onGoogle,
  onGithub,
}: LandingPageProps) {
  const [oauthBusy, setOauthBusy] = useState<"google" | "github" | null>(null);
  const [oauthError, setOauthError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleGoogle = async () => {
    setOauthBusy("google");
    setOauthError("");
    try {
      await onGoogle();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setOauthError(e.message || "Google sign-in failed");
      setOauthBusy(null);
    }
  };

  const handleGithub = async () => {
    setOauthBusy("github");
    setOauthError("");
    try {
      await onGithub();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setOauthError(e.message || "GitHub sign-in failed");
      setOauthBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md flex flex-col overflow-x-hidden selection:bg-primary-container selection:text-on-primary-container">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 w-full z-50 backdrop-blur-md bg-background/80 border-b border-outline-variant/30">
        <div className="flex justify-between items-center px-4 sm:px-6 lg:px-10 py-4 w-full max-w-7xl mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high overflow-hidden flex items-center justify-center border border-outline-variant/40">
              <img src="/logo.jpg" alt="Omix Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-headline-md text-headline-md font-extrabold text-primary tracking-tight">
              Omix
            </span>
          </div>

          {/* Desktop Links & Actions */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-on-surface-variant font-body-md hover:text-on-surface transition-colors"
            >
              Features
            </a>
            <a
              href="#community"
              className="text-on-surface-variant font-body-md hover:text-on-surface transition-colors"
            >
              Community
            </a>
            <a
              href="mailto:support@omix.dev"
              className="text-on-surface-variant font-body-md hover:text-on-surface transition-colors"
            >
              Support
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={onSignIn}
              className="px-4 py-2 text-on-surface font-label-caps text-label-caps hover:text-primary transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={onSignUp}
              className="bg-primary text-on-primary px-5 py-2 rounded-lg font-label-caps text-label-caps hover:bg-primary-container transition-all shadow-[0_0_15px_rgba(208,188,255,0.25)] flex items-center gap-1.5"
            >
              Get Started
              <Mso name="arrow_forward" size={16} fill />
            </button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="md:hidden text-on-surface p-2 rounded-lg hover:bg-surface-container transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            <Mso name={mobileMenuOpen ? "close" : "menu"} size={24} />
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-outline-variant/30 bg-surface-container-low px-6 py-4 flex flex-col gap-4 animate-in slide-in-from-top duration-200">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="text-on-surface font-body-md py-1"
            >
              Features
            </a>
            <a
              href="#community"
              onClick={() => setMobileMenuOpen(false)}
              className="text-on-surface font-body-md py-1"
            >
              Community
            </a>
            <a
              href="mailto:support@omix.dev"
              onClick={() => setMobileMenuOpen(false)}
              className="text-on-surface font-body-md py-1"
            >
              Support
            </a>
            <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/30">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onSignIn();
                }}
                className="w-full py-2.5 text-center text-on-surface font-label-caps text-label-caps border border-outline-variant rounded-lg hover:bg-surface-container transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onSignUp();
                }}
                className="w-full py-2.5 text-center bg-primary text-on-primary font-label-caps text-label-caps rounded-lg hover:bg-primary-container transition-colors flex items-center justify-center gap-2"
              >
                Get Started
                <Mso name="arrow_forward" size={18} fill />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-grow flex flex-col relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-12 sm:pt-20 pb-16">
        <div className="hero-glow" />

        {/* Hero section */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[600px]">
          {/* Value prop & CTAs */}
          <div className="flex flex-col items-start gap-6 z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-outline-variant/60 bg-surface-container-low text-secondary font-label-caps text-label-caps">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              v2.0 Beta Live
            </div>
            <h1 className="font-display-lg text-display-lg text-on-surface leading-tight">
              The Unified Communication Ecosystem for{" "}
              <span className="text-primary bg-clip-text">Developers</span>.
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
              Merge the real-time intimacy of chat with the structured
              permanence of forum-based threading. Engineered for
              high-velocity collaboration.
            </p>

            {/* Call To Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mt-2">
              <button
                onClick={onSignUp}
                className="w-full sm:w-auto bg-primary text-on-primary px-6 py-3.5 rounded-lg font-label-caps text-label-caps hover:bg-primary-container transition-all shadow-[0_0_20px_rgba(208,188,255,0.3)] flex items-center justify-center gap-2 text-center"
              >
                Create Account
                <Mso name="arrow_forward" size={20} fill />
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleGoogle}
                  disabled={oauthBusy !== null}
                  className="flex-1 sm:flex-initial glass-panel text-on-surface px-4 py-3.5 rounded-lg font-label-caps text-label-caps hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  aria-label="Sign in with Google"
                >
                  <Google size={18} />
                  <span>Google</span>
                </button>
                <button
                  onClick={handleGithub}
                  disabled={oauthBusy !== null}
                  className="flex-1 sm:flex-initial glass-panel text-on-surface px-4 py-3.5 rounded-lg font-label-caps text-label-caps hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  aria-label="Sign in with GitHub"
                >
                  <Github size={18} />
                  <span>GitHub</span>
                </button>
              </div>
            </div>

            {oauthError && (
              <p
                className="text-sm text-[var(--color-dnd)] bg-surface-container rounded-lg px-4 py-2.5 border border-outline-variant/60 w-full max-w-xl"
                role="alert"
              >
                {oauthError}
              </p>
            )}
          </div>

          {/* Interface visualization */}
          <div className="relative w-full h-[460px] z-10 hidden lg:block">
            <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 gap-2">
              {/* Sidebar mock */}
              <div className="col-span-3 row-span-6 glass-panel rounded-xl p-3 flex flex-col gap-2 border-r-0">
                <div className="h-8 w-8 rounded bg-primary-container text-on-primary-container flex items-center justify-center font-headline-sm mb-4 font-bold">
                  O
                </div>
                <div className="flex items-center gap-2 bg-primary-container/20 text-primary rounded px-2 py-1.5 border-l-2 border-primary">
                  <Mso name="terminal" size={18} />
                  <div className="h-2 w-16 bg-primary/50 rounded" />
                </div>
                <div className="flex items-center gap-2 text-on-surface-variant px-2 py-1.5">
                  <Mso name="chat" size={18} />
                  <div className="h-2 w-20 bg-outline-variant/50 rounded" />
                </div>
                <div className="flex items-center gap-2 text-on-surface-variant px-2 py-1.5">
                  <Mso name="campaign" size={18} />
                  <div className="h-2 w-12 bg-outline-variant/50 rounded" />
                </div>
              </div>

              {/* Main chat mock */}
              <div className="col-span-9 row-span-4 glass-panel rounded-xl p-4 flex flex-col gap-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-container-highest flex-shrink-0" />
                  <div className="flex flex-col gap-1.5 w-full">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-24 bg-on-surface-variant/80 rounded" />
                      <div className="h-2 w-12 bg-outline-variant rounded" />
                    </div>
                    <div className="h-4 w-3/4 bg-surface-container-highest rounded" />
                    <div className="h-4 w-1/2 bg-surface-container-highest rounded" />
                  </div>
                </div>
                {/* System message */}
                <div className="w-full py-1.5 px-3 bg-secondary-container/10 rounded-lg border-l-2 border-secondary text-secondary font-code-md text-code-md flex items-center gap-2 text-xs">
                  <Mso name="commit" size={16} />
                  Deployed b7f9a2c to production
                </div>
                {/* Code block mock */}
                <div className="w-full code-block-bg rounded-lg border border-outline-variant p-3 flex flex-col gap-1.5 mt-1">
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
              <div className="col-span-9 row-span-2 glass-panel rounded-xl p-3 flex items-end">
                <div className="w-full h-11 rounded-lg border border-outline-variant bg-surface-container-lowest flex items-center px-3 gap-2 shadow-[0_0_0_1px_rgba(208,188,255,0.2)]">
                  <Mso name="add_circle" className="text-on-surface-variant" size={20} />
                  <div className="h-3.5 w-32 bg-outline-variant/40 rounded" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features section anchor */}
        <section id="features" className="mt-24 pt-12 border-t border-outline-variant/20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-headline-md text-headline-md text-on-surface font-bold mb-3">
              Built for Modern Software Engineering Teams
            </h2>
            <p className="font-body-md text-on-surface-variant">
              Seamlessly transition between real-time team channels, long-form discussion forums, and automated dev tools.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-xl flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-container/20 text-primary flex items-center justify-center">
                <Mso name="terminal" size={22} />
              </div>
              <h3 className="font-title-md text-title-md font-semibold text-on-surface">Developer Native</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Syntax highlighting, git commit webhooks, and embedded code snippets right in your discussions.
              </p>
            </div>
            <div className="glass-panel p-6 rounded-xl flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary-container/20 text-secondary flex items-center justify-center">
                <Mso name="forum" size={22} />
              </div>
              <h3 className="font-title-md text-title-md font-semibold text-on-surface">Structured Threads</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Never lose critical decision logs in noisy chat streams. Preserve answers and proposals cleanly.
              </p>
            </div>
            <div className="glass-panel p-6 rounded-xl flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-tertiary-container/20 text-tertiary flex items-center justify-center">
                <Mso name="bolt" size={22} />
              </div>
              <h3 className="font-title-md text-title-md font-semibold text-on-surface">Ultra High Velocity</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Instant real-time sync, PWA offline support, and low latency messaging powered by Cloudflare Workers.
              </p>
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section id="community" className="mt-20 border-t border-outline-variant/30 pt-10 flex flex-col items-center gap-6">
          <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest text-center">
            Engineered for teams scaling infrastructure
          </p>
          <div className="flex flex-wrap justify-center gap-8 opacity-60 hover:opacity-100 transition-opacity duration-300">
            {["Cloud Native", "DevOps Core", "Open Engine"].map((p) => (
              <div
                key={p}
                className="px-6 py-2 rounded-lg border border-outline-variant/60 bg-surface-container-low font-code-md text-code-md text-xs text-on-surface-variant"
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
