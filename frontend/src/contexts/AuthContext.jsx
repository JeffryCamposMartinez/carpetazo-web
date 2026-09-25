import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, googleProvider } from '../firebase';
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
  const [appUser, setAppUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Iniciar sesión con Google
  function loginWithGoogle() {
    return signInWithPopup(auth, googleProvider);
  }

  // Iniciar sesión con Email y Contraseña
  async function loginWithEmail(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (!user.emailVerified) {
      // Reenviar la verificación automáticamente si intenta ingresar y no está verificado
      await sendEmailVerification(user);
      await signOut(auth);
      throw new Error('auth/email-not-verified');
    }
    return user;
  }

  // Registrarse con Email y Contraseña
  async function registerWithEmail(email, password, displayName, username) {
    const formattedUsername = username.toLowerCase().trim();

    // 1. Omitimos validación de Firestore, confiamos en la base de datos de PostgreSQL 
    // y en Firebase Auth para atrapar duplicados de email.

    // 2. Crear el usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 3. Actualizar perfil con el displayName
    await updateProfile(user, { displayName });

    // 4. Enviar correo de verificación
    await sendEmailVerification(user);

    // 5. Guardar en backend relacional a través del sync
    await getAuthToken(); // refrescar
    await api.syncUser({
      displayName: displayName,
      username: formattedUsername
    }).catch(console.error);

    // 6. Forzar cierre de sesión inmediato
    await signOut(auth);
    return user;
  }

  // Restablecer Contraseña
  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  // Obtener token JWT de Firebase
  async function getAuthToken() {
    return auth.currentUser ? await auth.currentUser.getIdToken(true) : null;
  }

  // Cerrar sesión
  function logout() {
    setAppUser(null);
    return signOut(auth);
  }

  const refreshAppUser = useCallback(async () => {
    if (!auth.currentUser) {
      setAppUser(null);
      return null;
    }

    try {
      const response = await api.getMe();
      setAppUser(response.user || null);
      return response.user || null;
    } catch (error) {
      if (String(error.message || '').includes('404')) {
        const response = await api.syncUser({
          displayName: auth.currentUser.displayName,
          photoURL: auth.currentUser.photoURL
        });
        setAppUser(response.user || null);
        return response.user || null;
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    // Suscribirse a los cambios en el estado de autenticación
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Si el usuario está autenticado pero no verificado, y es login por Contraseña
      if (user && !user.emailVerified && user.providerData.some(p => p.providerId === 'password')) {
        await signOut(auth);
        setCurrentUser(null);
        setAppUser(null);
        setLoading(false);
        return;
      }

      setCurrentUser(user);
      setLoading(false);
      
      if (user) {
        // Sincronizar usuario con el backend PostgreSQL y OMITIR Firestore
        api.syncUser({
          displayName: user.displayName,
          photoURL: user.photoURL
        }).then(response => setAppUser(response.user || null)).catch(console.error);
      } else {
        setAppUser(null);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    appUser,
    refreshAppUser,
    setAppUser,
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
          <img src="/images/logos/logo_completo.webp" alt="Carpetazo" className="h-20 md:h-28 mb-6 brightness-0 invert opacity-90 animate-pulse" />
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-white"></div>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}


