import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { auth, db, firebase } from '../utils/firebase';
import { biometricAuth } from '../utils/biometricAuth';

interface AuthUser {
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
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  setAdminUser: (uid: string) => Promise<void>;
  removeAdminUser: (uid: string) => Promise<void>;
  // Biometric/Passkey methods
  signInWithPasskey: (email: string) => Promise<void>;
  registerPasskey: (email: string, displayName: string) => Promise<void>;
  hasPasskey: (email: string) => Promise<boolean>;
  isBiometricAvailable: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (firebaseUser: firebase.User | null) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        });
        // Check admin status from Firestore
        try {
          const doc = await db.collection('config').doc('settings').get();
          const data = doc.data();
          const adminUid = data?.adminUid;
          const adminEmail = data?.adminEmail;
          setIsAdmin(
            firebaseUser.uid === adminUid ||
            firebaseUser.email === adminEmail
          );
        } catch {
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async (email: string, password: string) => {
    await auth.signInWithEmailAndPassword(email, password);
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    if (cred.user) {
      await cred.user.updateProfile({ displayName });
      // Create profile in Firestore
      await db.collection('profiles').doc(cred.user.uid).set({
        name: displayName,
        email: email,
        avatar: '',
        color: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        uid: cred.user.uid,
      });
      // Auto-set first user as admin
      const settingsRef = db.collection('config').doc('settings');
      const settingsSnap = await settingsRef.get();
      if (settingsSnap.exists) {
        const data = settingsSnap.data();
        if (!data?.adminUid && !data?.adminEmail) {
          await settingsRef.set({
            adminUid: cred.user.uid,
            adminEmail: email,
            adminPassword: data?.adminPassword || '',
          }, { merge: true });
        }
      } else {
        // First-ever user is admin
        await settingsRef.set({
          adminUid: cred.user.uid,
          adminEmail: email,
          adminPassword: '',
        });
        setIsAdmin(true);
      }
    }
  };

  const setAdminUser = async (uid: string) => {
    const settingsRef = db.collection('config').doc('settings');
    await settingsRef.set({ adminUid: uid }, { merge: true });
    if (user?.uid === uid) setIsAdmin(true);
  };

  const removeAdminUser = async (uid: string) => {
    const settingsRef = db.collection('config').doc('settings');
    // Only clear if it matches this uid
    const snap = await settingsRef.get();
    const data = snap.data();
    if (data?.adminUid === uid) {
      await settingsRef.update({ adminUid: firebase.firestore.FieldValue.delete() });
      if (user?.uid === uid) setIsAdmin(false);
    }
  };

  const signOut = async () => {
    await auth.signOut();
  };

  const signInWithPasskey = async (email: string) => {
    await biometricAuth.authenticateWithPasskey(email);
    // After successful biometric auth, we need to sign in with Firebase
    // This requires a custom token or we use the email to sign in
    // For now, we'll use the email to get a custom token from a Cloud Function
    // Or we can use email link sign-in
    // For simplicity, we'll use signInWithEmailLink for passkey users
    const actionCodeSettings = {
      url: window.location.href,
      handleCodeInApp: true,
    };
    await auth.sendSignInLinkToEmail(email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
  };

  const registerPasskey = async (email: string, displayName: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('User not authenticated');
    
    // Use the user's UID for the passkey
    await biometricAuth.registerPasskey({
      email,
      displayName,
      userId: currentUser.uid,
    });
  };

  const hasPasskey = async (email: string): Promise<boolean> => {
    return biometricAuth.hasRegisteredPasskey(email);
  };

  const isBiometricAvailable = async (): Promise<boolean> => {
    return biometricAuth.isBiometricAvailable();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isAdmin, 
      signIn, 
      signUp, 
      signOut, 
      setAdminUser, 
      removeAdminUser,
      signInWithPasskey,
      registerPasskey,
      hasPasskey,
      isBiometricAvailable,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
