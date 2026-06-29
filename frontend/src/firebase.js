// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB9g1X-PTEoO7B-U8wT7Vltthr2UKbQPYE",
  authDomain: "carpetazo.cl",
  projectId: "carpetazo-db9d7",
  storageBucket: "carpetazo-db9d7.firebasestorage.app",
  messagingSenderId: "276744200057",
  appId: "1:276744200057:web:f51adf5e81b88d71e059a8",
  measurementId: "G-RTX48JMXHH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;
