// Import the functions you need from the SDKs you need
// We use the 'compat' libraries to allow v8-style syntax (firebase.initializeApp, db.collection)
// on the modern v9+ SDK provided by the CDN.
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCPOpbMFudxzh39jrwJ5ATtYNpGiH5Oqkk",
  authDomain: "labman-e07d2.firebaseapp.com",
  projectId: "labman-e07d2",
  storageBucket: "labman-e07d2.firebasestorage.app",
  messagingSenderId: "843086697564",
  appId: "1:843086697564:web:c4549ab625e350d6538299",
  measurementId: "G-86EX8W8S4M"
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

// Disable offline persistence to prevent internal assertion errors
// Disable offline persistence to prevent internal assertion errors
try {
  db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    ignoreUndefinedProperties: true
  });
} catch (error) {
  // Ignore error if settings already applied (common in HMR)
  console.log("Firestore settings already applied");
}

// Network toggle removed to ensure stable auth persistence

export default app;