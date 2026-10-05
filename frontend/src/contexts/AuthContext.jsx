import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, googleProvider, warmUpGoogleSignIn } from '../services/firebase';
import { api } from '../services/api';
import { takePendingAcceptance } from '../legal/pending';
import AppSplash from '../components/layout/AppSplash';
import {
  onAuthStateChanged,
  signInWithPopup,
  browserPopupRedirectResolver,
  signOut,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  EmailAuthProvider,
  linkWithCredential,
  updatePassword,
  reauthenticateWithPopup,
  deleteUser
} from 'firebase/auth';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

const providerIds = (user) => (user?.providerData || []).map((provider) => provider.providerId);

// Una cuenta solo de correo y contraseña debe verificar su correo antes de entrar. Si la cuenta tiene Google enlazado, Google ya verificó
// ese correo: al crear una contraseña en el perfil, Firebase puede dejar "emailVerified" en falso y no se debe sacar a la persona por eso.
const mustVerifyEmail = (user) => Boolean(user) && !user.emailVerified && providerIds(user).includes('password') && !providerIds(user).includes('google.com');

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  // Estado de los Términos y la Política: { current: {termsVersion, privacyVersion}, accepted, canChooseUsername }
  const [legal, setLegal] = useState(null);
  // true: ya marcó la casilla antes de ingresar y solo falta elegir su usuario (cuenta nueva)
  const [preAccepted, setPreAccepted] = useState(false);
  const [, setProvidersTick] = useState(0); // fuerza a refrescar si cambian los métodos de ingreso (p. ej. se crea una contraseña)
  const [loading, setLoading] = useState(true);

  // Las cuentas nuevas se crean solo con Google
  function loginWithGoogle() {
    return signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
  }

  // Cuentas que ya tenían correo y contraseña (y quienes crearon una contraseña en su perfil)
  async function loginWithEmail(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (mustVerifyEmail(user)) {
      // Reenviar la verificación automáticamente si intenta ingresar y no está verificado
      await sendEmailVerification(user);
      await signOut(auth);
      throw new Error('auth/email-not-verified');
    }
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
    setLegal(null);
    setPreAccepted(false);
    return signOut(auth);
  }

  // Registra la aceptación en el servidor (la persona ya marcó que es mayor de edad y que acepta los textos)
  const submitAcceptance = useCallback(async (current, username) => {
    const response = await api.acceptTerms({
      adult: true,
      termsVersion: current.termsVersion,
      privacyVersion: current.privacyVersion,
      ...(username ? { username } : {})
    });
    setLegal(response.legal || null);
    setPreAccepted(false);
    return response;
  }, []);

  const applyServerState = useCallback((response) => {
    setAppUser(response?.user || null);
    setLegal(response?.legal || null);
    const state = response?.legal;
    // Si marcó la casilla antes de ingresar, la aceptación se registra sola; una cuenta nueva solo elige su usuario
    if (state && !state.accepted && takePendingAcceptance(state.current)) {
      if (state.canChooseUsername) {
        setPreAccepted(true);
      } else {
        submitAcceptance(state.current)
          .then(() => api.getMe())
          .then((me) => { setAppUser(me.user || null); setLegal(me.legal || null); })
          .catch((error) => console.error('Error al registrar la aceptación:', error));
      }
    }
    return response?.user || null;
  }, [submitAcceptance]);

  const refreshAppUser = useCallback(async () => {
    if (!auth.currentUser) {
      setAppUser(null);
      setLegal(null);
      return null;
    }

    try {
      return applyServerState(await api.getMe());
    } catch (error) {
      if (String(error.message || '').includes('404')) {
        return applyServerState(await api.syncUser({
          displayName: auth.currentUser.displayName,
          photoURL: auth.currentUser.photoURL
        }));
      }
      throw error;
    }
  }, [applyServerState]);

  // Aceptar los textos vigentes (la persona ya marcó que es mayor de edad y que los acepta). `username` solo en cuentas nuevas.
  async function acceptTerms({ username } = {}) {
    if (!legal?.current) throw new Error('No se pudo cargar la versión de los textos. Recarga la página.');
    const response = await submitAcceptance(legal.current, username);
    await refreshAppUser().catch(() => {});
    return response;
  }

  // "Salir" sin aceptar: el servidor borra una cuenta recién creada y sin actividad; después se cierra la sesión
  async function declineTerms() {
    const user = auth.currentUser;
    try {
      const response = await api.declineTerms();
      if (response?.deleted && user) await deleteUser(user).catch(() => {});
    } catch (error) {
      console.error('Error al salir sin aceptar:', error);
    }
    return logout();
  }

  // Crear o cambiar la contraseña de una cuenta que ingresa con Google (solo funciona con ese correo de Google)
  async function setAccountPassword(newPassword) {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error('auth/no-user');
    if (!providerIds(user).includes('google.com')) throw new Error('auth/google-required');
    const apply = () => (providerIds(user).includes('password')
      ? updatePassword(user, newPassword)
      : linkWithCredential(user, EmailAuthProvider.credential(user.email, newPassword)));
    try {
      await apply();
    } catch (error) {
      if (error.code !== 'auth/requires-recent-login') throw error;
      // Por seguridad Firebase pide haber ingresado hace poco: se confirma con Google y se reintenta una vez
      await reauthenticateWithPopup(user, googleProvider, browserPopupRedirectResolver);
      await apply();
    }
    await user.reload();
    setProvidersTick((tick) => tick + 1);
  }

  useEffect(() => {
    // Si el servidor rechaza una acción porque falta aceptar los textos, se vuelve a pedir el estado (y aparece la pantalla)
    const onTermsRequired = () => { refreshAppUser().catch(() => {}); };
    window.addEventListener('carpetazo:terms-required', onTermsRequired);
    return () => window.removeEventListener('carpetazo:terms-required', onTermsRequired);
  }, [refreshAppUser]);

  useEffect(() => {
    // Suscribirse a los cambios en el estado de autenticación
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Con sesión iniciada se prepara la ventana de Google sin apuro (la usa "reautenticar" en el perfil)
      if (user) window.setTimeout(() => { warmUpGoogleSignIn(); }, 3000);
      // Si el usuario está autenticado pero no verificado, y es login por Contraseña
      if (mustVerifyEmail(user)) {
        await signOut(auth);
        setCurrentUser(null);
        setAppUser(null);
        setLegal(null);
        setLoading(false);
        return;
      }

      setCurrentUser(user);
      setLoading(false);

      if (user) {
        // Sincronizar usuario con el backend PostgreSQL
        api.syncUser({
          displayName: user.displayName,
          photoURL: user.photoURL
        }).then(applyServerState).catch(console.error);
      } else {
        setAppUser(null);
        setLegal(null);
      }
    });

    return unsubscribe;
  }, [applyServerState]);

  const value = {
    currentUser,
    appUser,
    legal,
    preAccepted,
    refreshAppUser,
    setAppUser,
    loginWithGoogle,
    loginWithEmail,
    resetPassword,
    getAuthToken,
    logout,
    acceptTerms,
    declineTerms,
    setAccountPassword,
    hasGoogleLogin: providerIds(currentUser).includes('google.com'),
    hasPasswordLogin: providerIds(currentUser).includes('password')
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <AppSplash /> : children}
    </AuthContext.Provider>
  );
}
