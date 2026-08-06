"use client";

import { useEffect, useState } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmModal";
import { PWABanner } from "@/components/ui/PWABanner";
import { LandingPage } from "@/features/landing/LandingPage";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { ForgotPasswordScreen } from "@/features/auth/ForgotPasswordScreen";
import { VerifyEmailScreen } from "@/features/auth/VerifyEmailScreen";
import { VerificationSuccessScreen } from "@/features/auth/VerificationSuccessScreen";
import { SetNewPasswordScreen } from "@/features/auth/SetNewPasswordScreen";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { Store } from "@/lib/store";

type PublicFlow = "landing" | "signin" | "signup" | "forgot" | "verify";

/**
 * Inspect the current URL (hash for implicit flow, query for PKCE) to figure
 * out what kind of Supabase auth link the user arrived from.
 */
function detectAuthLink(): "verified" | "recovery" | null {
  if (typeof window === "undefined") return null;
  const url = `${window.location.hash} ${window.location.search}`;
  if (/type=recovery/.test(url) || /access_token=.*type=recovery/.test(url)) {
    return "recovery";
  }
  if (/access_token=|type=(signup|email|invite)/.test(url) || /code=/.test(url)) {
    return "verified";
  }
  return null;
}

function clearAuthLinkParams() {
  try {
    const url = new URL(window.location.href);
    url.hash = "";
    url.search = "";
    window.history.replaceState({}, document.title, url.toString());
  } catch {
    /* ignore */
  }
}

function AppInner() {
  const { user, loading, signInWithGithub } = useAuth();
  const [flow, setFlow] = useState<PublicFlow>("landing");
  const [verifyEmail, setVerifyEmail] = useState("");
  // What kind of Supabase email link (if any) the user arrived on.
  const [authLink, setAuthLink] = useState(detectAuthLink);

  // Request notification permission
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      Store.requestNotificationPermission();
    }, 5000);
    return () => clearTimeout(timer);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div
          className="w-10 h-10 rounded-full"
          style={{
            border: "2px solid var(--color-primary)",
            borderTopColor: "transparent",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  if (!user) {
    switch (flow) {
      case "forgot":
        return <ForgotPasswordScreen onBack={() => setFlow("signin")} />;
      case "verify":
        return (
          <VerifyEmailScreen
            email={verifyEmail}
            onChangeEmail={() => setFlow("signup")}
          />
        );
      case "signin":
      case "signup":
        return (
          <AuthScreen
            mode={flow}
            onForgotPassword={() => setFlow("forgot")}
            onVerifyPending={(email) => {
              setVerifyEmail(email);
              setFlow("verify");
            }}
          />
        );
      default:
        return (
          <LandingPage
            onGetStarted={() => setFlow("signup")}
            onGithub={() => signInWithGithub()}
          />
        );
    }
  }

  // Logged in via a password-recovery link: force a new password first.
  if (authLink === "recovery") {
    return (
      <SetNewPasswordScreen
        onDone={() => {
          setAuthLink(null);
          clearAuthLinkParams();
        }}
      />
    );
  }

  // Logged in: show the one-time verification-success interstitial if the user
  // just confirmed their email, then hand off to the workspace.
  if (authLink === "verified") {
    return (
      <VerificationSuccessScreen
        onLaunch={() => {
          setAuthLink(null);
          clearAuthLinkParams();
        }}
      />
    );
  }

  return (
    <>
      <AppLayout />
      <PWABanner />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <SWRegister />
          <AppInner />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

function SWRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      });
    }
  }, []);
  return null;
}
