"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Github, Google } from "@/components/ui/icons";
import { Mso } from "@/components/ui/icons";

interface AuthScreenProps {
  mode?: "signin" | "signup";
  onBackToHome?: () => void;
  onForgotPassword?: () => void;
  onVerifyPending?: (email: string) => void;
}

export function AuthScreen({
  mode: initialMode = "signin",
  onBackToHome,
  onForgotPassword,
  onVerifyPending,
}: AuthScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<"google" | "github" | null>(null);

  const { signIn, signUp, signInWithGoogle, signInWithGithub } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
      } else {
        if (!displayName.trim()) {
          setError("Please enter a display name");
          setSubmitting(false);
          return;
        }
        const { needsVerification } = await signUp(
          email.trim(),
          password,
          displayName.trim()
        );
        if (needsVerification && onVerifyPending) {
          onVerifyPending(email.trim());
          setSubmitting(false);
          return;
        }
      }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      const msg = e.message?.toLowerCase() || "";
      const code = e.code || "";
      if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
        setError("Invalid email or password");
      } else if (code === "user_already_exists") {
        setError("An account with this email already exists");
      } else if (code === "weak_password" || msg.includes("password should be at least")) {
        setError("Password must be at least 6 characters");
      } else if (code === "validation_failed" || msg.includes("invalid email")) {
        setError("Please enter a valid email address");
      } else if (msg.includes("email not confirmed") || code === "email_not_confirmed") {
        if (onVerifyPending) {
          onVerifyPending(email.trim());
          setSubmitting(false);
          return;
        }
        setError("Please verify your email before signing in");
      } else if (msg.includes("rate limit") || msg.includes("too many requests")) {
        setError("Too many attempts. Please wait a moment and try again.");
      } else {
        setError(e.message || "Something went wrong");
      }
    }
    setSubmitting(false);
  };

  const handleGoogle = async () => {
    setError("");
    setOauthBusy("google");
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Google sign-in failed");
      setOauthBusy(null);
    }
  };

  const handleGithub = async () => {
    setError("");
    setOauthBusy("github");
    try {
      await signInWithGithub();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "GitHub sign-in failed");
      setOauthBusy(null);
    }
  };

  return (
    <ErrorBoundary>
      <div
        className="min-h-screen flex flex-col bg-background text-on-background relative overflow-x-hidden selection:bg-primary-container selection:text-on-primary-container"
        role="main"
        aria-label="Authentication"
      >
        {/* Top Navbar for Auth Pages */}
        <header className="w-full z-20 backdrop-blur-md bg-background/80 border-b border-outline-variant/30 px-4 sm:px-6 lg:px-10 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <button
              onClick={onBackToHome}
              className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface font-body-sm transition-colors group"
            >
              <Mso
                name="arrow_back"
                size={18}
                className="group-hover:-translate-x-1 transition-transform"
              />
              <span>Back to Home</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-surface-container-high overflow-hidden flex items-center justify-center border border-outline-variant/40">
                <img src="/logo.jpg" alt="Omix Logo" className="w-full h-full object-cover" />
              </div>
              <span className="font-headline-sm text-headline-sm font-bold text-primary">
                Omix
              </span>
            </div>

            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError("");
              }}
              className="font-label-caps text-label-caps text-primary hover:text-primary-container transition-colors"
            >
              {mode === "signin" ? "Sign Up" : "Sign In"}
            </button>
          </div>
        </header>

        {/* Main Card View */}
        <div className="flex-1 flex items-center justify-center px-4 py-8 relative z-10">
          {/* Background Atmospheric Glows */}
          <div className="fixed top-[-20%] left-[-10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-primary-container/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-secondary-container/10 rounded-full blur-[100px] pointer-events-none" />

          <main className="w-full max-w-[460px] bg-surface-container/70 backdrop-blur-2xl border border-outline-variant/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 sm:p-8 flex flex-col items-center text-center border-b border-outline-variant/30">
              <h1 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight mb-1">
                {mode === "signin" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {mode === "signin"
                  ? "Sign in to access your workspaces and team chats."
                  : "Join the Omix ecosystem to collaborate with developers."}
              </p>
            </div>

            {/* Content */}
            <div className="p-6 sm:p-8 flex flex-col gap-5">
              {/* OAuth Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleGoogle}
                  disabled={oauthBusy !== null}
                  className="flex items-center justify-center gap-2.5 bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-caps text-label-caps py-3 px-4 rounded-xl border border-outline-variant transition-all disabled:opacity-60 shadow-sm"
                >
                  <Google size={18} />
                  <span>Google</span>
                </button>
                <button
                  onClick={handleGithub}
                  disabled={oauthBusy !== null}
                  className="flex items-center justify-center gap-2.5 bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-caps text-label-caps py-3 px-4 rounded-xl border border-outline-variant transition-all disabled:opacity-60 shadow-sm"
                >
                  <Github size={18} />
                  <span>GitHub</span>
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 my-1">
                <div className="flex-1 h-[1px] bg-outline-variant/40" />
                <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider text-[11px]">
                  Or continue with email
                </span>
                <div className="flex-1 h-[1px] bg-outline-variant/40" />
              </div>

              {/* Email form */}
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4"
                aria-label={mode === "signin" ? "Sign in form" : "Create account form"}
              >
                {mode === "signup" && (
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="auth-display-name"
                      className="font-body-sm text-body-sm text-on-surface font-medium"
                    >
                      Display Name
                    </label>
                    <input
                      id="auth-display-name"
                      type="text"
                      placeholder="Jane Doe"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-3 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      autoComplete="name"
                      required
                      aria-label="Display name"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="auth-email"
                    className="font-body-sm text-body-sm text-on-surface font-medium"
                  >
                    Email Address
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-3 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    autoComplete="email"
                    required
                    aria-label="Email address"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="auth-password"
                      className="font-body-sm text-body-sm text-on-surface font-medium"
                    >
                      Password
                    </label>
                    {mode === "signin" && onForgotPassword && (
                      <button
                        type="button"
                        onClick={onForgotPassword}
                        className="font-body-sm text-body-sm text-primary hover:text-primary-container transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-3 pr-12 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      required
                      aria-label="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1 rounded-lg transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <Mso name={showPassword ? "visibility_off" : "visibility"} size={20} />
                    </button>
                  </div>
                </div>

                {error && (
                  <p
                    className="text-sm text-[var(--color-dnd)] bg-surface-container rounded-lg px-4 py-2.5 border border-outline-variant/60"
                    role="alert"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 bg-primary text-on-primary font-label-caps text-label-caps py-3.5 rounded-xl hover:bg-primary-container transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50"
                  aria-busy={submitting}
                >
                  {submitting
                    ? "Please wait…"
                    : mode === "signin"
                      ? "Sign In"
                      : "Create Account"}
                </button>
              </form>
            </div>

            {/* Footer link */}
            <div className="p-4 bg-surface-container-lowest/80 border-t border-outline-variant/30 text-center">
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  onClick={() => {
                    setMode(mode === "signin" ? "signup" : "signin");
                    setError("");
                  }}
                  className="text-primary hover:text-primary-container font-medium hover:underline transition-colors ml-1"
                >
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </button>
              </p>
            </div>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
