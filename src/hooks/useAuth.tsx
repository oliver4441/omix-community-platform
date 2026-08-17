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
import {
  auth,
  googleProvider,
  githubProvider,
  signInWithPopup,
  firebaseSignOut,
  onAuthStateChanged,
  type FirebaseUser,
} from "@/lib/firebase";

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
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  updatePassword: (token: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

function mapApiUser(u: ApiAuthUser): AuthUser {
  return {
    uid: u.uid,
    email: u.email || null,
    displayName: u.fullName || null,
    photoURL: u.avatarUrl || null,
  };
}

function mapFirebaseUser(u: FirebaseUser): AuthUser {
  return {
    uid: u.uid,
    email: u.email || null,
    displayName: u.displayName || u.email?.split("@")[0] || "User",
    photoURL: u.photoURL || null,
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

    // Check if worker session exists in localStorage
    api.auth.consumeSessionFromUrl();

    const unsubscribeFirebase = onAuthStateChanged(auth, (fbUser) => {
      if (!active) return;
      if (fbUser) {
        const mapped = mapFirebaseUser(fbUser);
        setUserId(mapped.uid);
        setUser(mapped);
        refreshAdmin(mapped.uid, mapped.email);
        setLoading(false);
      } else {
        // Fallback to Worker API session if no Firebase user logged in
        if (!getToken()) {
          setUser(null);
          setLoading(false);
          return;
        }
        api.auth
          .me()
          .then(({ user: u }) => {
            if (!active) return;
            setUserId(u.uid);
            setUser(mapApiUser(u));
            refreshAdmin(u.uid, u.email || null);
          })
          .catch(() => {
            setToken(null);
            setUserId(null);
            if (active) setUser(null);
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      }
    });

    return () => {
      active = false;
      unsubscribeFirebase();
    };
  }, [refreshAdmin]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    setUserId(res.user.uid);
    setUser(mapApiUser(res.user));
    refreshAdmin(res.user.uid, res.user.email || null);
  }, [refreshAdmin]);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const res = await api.auth.signup(email, password, displayName);
      if (!res.needsVerification) {
        const { user: u } = await api.auth.login(email, password);
        setUserId(u.uid);
        setUser(mapApiUser(u));
        refreshAdmin(u.uid, u.email || null);
      }
      return { needsVerification: res.needsVerification };
    },
    [refreshAdmin]
  );

  const signInWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        const mapped = mapFirebaseUser(result.user);
        setUserId(mapped.uid);
        setUser(mapped);
        refreshAdmin(mapped.uid, mapped.email);
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === "auth/popup-closed-by-user") {
        throw new Error("Sign-in popup was closed before completing.");
      }
      if (error.code === "auth/account-exists-with-different-credential") {
        throw new Error("An account already exists with the same email using a different provider.");
      }
      throw new Error(error.message || "Google sign-in failed");
    }
  }, [refreshAdmin]);

  const signInWithGithub = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, githubProvider);
      if (result.user) {
        const mapped = mapFirebaseUser(result.user);
        setUserId(mapped.uid);
        setUser(mapped);
        refreshAdmin(mapped.uid, mapped.email);
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === "auth/popup-closed-by-user") {
        throw new Error("Sign-in popup was closed before completing.");
      }
      if (error.code === "auth/account-exists-with-different-credential") {
        throw new Error("An account already exists with the same email using a different provider.");
      }
      // Fallback to Worker API URL if available
      try {
        const url = api.auth.githubLoginUrl();
        if (url && !url.startsWith("/")) {
          window.location.href = url;
          return;
        }
      } catch {
        /* ignore */
      }
      throw new Error(error.message || "GitHub sign-in failed");
    }
  }, [refreshAdmin]);

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
    try {
      await firebaseSignOut(auth);
    } catch {
      /* ignore */
    }
    try {
      await api.auth.logout();
    } catch {
      /* ignore */
    }
    setToken(null);
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
        signInWithGoogle,
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
