import firebase from 'firebase/app';
import 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBt4YPsCAXOAr8a8SHDf-Do1eFCO5DelGU",
  authDomain: "omix-systems-cd1af.firebaseapp.com",
  projectId: "omix-systems-cd1af",
  storageBucket: "omix-systems-cd1af.firebasestorage.app",
  messagingSenderId: "458479471215",
  appId: "1:458479471215:web:1cda4dbc94ce069aff5b9a",
  measurementId: "G-D2FGF4ZLTD"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const db = firebase.firestore();

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

export { firebase };