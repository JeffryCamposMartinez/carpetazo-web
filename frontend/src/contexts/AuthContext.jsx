import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Iniciar sesión con Google
  function loginWithGoogle() {
    return signInWithPopup(auth, googleProvider);
  }

  // Cerrar sesión
  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    // Suscribirse a los cambios en el estado de autenticación
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(false);
      
      if (user) {
        import('firebase/firestore').then(({ doc, getDoc, setDoc }) => {
          const userRef = doc(db, 'users', user.uid);
          getDoc(userRef).then((docSnap) => {
            if (!docSnap.exists()) {
              const baseUsername = user.displayName ? user.displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : user.uid;
              setDoc(userRef, {
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                username: baseUsername,
                createdAt: new Date()
              }, { merge: true });
            } else if (!docSnap.data().username) {
              const baseUsername = user.displayName ? user.displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : user.uid;
              setDoc(userRef, {
                username: baseUsername
              }, { merge: true });
            }
          });
        });
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loginWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
