import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthModal({ isOpen, onClose }) {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword } = useAuth();
  
  // Views: 'login', 'register', 'forgot', 'verify-sent'
  const [view, setView] = useState('login');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');

  // Clean state when modal opens/closes or view changes
  useEffect(() => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!isOpen) {
      setEmail('');
      setPassword('');
      setFullName('');
      setUsername('');
      setConfirmPassword('');
      setConfirmEmail('');
      setView('login');
    }
  }, [isOpen, view]);

  if (!isOpen) return null;

  // Handle Google Login
  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      await loginWithGoogle();
      onClose();
    } catch (err) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMsg('Error al iniciar sesión con Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Email Login
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      await loginWithEmail(email, password);
      onClose();
    } catch (err) {
      console.error(err);
      if (err.message === 'auth/email-not-verified') {
        setView('verify-sent');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setErrorMsg('Correo o contraseña incorrectos.');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg('Formato de correo electrónico inválido.');
      } else {
        setErrorMsg('Ocurrió un error al iniciar sesión. Por favor intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Email Register
  const handleEmailRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Username validation
    const usernameRegex = /^[a-z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      setErrorMsg('El usuario debe tener entre 3 y 20 caracteres y contener solo letras minúsculas, números y guiones bajos (_).');
      setLoading(false);
      return;
    }

    // Email match validation
    if (email.toLowerCase().trim() !== confirmEmail.toLowerCase().trim()) {
      setErrorMsg('Los correos electrónicos no coinciden.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      setLoading(false);
      return;
    }

    try {
      await registerWithEmail(email, password, fullName, username);
      setView('verify-sent');
    } catch (err) {
      console.error(err);
      const errorCode = err.code || err.message;
      if (errorCode === 'auth/username-already-in-use') {
        setErrorMsg('Este nombre de usuario ya está registrado por otro usuario.');
      } else if (errorCode === 'auth/displayname-already-in-use') {
        setErrorMsg('Este nombre completo ya está registrado por otro usuario.');
      } else if (errorCode === 'auth/email-already-in-use') {
        setErrorMsg('Este correo electrónico ya está registrado.');
      } else if (errorCode === 'auth/invalid-email') {
        setErrorMsg('Formato de correo electrónico inválido.');
      } else if (errorCode === 'auth/weak-password') {
        setErrorMsg('La contraseña es muy débil (mínimo 6 caracteres).');
      } else {
        setErrorMsg('Error al registrar la cuenta. Por favor intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await resetPassword(email);
      setSuccessMsg('Te hemos enviado un enlace para restablecer tu contraseña. Revisa tu correo.');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setErrorMsg('No existe ninguna cuenta asociada a este correo.');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg('Formato de correo electrónico inválido.');
      } else {
        setErrorMsg('Error al enviar el enlace. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Background overlay with blur */}
      <div 
        className="fixed inset-0 bg-[#0a1120]/75 backdrop-blur-md animate-fadeIn" 
        onClick={loading ? null : onClose}
      ></div>

      {/* Modal Card */}
      <div className="relative w-full max-w-md md:max-w-xl bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden z-10 p-6 md:p-8 animate-scaleUp">
        {/* Close Button */}
        <button 
          onClick={onClose} 
          disabled={loading}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-full hover:bg-gray-50 focus:outline-none"
        >
          <span translate="no" className="material-symbols-outlined text-[24px]">close</span>
        </button>

        {/* Logo and Header */}
        <div className="flex flex-col items-center mb-6">
          <img src="/images/logos/logo_completo.png" alt="Carpetazo.cl" className="h-16 w-auto object-contain mb-1.5" />
          <p className="text-gray-500 text-xs font-semibold tracking-wide uppercase">
            {view === 'login' && 'Iniciar Sesión'}
            {view === 'register' && 'Crear una Cuenta'}
            {view === 'forgot' && 'Recuperar Contraseña'}
            {view === 'verify-sent' && 'Verificación Requerida'}
          </p>
        </div>

        {/* Error Message Alert */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 text-xs font-medium px-4 py-3 rounded-xl mb-4 leading-relaxed">
            <span translate="no" className="material-symbols-outlined text-[16px] text-red-600 shrink-0 mt-0.5">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Message Alert */}
        {successMsg && (
          <div className="flex items-start gap-2.5 bg-green-50 border border-green-100 text-green-700 text-xs font-medium px-4 py-3 rounded-xl mb-4 leading-relaxed">
            <span translate="no" className="material-symbols-outlined text-[16px] text-green-600 shrink-0 mt-0.5">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* VIEW: LOGIN */}
        {view === 'login' && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Correo Electrónico</label>
              <div className="relative">
                <span translate="no" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">mail</span>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:bg-white transition-all text-gray-800"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase">Contraseña</label>
                <button 
                  type="button" 
                  onClick={() => setView('forgot')}
                  className="text-xs text-blue-600 hover:text-blue-700 font-bold transition-colors"
                >
                  ¿La olvidaste?
                </button>
              </div>
              <div className="relative">
                <span translate="no" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">lock</span>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:bg-white transition-all text-gray-800"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span translate="no" className="material-symbols-outlined text-[18px]">login</span>
                  Ingresar
                </>
              )}
            </button>

            {/* Separator */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-150"></div></div>
              <span className="relative bg-white px-3 text-xs font-bold text-gray-400 uppercase">O iniciar con</span>
            </div>

            {/* Google Login Button */}
            <button 
              type="button" 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-xl transition-all flex items-center justify-center gap-2.5 hover:scale-[1.01] active:scale-[0.99] shadow-sm disabled:opacity-50"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4.5 h-4.5 bg-white" />
              Cuenta de Google
            </button>

            {/* Register redirection */}
            <p className="text-center text-xs text-gray-500 mt-6 pt-4 border-t border-gray-100 font-medium">
              ¿No tienes una cuenta?{' '}
              <button 
                type="button" 
                onClick={() => setView('register')}
                className="text-blue-600 hover:text-blue-700 font-bold"
              >
                Regístrate aquí
              </button>
            </p>
          </form>
        )}

        {/* VIEW: REGISTER */}
        {view === 'register' && (
          <form onSubmit={handleEmailRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Nombre Completo</label>
              <div className="relative">
                <span translate="no" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">person</span>
                <input 
                  type="text" 
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tu Nombre y Apellido"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:bg-white transition-all text-gray-800"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase">Nombre de Usuario</label>
                <span className="text-[10px] text-gray-400 font-bold uppercase">Solo minúsculas y _</span>
              </div>
              <div className="relative">
                <span translate="no" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">alternate_email</span>
                <input 
                  type="text" 
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))}
                  placeholder="nombre_usuario"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:bg-white transition-all text-gray-800 font-mono"
                />
              </div>
              {username && (
                <p className="text-[10px] text-gray-500 mt-1 pl-1">
                  Tu enlace de perfil será: <strong className="text-gray-700 font-bold">carpetazo.cl/{username}</strong>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Correo Electrónico</label>
                <div className="relative">
                  <span translate="no" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">mail</span>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:bg-white transition-all text-gray-800"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Confirmar Correo</label>
                <div className="relative">
                  <span translate="no" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">mail</span>
                  <input 
                    type="email" 
                    required
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:bg-white transition-all text-gray-800"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Contraseña</label>
                <div className="relative">
                  <span translate="no" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">lock</span>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mín. 6 car."
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:bg-white transition-all text-gray-800"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Confirmar</label>
                <div className="relative">
                  <span translate="no" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">lock</span>
                  <input 
                    type="password" 
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmar"
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:bg-white transition-all text-gray-800"
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span translate="no" className="material-symbols-outlined text-[18px]">how_to_reg</span>
                  Crear Cuenta
                </>
              )}
            </button>

            {/* Back to Login */}
            <p className="text-center text-xs text-gray-500 mt-6 pt-4 border-t border-gray-100 font-medium">
              ¿Ya tienes cuenta registrada?{' '}
              <button 
                type="button" 
                onClick={() => setView('login')}
                className="text-blue-600 hover:text-blue-700 font-bold"
              >
                Inicia sesión aquí
              </button>
            </p>
          </form>
        )}

        {/* VIEW: FORGOT PASSWORD */}
        {view === 'forgot' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Ingresa el correo electrónico asociado a tu cuenta. Te enviaremos un enlace de recuperación para que puedas restablecer tu contraseña.
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Correo Electrónico</label>
              <div className="relative">
                <span translate="no" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">mail</span>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:bg-white transition-all text-gray-800"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span translate="no" className="material-symbols-outlined text-[18px]">send</span>
                  Enviar Enlace
                </>
              )}
            </button>

            {/* Back to Login */}
            <p className="text-center text-xs text-gray-500 mt-6 pt-4 border-t border-gray-100 font-medium">
              <button 
                type="button" 
                onClick={() => setView('login')}
                className="text-blue-600 hover:text-blue-700 font-bold flex items-center justify-center gap-1 mx-auto"
              >
                <span translate="no" className="material-symbols-outlined text-[14px]">arrow_back</span>
                Volver a Iniciar Sesión
              </button>
            </p>
          </form>
        )}

        {/* VIEW: VERIFY EMAIL SENT */}
        {view === 'verify-sent' && (
          <div className="text-center space-y-6 animate-fadeIn">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <span translate="no" className="material-symbols-outlined text-[36px]">mark_email_read</span>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-bold text-gray-800 text-base">¡Enlace enviado!</h3>
              <p className="text-xs text-gray-500 leading-relaxed px-2">
                Hemos enviado un correo a <strong className="text-gray-800 font-bold">{email}</strong>. 
                Por favor, abre el enlace que te enviamos para verificar tu cuenta y poder ingresar.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-100 text-amber-800 text-[11px] font-medium p-3 rounded-xl leading-relaxed">
              <strong>¿No lo has recibido?</strong> Recuerda revisar tu carpeta de correo no deseado (Spam).
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button 
                type="button"
                onClick={handleEmailLogin}
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-sm text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span translate="no" className="material-symbols-outlined text-[16px]">refresh</span>
                    Ya verifiqué, intentar ingresar
                  </>
                )}
              </button>
              
              <button 
                type="button" 
                onClick={() => setView('login')}
                className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 font-bold transition-colors"
              >
                Volver a Iniciar Sesión
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
