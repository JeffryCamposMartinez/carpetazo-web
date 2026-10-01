import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { markAcceptedBeforeLogin, clearPendingAcceptance } from '../legal/pending';

const inputClass = 'w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 focus:bg-white transition-all text-gray-800';
const primaryButtonClass = 'w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50';

function Spinner() {
  return <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>;
}

// Casilla de aceptación: sin marcar, obligatoria para ingresar por cualquier método
function TermsCheckbox({ checked, onChange, showError, inputRef }) {
  return (
    <div>
      <label className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3.5 ring-1 transition ${showError ? 'bg-red-50 ring-red-300' : 'bg-slate-50 ring-slate-200'}`}>
        <input
          ref={inputRef}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={showError ? 'auth-terms-error' : undefined}
          className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-[#12315f]"
        />
        <span className="text-[13px] font-semibold leading-snug text-slate-800">
          Tengo 18 años o más y acepto los{' '}
          <a href="/terminos" target="_blank" rel="noopener noreferrer" className="font-extrabold text-blue-600 underline underline-offset-2">Términos y Condiciones</a>{' '}
          y la{' '}
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-extrabold text-blue-600 underline underline-offset-2">Política de Privacidad</a>.
        </span>
      </label>
      {showError && <p id="auth-terms-error" role="alert" className="mt-1.5 pl-1 text-xs font-bold text-red-600">Marca la casilla para poder continuar.</p>}
    </div>
  );
}

// Las cuentas nuevas se crean solo con Google. El correo y la contraseña quedan para quien ya tenía una
// (o la creó en su perfil): por eso no hay formulario de registro con correo.
export default function AuthModal({ isOpen, onClose }) {
  const { loginWithGoogle, loginWithEmail, resetPassword } = useAuth();

  // Vistas: 'login' (Google), 'email' (ya tengo contraseña), 'forgot', 'verify-sent'
  const [view, setView] = useState('login');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const checkboxRef = useRef(null);

  useEffect(() => {
    setErrorMsg('');
    setSuccessMsg('');
    setShowTermsError(false);
    if (!isOpen) {
      setEmail('');
      setPassword('');
      setAgreed(false);
      setView('login');
    }
  }, [isOpen, view]);

  // Sin la casilla marcada no se abre Google ni se envía el formulario: se avisa y se lleva el foco a la casilla
  const requireAgreement = () => {
    if (agreed) return true;
    setShowTermsError(true);
    checkboxRef.current?.focus();
    return false;
  };

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    if (!requireAgreement()) return;
    setLoading(true);
    setErrorMsg('');
    markAcceptedBeforeLogin();
    try {
      await loginWithGoogle();
      onClose();
    } catch (err) {
      clearPendingAcceptance();
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setErrorMsg('No pudimos iniciar sesión con Google. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!requireAgreement()) return;
    setLoading(true);
    setErrorMsg('');
    markAcceptedBeforeLogin();
    try {
      await loginWithEmail(email, password);
      onClose();
    } catch (err) {
      clearPendingAcceptance();
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

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await resetPassword(email);
      setSuccessMsg('Si el correo tiene una cuenta con contraseña, te enviamos un enlace para restablecerla. Revisa tu correo.');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-email') {
        setErrorMsg('Formato de correo electrónico inválido.');
      } else {
        setErrorMsg('Error al enviar el enlace. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    login: 'Entra a Carpetazo',
    email: 'Ingresar con contraseña',
    forgot: 'Recuperar contraseña',
    'verify-sent': 'Verificación requerida'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={titles[view]}>
      <div className="fixed inset-0 bg-[#0a1120]/75 backdrop-blur-md animate-fadeIn" onClick={loading ? null : onClose}></div>

      <div className="relative w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden z-10 p-6 md:p-8 animate-scaleUp">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Cerrar"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-full hover:bg-gray-50 focus:outline-none"
        >
          <span translate="no" className="material-symbols-outlined text-[24px]">close</span>
        </button>

        <div className="flex flex-col items-center mb-6">
          <img src="/images/logos/logo_completo.webp" alt="Carpetazo.cl" className="h-16 w-auto object-contain mb-2" />
          <h2 className="text-lg font-extrabold text-[#12315f]">{titles[view]}</h2>
        </div>

        {errorMsg && (
          <div role="alert" className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 text-xs font-medium px-4 py-3 rounded-xl mb-4 leading-relaxed">
            <span translate="no" className="material-symbols-outlined text-[16px] text-red-600 shrink-0 mt-0.5">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div role="status" className="flex items-start gap-2.5 bg-green-50 border border-green-100 text-green-700 text-xs font-medium px-4 py-3 rounded-xl mb-4 leading-relaxed">
            <span translate="no" className="material-symbols-outlined text-[16px] text-green-600 shrink-0 mt-0.5">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        {view === 'login' && (
          <div className="space-y-4">
            <TermsCheckbox checked={agreed} onChange={(value) => { setAgreed(value); if (value) setShowTermsError(false); }} showError={showTermsError} inputRef={checkboxRef} />

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-12 border-2 border-[#12315f] bg-white hover:bg-blue-50 text-[#12315f] font-extrabold rounded-full transition-all flex items-center justify-center gap-3 active:scale-[0.99] shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[#12315f] border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <img src="/images/logos/google.svg" alt="" className="w-5 h-5" />
                  Continuar con Google
                </>
              )}
            </button>

            <p className="text-center text-xs text-gray-500 leading-relaxed">
              Si es tu primera vez, se crea tu cuenta. Solo usamos tu nombre, correo y foto de Google.
            </p>

            <p className="text-center text-xs text-gray-500 pt-4 border-t border-gray-100 font-medium">
              ¿Ya creaste una contraseña?{' '}
              <button type="button" onClick={() => setView('email')} className="text-blue-600 hover:text-blue-700 font-bold">
                Ingresar con correo y contraseña
              </button>
            </p>
          </div>
        )}

        {view === 'email' && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="block text-xs font-bold text-gray-700 mb-1.5">Correo electrónico</label>
              <div className="relative">
                <span translate="no" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">mail</span>
                <input id="auth-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" className={inputClass} />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="auth-password" className="block text-xs font-bold text-gray-700">Contraseña</label>
                <button type="button" onClick={() => setView('forgot')} className="text-xs text-blue-600 hover:text-blue-700 font-bold transition-colors">
                  ¿La olvidaste?
                </button>
              </div>
              <div className="relative">
                <span translate="no" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">lock</span>
                <input id="auth-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
              </div>
            </div>

            <TermsCheckbox checked={agreed} onChange={(value) => { setAgreed(value); if (value) setShowTermsError(false); }} showError={showTermsError} inputRef={checkboxRef} />

            <button type="submit" disabled={loading} className={primaryButtonClass}>
              {loading ? <Spinner /> : (<><span translate="no" className="material-symbols-outlined text-[18px]">login</span>Ingresar</>)}
            </button>

            <p className="text-center text-xs text-gray-500 pt-4 border-t border-gray-100 font-medium">
              <button type="button" onClick={() => setView('login')} className="text-blue-600 hover:text-blue-700 font-bold flex items-center justify-center gap-1 mx-auto">
                <span translate="no" className="material-symbols-outlined text-[14px]">arrow_back</span>
                Volver a Continuar con Google
              </button>
            </p>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Ingresa el correo de tu cuenta. Te enviaremos un enlace para restablecer tu contraseña.
            </p>

            <div>
              <label htmlFor="auth-reset-email" className="block text-xs font-bold text-gray-700 mb-1.5">Correo electrónico</label>
              <div className="relative">
                <span translate="no" className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">mail</span>
                <input id="auth-reset-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" className={inputClass} />
              </div>
            </div>

            <button type="submit" disabled={loading} className={primaryButtonClass}>
              {loading ? <Spinner /> : (<><span translate="no" className="material-symbols-outlined text-[18px]">send</span>Enviar enlace</>)}
            </button>

            <p className="text-center text-xs text-gray-500 pt-4 border-t border-gray-100 font-medium">
              <button type="button" onClick={() => setView('email')} className="text-blue-600 hover:text-blue-700 font-bold flex items-center justify-center gap-1 mx-auto">
                <span translate="no" className="material-symbols-outlined text-[14px]">arrow_back</span>
                Volver
              </button>
            </p>
          </form>
        )}

        {view === 'verify-sent' && (
          <div className="text-center space-y-6 animate-fadeIn">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <span translate="no" className="material-symbols-outlined text-[36px]">mark_email_read</span>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-gray-800 text-base">¡Enlace enviado!</h3>
              <p className="text-xs text-gray-500 leading-relaxed px-2">
                Hemos enviado un correo a <strong className="text-gray-800 font-bold">{email}</strong>.
                Abre el enlace que te enviamos para verificar tu cuenta y poder ingresar.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-100 text-amber-800 text-[11px] font-medium p-3 rounded-xl leading-relaxed">
              <strong>¿No lo has recibido?</strong> Revisa tu carpeta de correo no deseado (spam).
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button type="button" onClick={handleEmailLogin} disabled={loading} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-sm text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (<><span translate="no" className="material-symbols-outlined text-[16px]">refresh</span>Ya verifiqué, intentar ingresar</>)}
              </button>

              <button type="button" onClick={() => setView('login')} className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 font-bold transition-colors">
                Volver
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
