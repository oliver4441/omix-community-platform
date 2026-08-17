import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAs7C-OegYfoPxj8LOYNagZgcMi9yo45Zg",
  authDomain: "omix-systems-cd1af.firebaseapp.com",
  databaseURL: "https://omix-systems-cd1af-default-rtdb.firebaseio.com",
  projectId: "omix-systems-cd1af",
  storageBucket: "omix-systems-cd1af.firebasestorage.app",
  messagingSenderId: "458479471215",
  appId: "1:458479471215:web:c0210748800fdf51ff5b9a",
};

// Prevent duplicate initialization during HMR / re-renders
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export const githubProvider = new GithubAuthProvider();
githubProvider.addScope("read:user");
githubProvider.addScope("user:email");

export {
  signInWithPopup,
  signInWithRedirect,
  firebaseSignOut,
  onAuthStateChanged,
  type FirebaseUser,
};
