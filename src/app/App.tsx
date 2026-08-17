"use client";

import { useEffect, useState } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmModal";
import { PWABanner } from "@/components/ui/PWABanner";
import { PWAInstallButton } from "@/components/ui/PWAInstallButton";
import { LandingPage } from "@/features/landing/LandingPage";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { ForgotPasswordScreen } from "@/features/auth/ForgotPasswordScreen";
import { VerifyEmailScreen } from "@/features/auth/VerifyEmailScreen";
import { VerificationSuccessScreen } from "@/features/auth/VerificationSuccessScreen";
import { SetNewPasswordScreen } from "@/features/auth/SetNewPasswordScreen";
import { ExperienceOnboarding } from "@/features/onboarding/ExperienceOnboarding";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Store } from "@/lib/store";
import { getExperiencePreferences } from "@/lib/experience";

type PublicFlow = "landing" | "signin" | "signup" | "forgot" | "verify";

interface AuthLink {
  token: string;
  type: "verify" | "recovery" | "reset";
}

function detectAuthLink(): AuthLink | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const type = params.get("type");
  if (token && (type === "verify" || type === "recovery" || type === "reset"))
    return { token, type };
  return null;
}

function clearAuthLinkParams() {
  try {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    window.history.replaceState({}, document.title, url.toString());
  } catch {
    /* ignore */
  }
}

function LoadingScreen() {
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

function AppInner() {
  const { user, loading, signInWithGithub } = useAuth();
  const [flow, setFlow] = useState<PublicFlow>("landing");
  const [verifyEmail, setVerifyEmail] = useState("");
  const [authLink, setAuthLink] = useState<AuthLink | null>(detectAuthLink);
  const [verifyDone, setVerifyDone] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [experienceReady, setExperienceReady] = useState(false);
  const [needsExperienceOnboarding, setNeedsExperienceOnboarding] = useState(false);

  useEffect(() => {
    if (!user) {
      setExperienceReady(false);
      setNeedsExperienceOnboarding(false);
      return;
    }
    const preferences = getExperiencePreferences(user.uid);
    setNeedsExperienceOnboarding(!preferences);
    setExperienceReady(true);
  }, [user]);

  useEffect(() => {
    if (authLink?.type !== "verify" || verifyDone) return;
    api.auth
      .verifyEmail(authLink.token)
      .then(() => setVerifyDone(true))
      .catch(() => setVerifyError("This verification link is invalid or has expired."));
  }, [authLink, verifyDone]);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      Store.requestNotificationPermission();
    }, 5000);
    return () => clearTimeout(timer);
  }, [user]);

  if (loading) return <LoadingScreen />;

  if (authLink?.type === "recovery" || authLink?.type === "reset") {
    return (
      <SetNewPasswordScreen
        token={authLink.token}
        onDone={() => {
          setAuthLink(null);
          clearAuthLinkParams();
          setFlow("signin");
        }}
      />
    );
  }

  if (authLink?.type === "verify") {
    if (verifyError) {
      return (
        <VerifyEmailScreen
          email={verifyEmail || ""}
          error={verifyError}
          onChangeEmail={() => {
            setAuthLink(null);
            clearAuthLinkParams();
            setFlow("signup");
          }}
        />
      );
    }
    if (!verifyDone) return <LoadingScreen />;
    return (
      <VerificationSuccessScreen
        onLaunch={() => {
          setAuthLink(null);
          clearAuthLinkParams();
          setFlow("signin");
        }}
      />
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
          <>
            <LandingPage
              onGetStarted={() => setFlow("signup")}
              onGithub={() => signInWithGithub().catch(() => {})}
            />
            <div className="fixed bottom-4 right-4 z-50">
              <PWAInstallButton />
            </div>
          </>
        );
    }
  }

  if (!experienceReady) return <LoadingScreen />;

  if (needsExperienceOnboarding) {
    return (
      <ExperienceOnboarding
        uid={user.uid}
        displayName={user.displayName || "User"}
        onComplete={() => {
          setNeedsExperienceOnboarding(false);
        }}
      />
    );
  }

  return (
    <>
      <AppLayout />
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 md:bottom-5 md:right-5 z-[90]">
        <PWAInstallButton />
      </div>
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
