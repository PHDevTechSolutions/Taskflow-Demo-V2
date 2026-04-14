// /lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCNonSOohWCFdgL052XUFFZTH1orbP2dH4",
  authDomain: "taskflow-4605f.firebaseapp.com",
  projectId: "taskflow-4605f",
  storageBucket: "taskflow-4605f.firebasestorage.app",
  messagingSenderId: "558742255762",
  appId: "1:558742255762:web:5725b5c26f1c6fae9e8e4b",
  measurementId: "G-9J1LXQ8YZC",
};

const firebaseConfigCollab = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY_COLLAB,

  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_COLLAB,

  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID_COLLAB,

  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_COLLAB,

  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_COLLAB,

  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID_COLLAB,

  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID_COLLAB,
};

// Initialize Firebase only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize second Firebase app for collaboration (using different config)
const collabApp = !getApps().some(a => a.name === "collab")
  ? initializeApp(firebaseConfigCollab, "collab")
  : getApps().find(a => a.name === "collab") || app;

// Export Firestore DB instances
export const db = getFirestore(app);
export const dbCollab = getFirestore(collabApp);
