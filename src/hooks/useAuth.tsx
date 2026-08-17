"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api, getToken, setToken, setUserId } from "@/lib/api";
import { exchangeFirebaseToken } from "@/lib/firebaseSession";
import { auth, googleProvider, githubProvider, default as firebase } from "@/lib/firebase";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsVerification: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  updatePassword: (token: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

function mapUser(u: firebase.User): AuthUser {
  return {
    uid: u.uid,
    email: u.email || null,
    displayName: u.displayName || u.email?.split("@")[0] || "User",
    photoURL: u.photoURL || null,
  };
}

async function syncFirebaseUser(fbUser: firebase.User): Promise<AuthUser> {
  const mapped = mapUser(fbUser);
  const idToken = await fbUser.getIdToken();
  const session = await exchangeFirebaseToken(idToken, mapped);
  setUserId(session.user.id);
  return mapped;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const refreshAdmin = useCallback(async (uid: string, email: string | null) => {
    try {
      const cfg = await api.getConfigSettings();
      setIsAdmin(uid === cfg.adminUid || email === cfg.adminEmail);
    } catch {
      setIsAdmin(false);
    }
  }, []);

  const acceptFirebaseUser = useCallback(async (fbUser: firebase.User) => {
    const mapped = await syncFirebaseUser(fbUser);
    setUser(mapped);
    await refreshAdmin(mapped.uid, mapped.email);
  }, [refreshAdmin]);

  useEffect(() => {
    let active = true;
    const unsubscribe = auth.onAuthStateChanged(async (fbUser) => {
      if (!active) return;
      try {
        if (fbUser) {
          await acceptFirebaseUser(fbUser);
        } else {
          setToken(null);
          setUserId(null);
          setUser(null);
          setIsAdmin(false);
        }
      } catch {
        setToken(null);
        setUserId(null);
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [acceptFirebaseUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await auth.signInWithEmailAndPassword(email, password);
    if (!result.user) throw new Error("Firebase did not return a user");
    await acceptFirebaseUser(result.user);
  }, [acceptFirebaseUser]);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    if (!result.user) throw new Error("Firebase did not create a user");
    await result.user.updateProfile({ displayName });
    try {
      await result.user.sendEmailVerification();
    } catch {
      // Account creation should not fail solely because verification mail is unavailable.
    }
    await acceptFirebaseUser(result.user);
    return { needsVerification: false };
  }, [acceptFirebaseUser]);

  const signInWithGoogle = useCallback(async () => {
    try {
      const result = await auth.signInWithPopup(googleProvider);
      if (!result.user) throw new Error("Google did not return a user");
      await acceptFirebaseUser(result.user);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === "auth/popup-blocked") throw new Error("Your browser blocked the Google sign-in popup. Allow popups and try again.");
      if (error.code === "auth/popup-closed-by-user") throw new Error("Google sign-in was cancelled.");
      if (error.code === "auth/account-exists-with-different-credential") throw new Error("An account already exists with this email using another sign-in method.");
      throw new Error(error.message || "Google sign-in failed");
    }
  }, [acceptFirebaseUser]);

  const signInWithGithub = useCallback(async () => {
    try {
      const result = await auth.signInWithPopup(githubProvider);
      if (!result.user) throw new Error("GitHub did not return a user");
      await acceptFirebaseUser(result.user);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === "auth/popup-blocked") throw new Error("Your browser blocked the GitHub sign-in popup. Allow popups and try again.");
      if (error.code === "auth/popup-closed-by-user") throw new Error("GitHub sign-in was cancelled.");
      if (error.code === "auth/account-exists-with-different-credential") throw new Error("An account already exists with this email using another sign-in method.");
      throw new Error(error.message || "GitHub sign-in failed");
    }
  }, [acceptFirebaseUser]);

  const resetPassword = useCallback(async (email: string) => {
    await auth.sendPasswordResetEmail(email);
  }, []);

  const resendVerification = useCallback(async (_email: string) => {
    const current = auth.currentUser;
    if (!current) throw new Error("Please sign in again before requesting another verification email.");
    await current.sendEmailVerification();
  }, []);

  const updatePassword = useCallback(async (_token: string, password: string) => {
    const current = auth.currentUser;
    if (!current) throw new Error("Your Firebase session has expired. Please sign in again.");
    await current.updatePassword(password);
  }, []);

  const signOut = useCallback(async () => {
    await auth.signOut();
    setToken(null);
    setUserId(null);
    setUser(null);
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signIn, signUp, signInWithGoogle, signInWithGithub, resetPassword, resendVerification, updatePassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
