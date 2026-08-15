"use client";

import { useState } from "react";
import {
  Github,
  Mso,
  MessageSquare,
  Users,
  Zap,
  Shield,
  Code,
  Terminal,
  ChevronDown,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Globe,
  Radio,
  Share2,
  Menu,
  X,
  Layers,
  Activity,
  Lock,
} from "@/components/ui/icons";

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onGithub: () => void;
}

export function LandingPage({
  onGetStarted,
  onSignIn,
  onGithub,
}: LandingPageProps) {
  const [githubBusy, setGithubBusy] = useState(false);
  const [githubError, setGithubError] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "boardroom" | "profile" | "voice">("chat");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-background text-on-background font-body-md flex flex-col overflow-x-hidden selection:bg-primary-container selection:text-on-primary-container">
      {/* Background ambient lighting glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="hero-glow top-0 left-1/2 -translate-x-1/2 animate-pulse" />
        <div className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] bg-secondary/15 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-[10%] left-[-10%] w-[600px] h-[600px] bg-primary/15 rounded-full blur-[160px]" />
      </div>

      {/* Navigation Bar */}
      <header className="sticky top-0 w-full z-50 bg-surface-container-lowest/80 backdrop-blur-xl border-b border-outline-variant/40 transition-all">
        <div className="flex justify-between items-center px-4 sm:px-8 py-4 w-full max-w-7xl mx-auto">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-primary-container to-secondary-container p-0.5 shadow-[0_0_15px_rgba(208,188,255,0.3)] flex items-center justify-center transition-transform hover:scale-105">
              <div className="w-full h-full bg-surface-container-lowest rounded-[10px] flex items-center justify-center overflow-hidden">
                <img src="/logo-192.png" alt="Omix Logo" className="w-7 h-7 object-contain" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm font-black text-on-surface tracking-tight leading-none">
                Omix
              </span>
              <span className="font-label-caps text-[10px] text-primary tracking-widest uppercase font-semibold">
                Community
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 font-label-caps text-label-caps text-on-surface-variant">
            <a href="#about" className="hover:text-primary transition-colors">
              About
            </a>
            <a href="#features" className="hover:text-primary transition-colors">
              Features
            </a>
            <a href="#showcase" className="hover:text-primary transition-colors">
              Ecosystem
            </a>
            <a href="#faq" className="hover:text-primary transition-colors">
              FAQ
            </a>
            <a
              href="mailto:support@omix.dev"
              className="hover:text-primary transition-colors"
            >
              Support
            </a>
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={onSignIn}
              className="px-4 py-2 rounded text-on-surface hover:text-primary font-label-caps text-label-caps transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={onGetStarted}
              className="bg-primary text-on-primary px-5 py-2.5 rounded font-label-caps text-label-caps hover:bg-primary-container transition-all shadow-[0_0_20px_rgba(208,188,255,0.3)] flex items-center gap-2 active:scale-95"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-on-surface hover:bg-surface-container-high transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer Overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-surface-container-lowest/95 backdrop-blur-2xl border-b border-outline-variant/50 px-6 py-6 flex flex-col gap-5 animate-fade-in">
            <a
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className="font-body-md text-base text-on-surface hover:text-primary"
            >
              About Omix
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="font-body-md text-base text-on-surface hover:text-primary"
            >
              Features
            </a>
            <a
              href="#showcase"
              onClick={() => setMobileMenuOpen(false)}
              className="font-body-md text-base text-on-surface hover:text-primary"
            >
              Ecosystem
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="font-body-md text-base text-on-surface hover:text-primary"
            >
              FAQ
            </a>
            <a
              href="mailto:support@omix.dev"
              onClick={() => setMobileMenuOpen(false)}
              className="font-body-md text-base text-on-surface hover:text-primary"
            >
              Support
            </a>
            <div className="flex flex-col gap-3 pt-4 border-t border-outline-variant/40">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onSignIn();
                }}
                className="w-full py-3 rounded-lg border border-outline-variant text-on-surface font-label-caps text-sm text-center"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onGetStarted();
                }}
                className="w-full py-3 rounded-lg bg-primary text-on-primary font-label-caps text-sm font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(208,188,255,0.3)]"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col relative w-full z-10">
        {/* Hero Section */}
        <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 pt-12 sm:pt-20 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Headlines & Actions */}
            <div className="lg:col-span-7 flex flex-col items-start gap-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary font-label-caps text-xs shadow-[0_0_15px_rgba(208,188,255,0.2)]">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary"></span>
                </span>
                <span>v2.0 Beta Live · Open Source Client-Only PWA</span>
              </div>

              {/* Title */}
              <h1 className="font-display-lg text-4xl sm:text-5xl lg:text-6xl text-on-surface tracking-tight leading-tight">
                The Unified Communication Ecosystem for{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-tertiary animate-pulse">
                  Developers
                </span>
                .
              </h1>

              {/* Description */}
              <p className="font-body-lg text-base sm:text-lg text-on-surface-variant max-w-2xl leading-relaxed">
                Merge real-time intimacy with structured RFC thread permanence. Engineered with a lightning-fast client-only React 19 architecture, native developer tools, and instant code execution context.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto pt-2">
                <button
                  onClick={onGetStarted}
                  className="bg-primary text-on-primary px-8 py-4 rounded-lg font-label-caps text-sm font-bold hover:bg-primary-container transition-all shadow-[0_0_25px_rgba(208,188,255,0.35)] flex items-center justify-center gap-2.5 active:scale-95 group"
                >
                  Launch App Free
                  <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                </button>
                <button
                  onClick={handleGithub}
                  disabled={githubBusy}
                  className="glass-panel text-on-surface px-6 py-4 rounded-lg font-label-caps text-sm hover:bg-surface-container-highest transition-all flex items-center justify-center gap-2.5 disabled:opacity-60 border border-outline-variant/60"
                >
                  <Github className="w-5 h-5 text-on-surface" />
                  {githubBusy ? "Connecting GitHub…" : "Sign in with GitHub"}
                </button>
              </div>

              {githubError && (
                <p
                  className="text-sm text-error bg-error-container/20 border border-error/30 rounded-lg px-4 py-2.5 max-w-lg"
                  role="alert"
                >
                  {githubError}
                </p>
              )}

              {/* Sub-proof features */}
              <div className="flex flex-wrap items-center gap-6 pt-4 text-xs font-label-caps text-on-surface-variant">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-secondary" />
                  <span>No Password Required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-secondary" />
                  <span>Instant PWA Install</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-secondary" />
                  <span>Supabase Edge Powered</span>
                </div>
              </div>
            </div>

            {/* Right Column: Floating Graphic / Mockup */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-2xl p-1 bg-gradient-to-b from-outline-variant/80 via-outline-variant/20 to-transparent shadow-[0_20px_60px_rgba(0,0,0,0.6)] transform hover:-translate-y-1 transition-transform duration-300">
                <div className="bg-surface-container-lowest/95 rounded-[14px] p-4 flex flex-col gap-3 backdrop-blur-md">
                  {/* Mock Window Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-outline-variant/40">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-error/80" />
                      <div className="w-3 h-3 rounded-full bg-warning/80" />
                      <div className="w-3 h-3 rounded-full bg-secondary/80" />
                      <span className="ml-2 font-code-md text-xs text-on-surface-variant">
                        omix-hub // #general
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                      <span className="font-code-md text-[11px]">LIVE</span>
                    </div>
                  </div>

                  {/* Mock Chat Message 1 */}
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low/60 border border-outline-variant/30">
                    <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs shrink-0">
                      JS
                    </div>
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-code-md text-xs font-bold text-primary">
                          @jules
                        </span>
                        <span className="font-code-md text-[10px] text-on-surface-variant">
                          12:42 PM
                        </span>
                      </div>
                      <p className="font-body-sm text-xs text-on-surface">
                        Deployed new worker routes to Cloudflare edge. Response time is down to 4ms! 🚀
                      </p>
                      {/* Code Block Mock */}
                      <div className="mt-1.5 p-2 rounded bg-surface-container-lowest border border-outline-variant/40 font-code-md text-[11px] text-secondary overflow-x-auto">
                        <code>wrangler deploy --env production --minified</code>
                      </div>
                    </div>
                  </div>

                  {/* Mock Thread / Boardroom card */}
                  <div className="p-3 rounded-lg bg-primary-container/10 border border-primary/30 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-code-md text-[11px] text-primary bg-primary/20 px-2 py-0.5 rounded">
                        #RFCs
                      </span>
                      <span className="font-code-md text-[11px] text-secondary font-bold flex items-center gap-1">
                        ▲ 24 Votes
                      </span>
                    </div>
                    <h4 className="font-headline-sm text-xs font-bold text-on-surface">
                      RFC-08: Zero-latency WebRTC Audio Huddles in Channels
                    </h4>
                    <p className="font-body-sm text-[11px] text-on-surface-variant line-clamp-2">
                      Proposal to embed peer-to-peer audio rooms right above standard text channels.
                    </p>
                  </div>

                  {/* Mock Input Bar */}
                  <div className="mt-1 flex items-center gap-2 p-2 rounded-lg bg-surface-container-high border border-outline-variant/50">
                    <Terminal className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-code-md text-xs text-on-surface-variant/70 flex-1">
                      Type /command or message...
                    </span>
                    <button className="p-1 rounded bg-primary text-on-primary">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Detailed About Section */}
        <section id="about" className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-20 border-t border-outline-variant/30">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col gap-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/30 text-secondary font-label-caps text-xs w-fit">
                <Layers className="w-4 h-4" />
                About Omix Architecture
              </div>
              <h2 className="font-headline-md text-3xl sm:text-4xl font-bold text-on-surface">
                Engineered for High-Velocity Engineering Teams
              </h2>
              <p className="font-body-md text-on-surface-variant leading-relaxed">
                Traditional developer tools force teams to split their time between noisy real-time chat apps and disconnected forum software. Omix combines both into a single, unified client-only Progressive Web App.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  <h4 className="font-bold text-sm text-on-surface">Client-Only Speed</h4>
                  <p className="text-xs text-on-surface-variant">Runs entirely in the browser with zero server hydration delay or cold starts.</p>
                </div>
                <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 flex flex-col gap-2">
                  <Lock className="w-5 h-5 text-secondary" />
                  <h4 className="font-bold text-sm text-on-surface">PostgreSQL & RLS</h4>
                  <p className="text-xs text-on-surface-variant">Granular row-level security and automated Supabase database backups.</p>
                </div>
              </div>
            </div>

            {/* Architecture Card */}
            <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-outline-variant/60 flex flex-col gap-6">
              <h3 className="font-headline-sm text-xl font-bold text-on-surface flex items-center gap-2">
                <Code className="w-5 h-5 text-primary" />
                Tech Stack Architecture
              </h3>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
                  <span className="font-code-md text-xs text-on-surface-variant">Frontend Application</span>
                  <span className="font-code-md text-xs font-bold text-primary">React 19 + Next.js 16 (Static Export)</span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
                  <span className="font-code-md text-xs text-on-surface-variant">Data & Auth Engine</span>
                  <span className="font-code-md text-xs font-bold text-secondary">Supabase PostgreSQL + Realtime</span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
                  <span className="font-code-md text-xs text-on-surface-variant">Edge Compute Microservices</span>
                  <span className="font-code-md text-xs font-bold text-tertiary">Cloudflare Workers + D1 SQLite</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-code-md text-xs text-on-surface-variant">Peer-to-Peer Audio/Video</span>
                  <span className="font-code-md text-xs font-bold text-on-surface">Jitsi WebRTC SDK</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Metrics / Social Proof Bar */}
        <section className="w-full border-y border-outline-variant/30 bg-surface-container-lowest/60 backdrop-blur-md py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="flex flex-col items-center">
              <span className="font-display-lg text-3xl sm:text-4xl font-black text-primary">
                &lt; 10ms
              </span>
              <span className="font-label-caps text-xs text-on-surface-variant mt-1 uppercase tracking-wider">
                Real-Time Latency
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-display-lg text-3xl sm:text-4xl font-black text-secondary">
                100%
              </span>
              <span className="font-label-caps text-xs text-on-surface-variant mt-1 uppercase tracking-wider">
                Client-Side PWA Export
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-display-lg text-3xl sm:text-4xl font-black text-tertiary">
                Supabase
              </span>
              <span className="font-label-caps text-xs text-on-surface-variant mt-1 uppercase tracking-wider">
                Realtime Data Sync
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-display-lg text-3xl sm:text-4xl font-black text-on-surface">
                Zero
              </span>
              <span className="font-label-caps text-xs text-on-surface-variant mt-1 uppercase tracking-wider">
                Server Overhead
              </span>
            </div>
          </div>
        </section>

        {/* Interactive Feature Tabs Showcase */}
        <section id="showcase" className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-20">
          <div className="flex flex-col items-center text-center gap-4 mb-12">
            <span className="font-label-caps text-xs text-primary uppercase tracking-widest font-semibold">
              Ecosystem Showcase
            </span>
            <h2 className="font-headline-md text-headline-md sm:text-4xl font-bold text-on-surface">
              Built Specifically for the Modern Software Stack
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
              Everything your dev team needs to ideate, chat, discuss RFCs, and pair program without context switching.
            </p>

            {/* Tab Buttons */}
            <div className="flex flex-wrap justify-center gap-2 mt-4 p-1.5 rounded-xl bg-surface-container-high border border-outline-variant/60">
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-5 py-2.5 rounded-lg font-label-caps text-xs transition-all flex items-center gap-2 ${
                  activeTab === "chat"
                    ? "bg-primary text-on-primary font-bold shadow"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Dev Chat
              </button>
              <button
                onClick={() => setActiveTab("boardroom")}
                className={`px-5 py-2.5 rounded-lg font-label-caps text-xs transition-all flex items-center gap-2 ${
                  activeTab === "boardroom"
                    ? "bg-primary text-on-primary font-bold shadow"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Mso name="forum" size={16} />
                Boardroom RFCs
              </button>
              <button
                onClick={() => setActiveTab("profile")}
                className={`px-5 py-2.5 rounded-lg font-label-caps text-xs transition-all flex items-center gap-2 ${
                  activeTab === "profile"
                    ? "bg-primary text-on-primary font-bold shadow"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Github className="w-4 h-4" />
                GitHub Profiles
              </button>
              <button
                onClick={() => setActiveTab("voice")}
                className={`px-5 py-2.5 rounded-lg font-label-caps text-xs transition-all flex items-center gap-2 ${
                  activeTab === "voice"
                    ? "bg-primary text-on-primary font-bold shadow"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Radio className="w-4 h-4" />
                Voice Huddles
              </button>
            </div>
          </div>

          {/* Active Tab Panel */}
          <div className="glass-panel rounded-2xl border border-outline-variant/60 p-6 sm:p-10 transition-all">
            {activeTab === "chat" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="flex flex-col gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="font-headline-sm text-2xl font-bold text-on-surface">
                    Real-Time Developer Channels
                  </h3>
                  <p className="font-body-md text-on-surface-variant leading-relaxed">
                    Discord-style messaging tuned for engineers. Features full Markdown rendering, code block syntax highlighting, file attachments, reactions, typing indicators, and inline threads.
                  </p>
                  <ul className="flex flex-col gap-2 mt-2">
                    <li className="flex items-center gap-2 font-body-sm text-on-surface">
                      <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                      Instant WebSocket broadcast via Supabase & Ably
                    </li>
                    <li className="flex items-center gap-2 font-body-sm text-on-surface">
                      <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                      Code block copy & syntax previewing
                    </li>
                    <li className="flex items-center gap-2 font-body-sm text-on-surface">
                      <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                      Unread message counters and desktop notifications
                    </li>
                  </ul>
                </div>
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 p-4 font-code-md text-xs flex flex-col gap-3">
                  <div className="text-secondary font-bold border-b border-outline-variant/30 pb-2">
                    # engineering-sync
                  </div>
                  <div className="flex gap-2">
                    <span className="text-primary font-bold">@alex:</span>
                    <span className="text-on-surface">Has anyone benchmarked React 19 server components vs dynamic imports on Next static export?</span>
                  </div>
                  <div className="flex gap-2 bg-surface-container-high/50 p-2 rounded">
                    <span className="text-tertiary font-bold">@sam:</span>
                    <span className="text-on-surface">Zero overhead on static export when combined with service worker caching! Here is the bundle report:</span>
                  </div>
                  <div className="p-2.5 rounded bg-background border border-outline-variant/40 text-[11px] text-on-surface-variant">
                    <code>dist/app.js · 142 kB (gzipped: 38 kB)</code>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "boardroom" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="flex flex-col gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary/20 text-secondary flex items-center justify-center">
                    <Mso name="forum" size={24} />
                  </div>
                  <h3 className="font-headline-sm text-2xl font-bold text-on-surface">
                    Structured Boardroom RFCs
                  </h3>
                  <p className="font-body-md text-on-surface-variant leading-relaxed">
                    Stop losing important technical decisions in fast-scrolling chat logs. Boardroom provides forum-style proposals with upvotes, categories (#RFCs, #Bugs, #Announcements), and status tagging.
                  </p>
                  <ul className="flex flex-col gap-2 mt-2">
                    <li className="flex items-center gap-2 font-body-sm text-on-surface">
                      <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                      Voting & prioritization mechanism for core features
                    </li>
                    <li className="flex items-center gap-2 font-body-sm text-on-surface">
                      <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                      Categorized discussions with tag filtering
                    </li>
                    <li className="flex items-center gap-2 font-body-sm text-on-surface">
                      <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                      Edge D1 database backed for persistent archiving
                    </li>
                  </ul>
                </div>
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 p-4 flex flex-col gap-3">
                  <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/40 flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <span className="font-code-md text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded w-fit">#RFCs</span>
                      <h4 className="font-bold text-sm text-on-surface">Migrate state store to reactive signals</h4>
                      <span className="text-xs text-on-surface-variant">by @dev_lead · 14 replies</span>
                    </div>
                    <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded bg-surface-container-high border border-outline-variant/50">
                      <span className="text-secondary font-bold text-sm">▲ 48</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/40 flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <span className="font-code-md text-[10px] text-tertiary bg-tertiary/10 px-2 py-0.5 rounded w-fit">#Bugs</span>
                      <h4 className="font-bold text-sm text-on-surface">WebSocket reconnect delay on mobile PWA backgrounding</h4>
                      <span className="text-xs text-on-surface-variant">by @mobile_ninja · 6 replies</span>
                    </div>
                    <div className="flex flex-col items-center justify-center px-3 py-1.5 rounded bg-surface-container-high border border-outline-variant/50">
                      <span className="text-secondary font-bold text-sm">▲ 19</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "profile" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="flex flex-col gap-4">
                  <div className="w-10 h-10 rounded-lg bg-tertiary/20 text-tertiary flex items-center justify-center">
                    <Github className="w-6 h-6" />
                  </div>
                  <h3 className="font-headline-sm text-2xl font-bold text-on-surface">
                    GitHub Profile & Repo Integration
                  </h3>
                  <p className="font-body-md text-on-surface-variant leading-relaxed">
                    Connect your GitHub OAuth account to showcase your public repositories, star counts, follower metrics, and primary programming languages right on your developer profile card.
                  </p>
                  <ul className="flex flex-col gap-2 mt-2">
                    <li className="flex items-center gap-2 font-body-sm text-on-surface">
                      <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                      Featured repositories grid with star and fork counts
                    </li>
                    <li className="flex items-center gap-2 font-body-sm text-on-surface">
                      <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                      Automatic GitHub avatar & bio synchronization
                    </li>
                    <li className="flex items-center gap-2 font-body-sm text-on-surface">
                      <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                      One-click OAuth authentication flow
                    </li>
                  </ul>
                </div>
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3">
                    <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-primary">
                      GH
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-on-surface">Gideon Kipkirui</h4>
                      <p className="font-code-md text-xs text-on-surface-variant">@omix-dev · 120 Repositories</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-code-md text-xs">
                    <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/30 flex flex-col gap-1">
                      <span className="font-bold text-primary">os-scaffold</span>
                      <span className="text-[11px] text-on-surface-variant">⭐ 342 stars · TypeScript</span>
                    </div>
                    <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/30 flex flex-col gap-1">
                      <span className="font-bold text-secondary">omix-api</span>
                      <span className="text-[11px] text-on-surface-variant">⭐ 189 stars · Cloudflare</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "voice" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="flex flex-col gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                    <Radio className="w-6 h-6" />
                  </div>
                  <h3 className="font-headline-sm text-2xl font-bold text-on-surface">
                    Peer-to-Peer Voice & Screen Share
                  </h3>
                  <p className="font-body-md text-on-surface-variant leading-relaxed">
                    Jump into instant voice huddles right inside channels. Built with Jitsi WebRTC for crystal-clear pair programming audio, noise suppression, and screen sharing.
                  </p>
                  <ul className="flex flex-col gap-2 mt-2">
                    <li className="flex items-center gap-2 font-body-sm text-on-surface">
                      <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                      Zero installation required — runs directly in browser PWA
                    </li>
                    <li className="flex items-center gap-2 font-body-sm text-on-surface">
                      <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                      Low latency WebRTC peer routing
                    </li>
                    <li className="flex items-center gap-2 font-body-sm text-on-surface">
                      <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                      One-click screen broadcast for code reviews
                    </li>
                  </ul>
                </div>
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/50 p-4 flex flex-col gap-3">
                  <div className="p-3 rounded-lg bg-surface-container-high border border-outline-variant/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
                      <span className="font-bold text-sm text-on-surface">Voice Huddle: #pair-programming</span>
                    </div>
                    <span className="font-code-md text-xs text-secondary bg-secondary/10 px-2 py-0.5 rounded">3 Active</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center font-code-md text-xs">
                    <div className="p-3 rounded bg-surface-container-low border border-primary/30 flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold">
                        A
                      </div>
                      <span className="text-on-surface text-[11px]">Alex (Speaking)</span>
                    </div>
                    <div className="p-3 rounded bg-surface-container-low border border-outline-variant/30 flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold">
                        M
                      </div>
                      <span className="text-on-surface text-[11px]">Maya</span>
                    </div>
                    <div className="p-3 rounded bg-surface-container-low border border-outline-variant/30 flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center font-bold">
                        D
                      </div>
                      <span className="text-on-surface text-[11px]">David</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Feature Grid Section */}
        <section id="features" className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16">
          <div className="flex flex-col items-center text-center gap-4 mb-14">
            <span className="font-label-caps text-xs text-secondary uppercase tracking-widest font-semibold">
              Engineered Capabilities
            </span>
            <h2 className="font-headline-md text-headline-md sm:text-4xl font-bold text-on-surface">
              Everything Needed for Async & Real-time Dev Teams
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="glass-panel p-6 rounded-xl border border-outline-variant/50 hover:border-primary/50 transition-all group flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                Client-Side Static Architecture
              </h3>
              <p className="font-body-sm text-on-surface-variant leading-relaxed">
                100% browser-driven dynamic application compiled with Next.js static export. Fast page loads with zero server startup delay.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-panel p-6 rounded-xl border border-outline-variant/50 hover:border-primary/50 transition-all group flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/20 text-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                Supabase Auth & Database
              </h3>
              <p className="font-body-sm text-on-surface-variant leading-relaxed">
                Secure credentials authentication, automated email verification, password recovery, and PostgreSQL row-level security policy integration.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-panel p-6 rounded-xl border border-outline-variant/50 hover:border-primary/50 transition-all group flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-tertiary/20 text-tertiary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Code className="w-5 h-5" />
              </div>
              <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                Native PWA & Offline Support
              </h3>
              <p className="font-body-sm text-on-surface-variant leading-relaxed">
                Install directly on iOS, Android, macOS, or Windows. Fully integrated Service Worker auto-refreshes and handles offline caching seamlessly.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="glass-panel p-6 rounded-xl border border-outline-variant/50 hover:border-primary/50 transition-all group flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                Cloudflare Edge Workers
              </h3>
              <p className="font-body-sm text-on-surface-variant leading-relaxed">
                High-speed microservices power Boardroom voting, developer API calls, and email dispatch directly at edge locations worldwide.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="glass-panel p-6 rounded-xl border border-outline-variant/50 hover:border-primary/50 transition-all group flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/20 text-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Terminal className="w-5 h-5" />
              </div>
              <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                Developer Dark Design System
              </h3>
              <p className="font-body-sm text-on-surface-variant leading-relaxed">
                Crafted with Material Design 3 Expressive Dark tokens, JetBrains Mono code typography, and glassmorphic surfaces for long coding sessions.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="glass-panel p-6 rounded-xl border border-outline-variant/50 hover:border-primary/50 transition-all group flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-tertiary/20 text-tertiary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                Custom Community Servers
              </h3>
              <p className="font-body-sm text-on-surface-variant leading-relaxed">
                Create multiple workspace communities, customize server icon themes, manage channels, roles, and invite links with ease.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="w-full max-w-4xl mx-auto px-4 sm:px-8 py-16">
          <div className="flex flex-col items-center text-center gap-3 mb-12">
            <span className="font-label-caps text-xs text-primary uppercase tracking-widest font-semibold">
              Frequently Asked Questions
            </span>
            <h2 className="font-headline-md text-headline-md sm:text-3xl font-bold text-on-surface">
              Got Questions? We&apos;ve Got Answers.
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {[
              {
                q: "Is Omix Community free to use?",
                a: "Yes! Omix Community is open-source software. You can sign up for free, join developer servers, participate in Boardroom RFCs, and install the PWA instantly.",
              },
              {
                q: "How does the Boardroom differ from normal chat channels?",
                a: "Chat channels are designed for high-velocity real-time conversation. The Boardroom is a structured forum format where posts remain searchable, categorized, and upvoted by community members to ensure decisions aren't buried.",
              },
              {
                q: "Can I install Omix as a desktop or mobile application?",
                a: "Absolutely. Omix is built as a Progressive Web App (PWA). Simply tap 'Add to Home Screen' on iOS or Android, or click the Install button in your desktop browser address bar.",
              },
              {
                q: "How does GitHub integration work?",
                a: "When you authenticate via GitHub or connect GitHub in your profile settings, Omix automatically displays your public repositories, star counts, primary languages, and follower stats.",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="glass-panel rounded-xl border border-outline-variant/50 overflow-hidden transition-all"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-5 text-left font-headline-sm text-base font-bold text-on-surface flex justify-between items-center gap-4 hover:bg-surface-container-high/40 transition-colors"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-primary transition-transform duration-200 shrink-0 ${
                      openFaq === idx ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 pt-1 font-body-md text-sm text-on-surface-variant border-t border-outline-variant/30 leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Bottom Hero CTA */}
        <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-20">
          <div className="relative rounded-3xl p-8 sm:p-14 bg-gradient-to-br from-surface-container-low via-surface-container to-surface-container-high border border-outline-variant/60 overflow-hidden flex flex-col items-center text-center gap-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-secondary/20 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-12 h-12 rounded-2xl bg-primary-container text-on-primary-container flex items-center justify-center font-bold shadow-lg">
              <Sparkles className="w-6 h-6" />
            </div>

            <h2 className="font-display-lg text- display-lg sm:text-4xl font-black text-on-surface max-w-2xl leading-tight">
              Ready to Upgrade Your Developer Team Communication?
            </h2>

            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
              Join developers building the future of software. Zero friction, instant access, and full PWA offline capability.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
              <button
                onClick={onGetStarted}
                className="bg-primary text-on-primary px-8 py-4 rounded-lg font-label-caps text-sm font-bold hover:bg-primary-container transition-all shadow-[0_0_30px_rgba(208,188,255,0.4)] flex items-center gap-2 text-sm active:scale-95"
              >
                Create Account Free
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleGithub}
                disabled={githubBusy}
                className="glass-panel text-on-surface px-6 py-4 rounded-lg font-label-caps text-sm hover:bg-surface-container-highest transition-all flex items-center gap-2 border border-outline-variant/60 text-sm"
              >
                <Github className="w-5 h-5" />
                Sign in with GitHub
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container-lowest border-t border-outline-variant/40 py-12 px-4 sm:px-8 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo-192.png" alt="Omix Logo" className="w-7 h-7 object-contain" />
            <span className="font-headline-sm text-sm font-bold text-on-surface">
              Omix Community
            </span>
            <span className="text-xs text-on-surface-variant font-code-md">
              © {new Date().getFullYear()} Omix Systems
            </span>
          </div>

          <div className="flex items-center gap-6 font-label-caps text-xs text-on-surface-variant">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              All Systems Operational
            </span>
            <a
              href="mailto:support@omix.dev"
              className="hover:text-primary transition-colors"
            >
              Support
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors flex items-center gap-1"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
