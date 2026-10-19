// Firebase init for Before MNAI — web config is public-by-design.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD08WBQ9C8Tlq6ItdAEydjlTij7XHO345o",
  authDomain: "notfelixx-b7d92.firebaseapp.com",
  projectId: "notfelixx-b7d92",
  storageBucket: "notfelixx-b7d92.firebasestorage.app",
  messagingSenderId: "727013905433",
  appId: "1:727013905433:web:7b55f69af54f43eaef0688",
  measurementId: "G-WBH0GL2KN1"
};

export const fbApp = initializeApp(firebaseConfig);
export const auth = getAuth(fbApp);
export const db = getFirestore(fbApp);
export const googleProvider = new GoogleAuthProvider();
