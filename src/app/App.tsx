"use client";

import { useEffect } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmModal";
import { PWABanner } from "@/components/ui/PWABanner";
import { AuthScreen } from "@/features/auth/AuthScreen";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { Store } from "@/lib/store";

function AppInner() {
  const { user, loading } = useAuth();

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
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-deeper)]">
        <div
          className="w-10 h-10 rounded-full"
          style={{
            border: "2px solid var(--color-pri)",
            borderTopColor: "transparent",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
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
