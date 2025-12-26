// Firebase configuration and initialization
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAc8PLrGcP393YKXI93r_gsrvlDFBdP_Vk",
  authDomain: "ai-vision-studio-d5e83.firebaseapp.com",
  projectId: "ai-vision-studio-d5e83",
  storageBucket: "ai-vision-studio-d5e83.firebasestorage.app",
  messagingSenderId: "103275131328",
  appId: "1:103275131328:web:b2d1a3fc6e4b6a56a29825",
  measurementId: "G-CFFQ17T920"
};

// Initialize Firebase (prevent multiple initializations)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore
export const db = getFirestore(app);

export default app;
