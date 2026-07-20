import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import 'firebase/storage';
import 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyAs7C-OegYfoPxj8LOYNagZgcMi9yo45Zg",
  authDomain: "omix-systems-cd1af.firebaseapp.com",
  projectId: "omix-systems-cd1af",
  storageBucket: "omix-systems-cd1af.firebasestorage.app",
  messagingSenderId: "458479471215",
  appId: "1:458479471215:web:c0210748800fdf51ff5b9a",
  measurementId: "G-D2FGF4ZLTD"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const db = firebase.firestore();
export const auth = firebase.auth();
export const storage = firebase.storage();
export const messaging = firebase.messaging.isSupported() ? firebase.messaging() : null;
export { firebase };

// Enable offline persistence
(async () => {
  try {
    await db.enablePersistence({ synchronizeTabs: true });
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'failed-precondition') {
      console.warn('Persistence failed: multiple tabs open');
    } else if (error.code === 'unimplemented') {
      console.warn('Persistence not supported');
    }
  }
})();
