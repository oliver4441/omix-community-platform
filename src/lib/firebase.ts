import firebase from "firebase/app";
import "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAs7C-OegYfoPxj8LOYNagZgcMi9yo45Zg",
  authDomain: "omix-systems-cd1af.firebaseapp.com",
  databaseURL: "https://omix-systems-cd1af-default-rtdb.firebaseio.com",
  projectId: "omix-systems-cd1af",
  storageBucket: "omix-systems-cd1af.firebasestorage.app",
  messagingSenderId: "458479471215",
  appId: "1:458479471215:web:c0210748800fdf51ff5b9a",
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();
export const googleProvider = new firebase.auth.GoogleAuthProvider();
export const githubProvider = new firebase.auth.GithubAuthProvider();
githubProvider.addScope("read:user");
githubProvider.addScope("user:email");

export default firebase;
