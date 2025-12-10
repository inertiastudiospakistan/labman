// Import the functions you need from the SDKs you need
// We use the 'compat' libraries to allow v8-style syntax (firebase.initializeApp, db.collection)
// on the modern v9+ SDK provided by the CDN.
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCxUiyusobT7AHBnBp81ui0b6jptWXZZ2U",
  authDomain: "st22-f2f0e.firebaseapp.com",
  projectId: "st22-f2f0e",
  storageBucket: "st22-f2f0e.firebasestorage.app",
  messagingSenderId: "859513780268",
  appId: "1:859513780268:web:b73d97b63d72710435b989",
  measurementId: "G-GG0MH3BS9D"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const app = firebase.app();

// Initialize Analytics (optional/safe check)
if (typeof window !== 'undefined') {
  try {
    firebase.analytics();
  } catch (e) {
    console.warn("Firebase Analytics not supported in this environment");
  }
}

// Initialize Services
export const db = firebase.firestore();
export const auth = firebase.auth();
export default app;