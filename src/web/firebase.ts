import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA8xVooxomWg0EJbAfCkmNSa8p_OUpdNNs",
  authDomain: "uangkas-3f5c5.firebaseapp.com",
  projectId: "uangkas-3f5c5",
  storageBucket: "uangkas-3f5c5.firebasestorage.app",
  messagingSenderId: "457657055941",
  appId: "1:457657055941:web:6200df0e04d57043a6ceac",
};

// Primary app — used for the current user's session
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Secondary app — used ONLY by admin to create new user accounts
// without logging out the current admin session
const secondaryApp = initializeApp(firebaseConfig, "secondary");
export const secondaryAuth = getAuth(secondaryApp);
