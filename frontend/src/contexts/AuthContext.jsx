import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { api } from '../utils/api';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Iniciar sesiÃ³n con Google
  function loginWithGoogle() {
    return signInWithPopup(auth, googleProvider);
  }

  // Iniciar sesiÃ³n con Email y ContraseÃ±a
  async function loginWithEmail(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (!user.emailVerified) {
      // Reenviar la verificaciÃ³n automÃ¡ticamente si intenta ingresar y no estÃ¡ verificado
      await sendEmailVerification(user);
      await signOut(auth);
      throw new Error('auth/email-not-verified');
    }
    return user;
  }

  // Registrarse con Email y ContraseÃ±a
  async function registerWithEmail(email, password, displayName, username) {
    const formattedUsername = username.toLowerCase().trim();

    // 1. Validar que el username, displayName y email no estÃ©n tomados en Firestore
    const { collection, query, where, getDocs, doc, setDoc } = await import('firebase/firestore');
    const usersRef = collection(db, 'users');
    
    const [usernameSnap, displayNameSnap, emailSnap] = await Promise.all([
      getDocs(query(usersRef, where('username', '==', formattedUsername))),
      getDocs(query(usersRef, where('displayName', '==', displayName.trim()))),
      getDocs(query(usersRef, where('email', '==', email.toLowerCase().trim())))
    ]);

    if (!usernameSnap.empty) {
      throw new Error('auth/username-already-in-use');
    }
    if (!displayNameSnap.empty) {
      throw new Error('auth/displayname-already-in-use');
    }
    if (!emailSnap.empty) {
      throw new Error('auth/email-already-in-use');
    }

    // 2. Crear el usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 3. Actualizar perfil con el displayName
    await updateProfile(user, { displayName });

    // 4. Enviar correo de verificaciÃ³n
    await sendEmailVerification(user);

    // 5. Guardar en Firestore
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      displayName: displayName,
      email: email,
      photoURL: null,
      username: formattedUsername,
      createdAt: new Date()
    });

    // 6. Forzar cierre de sesiÃ³n inmediato
    await signOut(auth);
    return user;
  }

  // Restablecer contraseÃ±a
  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  // Obtener token JWT de Firebase
  async function getAuthToken() {
    return auth.currentUser ? await auth.currentUser.getIdToken(true) : null;
  }

  // Cerrar sesiÃ³n
  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    // Suscribirse a los cambios en el estado de autenticaciÃ³n
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Si el usuario estÃ¡ autenticado pero no verificado, y es login por contraseÃ±a
      if (user && !user.emailVerified && user.providerData.some(p => p.providerId === 'password')) {
        await signOut(auth);
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      setCurrentUser(user);
      setLoading(false);
      
      if (user) {
        // Sincronizar usuario con el backend PostgreSQL
        api.syncUser().catch(console.error);
        
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
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    getAuthToken,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#1a2b4b] relative z-50">
          <img src="/images/logos/logo_completo.png" alt="Carpetazo" className="h-20 md:h-28 mb-6 brightness-0 invert opacity-90 animate-pulse" />
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-white"></div>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}


