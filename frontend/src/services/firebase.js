// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, browserPopupRedirectResolver, GoogleAuthProvider } from "firebase/auth";
import { _getInstance } from "@firebase/auth/internal";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB9g1X-PTEoO7B-U8wT7Vltthr2UKbQPYE",
  authDomain: "carpetazo-db9d7.firebaseapp.com",
  projectId: "carpetazo-db9d7",
  storageBucket: "carpetazo-db9d7.firebasestorage.app",
  messagingSenderId: "276744200057",
  appId: "1:276744200057:web:f51adf5e81b88d71e059a8",
  measurementId: "G-RTX48JMXHH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Igual que getAuth(), pero sin precargar en cada página el iframe de "Continuar con Google" (~130 kB y retrasa el primer dibujo en móvil)
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
});

// Prepara la ventana de Google ANTES del toque (al abrir "Entrar" o con sesión iniciada): es la misma instancia que usa
// signInWithPopup, así al tocar el botón la ventana se abre al instante, como antes (Safari en iPhone bloquea las que tardan)
let googleWarmUp = null;
export const warmUpGoogleSignIn = () => {
  if (!googleWarmUp) googleWarmUp = _getInstance(browserPopupRedirectResolver)._initialize(auth).catch(() => { googleWarmUp = null; });
  return googleWarmUp;
};
export const googleProvider = new GoogleAuthProvider();

export default app;
