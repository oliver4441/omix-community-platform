"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api, getToken, setToken, setUserId, type AuthUser as ApiAuthUser } from "@/lib/api";

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
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ needsVerification: boolean }>;
  signInWithGithub: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  updatePassword: (token: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

function mapUser(u: ApiAuthUser): AuthUser {
  return {
    uid: u.uid,
    email: u.email || null,
    displayName: u.fullName || null,
    photoURL: u.avatarUrl || null,
  };
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

  useEffect(() => {
    let active = true;

    // GitHub OAuth returns as #session=... — store it before checking /me.
    api.auth.consumeSessionFromUrl();

    const hydrate = async () => {
      if (!getToken()) {
        if (active) setLoading(false);
        return;
      }
      try {
        const { user: u } = await api.auth.me();
        if (!active) return;
        setUserId(u.uid);
        setUser(mapUser(u));
        refreshAdmin(u.uid, u.email || null);
      } catch {
        // Expired/invalid session — clear it.
        setToken(null);
        setUserId(null);
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    hydrate();

    return () => {
      active = false;
    };
  }, [refreshAdmin]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    setUserId(res.user.uid);
    setUser(mapUser(res.user));
    refreshAdmin(res.user.uid, res.user.email || null);
  }, [refreshAdmin]);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const res = await api.auth.signup(email, password, displayName);
      // Verification is disabled, so the account is active immediately — sign in.
      if (!res.needsVerification) {
        const { user: u } = await api.auth.login(email, password);
        setUserId(u.uid);
        setUser(mapUser(u));
        refreshAdmin(u.uid, u.email || null);
      }
      return { needsVerification: res.needsVerification };
    },
    [refreshAdmin]
  );

  const signInWithGithub = useCallback(async () => {
    const url = api.auth.githubLoginUrl();
    if (!url || url.startsWith("/")) {
      throw new Error("GitHub sign-in is not configured yet");
    }
    window.location.href = url;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await api.auth.forgot(email);
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    await api.auth.resendVerification(email);
  }, []);

  const updatePassword = useCallback(async (token: string, password: string) => {
    await api.auth.resetPassword(token, password);
  }, []);

  const signOut = useCallback(async () => {
    await api.auth.logout();
    setUserId(null);
    setUser(null);
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        signIn,
        signUp,
        signInWithGithub,
        resetPassword,
        resendVerification,
        updatePassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
