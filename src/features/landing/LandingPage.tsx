"use client";

import { useState } from "react";
import { Github, Menu, X } from "@/components/ui/icons";
import { Mso } from "@/components/ui/icons";

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onGithub: () => void;
}

export function LandingPage({ onGetStarted, onSignIn, onGithub }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [githubBusy, setGithubBusy] = useState(false);
  const [githubError, setGithubError] = useState("");

  const handleGithub = async () => {
    setGithubBusy(true);
    setGithubError("");
    try {
      await onGithub();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setGithubError(e.message || "GitHub sign-in failed");
      setGithubBusy(false);
    }
  };

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-[100dvh] bg-background text-on-background font-body-md flex flex-col overflow-x-hidden selection:bg-primary-container selection:text-on-primary-container">
      <header className="sticky top-0 z-50 w-full border-b border-outline-variant/30 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-3" aria-label="Omix home">
            <div className="h-9 w-9 overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-high">
              <img src="/logo.jpg" alt="Omix" className="h-full w-full object-cover" />
            </div>
            <span className="font-headline-md font-extrabold tracking-tight text-primary">Omix</span>
          </button>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Primary navigation">
            <a href="#features" className="text-on-surface-variant transition-colors hover:text-on-surface">Features</a>
            <a href="#platform" className="text-on-surface-variant transition-colors hover:text-on-surface">Platform</a>
            <a href="mailto:support@omix.dev" className="text-on-surface-variant transition-colors hover:text-on-surface">Support</a>
            <button onClick={onSignIn} className="font-label-caps text-label-caps text-on-surface transition-colors hover:text-primary">Sign In</button>
            <button onClick={onGetStarted} className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 font-label-caps text-label-caps text-on-primary shadow-[0_0_18px_rgba(208,188,255,0.25)] transition-colors hover:bg-primary-container">
              Get Started
              <Mso name="arrow_forward" size={16} fill />
            </button>
          </nav>

          <button
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="rounded-lg p-2 text-on-surface transition-colors hover:bg-surface-container md:hidden"
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-outline-variant/30 bg-surface-container-low px-4 py-4 md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-2" aria-label="Mobile navigation">
              <a onClick={closeMenu} href="#features" className="rounded-lg px-3 py-3 text-on-surface hover:bg-surface-container">Features</a>
              <a onClick={closeMenu} href="#platform" className="rounded-lg px-3 py-3 text-on-surface hover:bg-surface-container">Platform</a>
              <a onClick={closeMenu} href="mailto:support@omix.dev" className="rounded-lg px-3 py-3 text-on-surface hover:bg-surface-container">Support</a>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-outline-variant/30 pt-3">
                <button onClick={() => { closeMenu(); onSignIn(); }} className="rounded-lg border border-outline-variant px-4 py-3 font-label-caps text-label-caps text-on-surface">Sign In</button>
                <button onClick={() => { closeMenu(); onGetStarted(); }} className="rounded-lg bg-primary px-4 py-3 font-label-caps text-label-caps text-on-primary">Get Started</button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:px-10 lg:pt-20">
        <section id="platform" className="grid min-h-[620px] grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="z-10 flex flex-col items-start gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/60 bg-surface-container-low px-3 py-1 text-secondary font-label-caps text-label-caps">
              <span className="h-2 w-2 animate-pulse rounded-full bg-secondary" />
              Omix Community Platform
            </div>
            <h1 className="font-display-lg text-display-lg leading-tight text-on-surface">
              One community platform for <span className="text-primary">developers</span> and everyone else.
            </h1>
            <p className="max-w-xl font-body-lg text-body-lg text-on-surface-variant">
              Chat in real time, build conversations that last, connect your GitHub activity, and move between developer and community experiences whenever you need to.
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <button onClick={onGetStarted} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 font-label-caps text-label-caps text-on-primary shadow-[0_0_20px_rgba(208,188,255,0.3)] transition-colors hover:bg-primary-container sm:w-auto">
                Create Account
                <Mso name="arrow_forward" size={20} fill />
              </button>
              <button onClick={handleGithub} disabled={githubBusy} className="flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-5 py-3.5 font-label-caps text-label-caps text-on-surface transition-colors hover:bg-surface-container-high disabled:opacity-60 sm:w-auto">
                <Github size={18} />
                {githubBusy ? "Redirecting…" : "Continue with GitHub"}
              </button>
            </div>
            {githubError && <p className="w-full max-w-xl rounded-lg border border-outline-variant/60 bg-surface-container px-4 py-2.5 text-sm text-[var(--color-dnd)]" role="alert">{githubError}</p>}
          </div>

          <div className="relative hidden h-[460px] lg:block" aria-hidden="true">
            <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 gap-2">
              <div className="col-span-3 row-span-6 rounded-xl border border-outline-variant/50 bg-surface-container/70 p-3 shadow-xl backdrop-blur-xl">
                <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container font-bold text-on-primary-container">O</div>
                {[["terminal", "Developer"], ["chat", "Chat"], ["forum", "Boardroom"], ["person", "Community"]].map(([icon, label], index) => (
                  <div key={label} className={`mb-2 flex items-center gap-2 rounded-lg px-2 py-2 ${index === 0 ? "bg-primary-container/20 text-primary" : "text-on-surface-variant"}`}>
                    <Mso name={icon} size={18} />
                    <span className="text-xs">{label}</span>
                  </div>
                ))}
              </div>
              <div className="col-span-9 row-span-4 rounded-xl border border-outline-variant/50 bg-surface-container/70 p-5 shadow-xl backdrop-blur-xl">
                <div className="mb-4 flex items-center gap-3"><div className="h-9 w-9 rounded-full bg-surface-container-highest" /><div><div className="h-3 w-28 rounded bg-on-surface-variant/60" /><div className="mt-2 h-2 w-16 rounded bg-outline-variant" /></div></div>
                <div className="h-4 w-4/5 rounded bg-surface-container-highest" /><div className="mt-2 h-4 w-3/5 rounded bg-surface-container-highest" />
                <div className="mt-6 rounded-lg border border-outline-variant bg-surface-container-lowest p-4"><div className="h-2 w-1/3 rounded bg-secondary/40" /><div className="mt-3 h-2 w-full rounded bg-outline-variant/60" /><div className="mt-2 h-2 w-4/5 rounded bg-outline-variant/40" /></div>
              </div>
              <div className="col-span-9 row-span-2 flex items-end rounded-xl border border-outline-variant/50 bg-surface-container/70 p-3 shadow-xl backdrop-blur-xl"><div className="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest" /></div>
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-outline-variant/20 pt-16">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="font-headline-md font-bold text-headline-md text-on-surface">Built around how people actually communicate</h2>
            <p className="mt-3 text-on-surface-variant">Move naturally between real-time chat, persistent discussions, developer tools, and community discovery.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              ["terminal", "Developer Native", "GitHub activity, projects, developer feeds, and technical communities in one focused workspace."],
              ["forum", "Structured Discussions", "Keep useful conversations discoverable through boardrooms, threads, replies, and reactions."],
              ["chat", "Real-time Community", "Private messaging, presence, notifications, and calls for conversations that need immediacy."],
            ].map(([icon, title, description]) => (
              <article key={title} className="rounded-xl border border-outline-variant/40 bg-surface-container/50 p-6 backdrop-blur-lg">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary-container/20 text-primary"><Mso name={icon} size={22} /></div>
                <h3 className="font-title-md font-semibold text-title-md text-on-surface">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-outline-variant/20 px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Omix Community</span>
          <a href="mailto:support@omix.dev" className="hover:text-on-surface">Support</a>
        </div>
      </footer>
    </div>
  );
}
