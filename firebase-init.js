// Firebase Initialization
var firebaseConfig = {
  apiKey: "AIzaSyBt4YPsCAXOAr8a8SHDf-Do1eFCO5DelGU",
  authDomain: "omix-systems-cd1af.firebaseapp.com",
  projectId: "omix-systems-cd1af",
  storageBucket: "omix-systems-cd1af.firebasestorage.app",
  messagingSenderId: "458479471215",
  appId: "1:458479471215:web:1cda4dbc94ce069aff5b9a",
  measurementId: "G-D2FGF4ZLTD"
};

firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();
window.db = db;

// Enable offline persistence
db.enablePersistence({synchronizeTabs: true}).catch(function(err) {
  if (err.code === 'failed-precondition') {
    console.warn('Persistence failed: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Persistence not supported');
  }
});
