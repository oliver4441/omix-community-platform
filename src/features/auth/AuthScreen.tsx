"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Github } from "@/components/ui/icons";
import { Mso } from "@/components/ui/icons";

export function AuthScreen({
  mode: initialMode = "signin",
  onForgotPassword,
  onVerifyPending,
}: {
  mode?: "signin" | "signup";
  onForgotPassword?: () => void;
  onVerifyPending?: (email: string) => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [githubBusy, setGithubBusy] = useState(false);
  const { signIn, signUp, signInWithGithub } = useAuth();

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
      } else if (code === "email_taken" || code === "user_already_exists") {
        setError("An account with this email already exists");
      } else if (
        code === "password_too_short" ||
        code === "weak_password" ||
        msg.includes("password should be at least")
      ) {
        setError("Password must be at least 6 characters");
      } else if (code === "invalid_email" || code === "validation_failed" || msg.includes("invalid email")) {
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

  const handleGithub = async () => {
    setError("");
    setGithubBusy(true);
    try {
      await signInWithGithub();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(
        e.message || "GitHub sign-in unavailable — GitHub OAuth is not configured on the backend (see docs/DEPLOY.md)"
      );
      setGithubBusy(false);
    }
  };

  return (
    <ErrorBoundary>
      <div
        className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10 relative overflow-hidden"
        role="main"
        aria-label="Authentication"
      >
        {/* Atmospheric background gradients */}
        <div className="fixed top-[-20%] left-[-10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-primary-container/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-secondary-container/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Main card (glassmorphic) */}
        <main className="w-full max-w-[440px] z-10 bg-surface-container/60 backdrop-blur-xl border border-outline-variant/50 rounded-xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-6 md:p-8 flex flex-col items-center text-center border-b border-outline-variant/30">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-container-high flex items-center justify-center">
                <img src="/logo.jpg" alt="" className="w-full h-full object-cover" />
              </div>
              <h1 className="font-headline-md text-headline-md text-primary font-bold tracking-tight">
                Omix Community
              </h1>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {mode === "signin"
                ? "Welcome back. Sign in to your workspace."
                : "Create an account to join the workspace."}
            </p>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 flex flex-col gap-6">
            {/* GitHub auth */}
            <button
              onClick={handleGithub}
              disabled={githubBusy}
              className="w-full flex items-center justify-center gap-2 bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-caps text-label-caps p-4 rounded-lg border border-outline-variant transition-colors disabled:opacity-60"
            >
              <Github size={20} />
              {githubBusy ? "Redirecting…" : "Continue with GitHub"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-[1px] bg-outline-variant/50" />
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider text-[10px]">
                Or
              </span>
              <div className="flex-1 h-[1px] bg-outline-variant/50" />
            </div>

            {/* Email form */}
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
              aria-label={mode === "signin" ? "Sign in form" : "Create account form"}
            >
              {mode === "signup" && (
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="auth-display-name"
                    className="font-body-sm text-body-sm text-on-surface"
                  >
                    Display Name
                  </label>
                  <input
                    id="auth-display-name"
                    type="text"
                    placeholder="Jane Doe"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-3 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    autoComplete="name"
                    required
                    aria-label="Display name"
                  />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="auth-email"
                  className="font-body-sm text-body-sm text-on-surface"
                >
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-3 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  autoComplete="email"
                  required
                  aria-label="Email address"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="auth-password"
                    className="font-body-sm text-body-sm text-on-surface"
                  >
                    Password
                  </label>
                  {mode === "signin" && onForgotPassword && (
                    <button
                      type="button"
                      onClick={onForgotPassword}
                      className="font-body-sm text-body-sm text-primary hover:text-primary-fixed-dim transition-colors"
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
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-3 pr-12 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    required
                    aria-label="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1 rounded transition-colors"
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
                className="w-full mt-1 bg-primary text-on-primary font-label-caps text-label-caps p-4 rounded-lg hover:bg-primary-fixed-dim transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50"
                aria-busy={submitting}
              >
                {submitting
                  ? "Please wait…"
                  : mode === "signin"
                    ? "Sign In"
                    : "Sign up with Email"}
              </button>
            </form>
          </div>

          {/* Footer link */}
          <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/30 text-center">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError("");
                }}
                className="text-primary hover:text-primary-fixed-dim font-medium hover:underline transition-colors ml-1"
              >
                {mode === "signin" ? "Create one" : "Log in"}
              </button>
            </p>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
