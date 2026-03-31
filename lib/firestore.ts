// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD4J4FTeUqusdDxIN0dpii3pwCbugkuxkg",
  authDomain: "erplogs.firebaseapp.com",
  projectId: "erplogs",
  storageBucket: "erplogs.firebasestorage.app",
  messagingSenderId: "900828263",
  appId: "1:900828263:web:15bd782f8f4db47f7858c2",
  measurementId: "G-DF92VBT73V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);