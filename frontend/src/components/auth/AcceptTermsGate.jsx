import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

// Pantalla que bloquea el uso de la cuenta hasta aceptar los Términos y Condiciones vigentes.
// Aparece en el primer ingreso y cada vez que cambia la versión. No se puede cerrar: solo aceptar o salir.
export default function AcceptTermsGate() {
  const { currentUser, appUser, legal, preAccepted, acceptTerms, declineTerms } = useAuth();
  const location = useLocation();
  const [agreed, setAgreed] = useState(false);
  const [username, setUsername] = useState('');
  const [usernameState, setUsernameState] = useState({ checking: false, available: null, message: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const dialogRef = useRef(null);

  const visible = Boolean(currentUser && legal && !legal.accepted) && !['/terminos', '/privacidad'].includes(location.pathname);
  const chooseUsername = Boolean(legal?.canChooseUsername);

  // El usuario sugerido es el que ya se generó al crear la cuenta
  useEffect(() => {
    if (visible && chooseUsername && appUser?.username) setUsername(appUser.username);
  }, [visible, chooseUsername, appUser?.username]);

  // El fondo no se desplaza y el foco entra al cuadro
  useBodyScrollLock(visible);
  useEffect(() => {
    if (visible) dialogRef.current?.focus();
  }, [visible]);

  // Disponibilidad del usuario elegido (con una breve espera mientras escribe)
  useEffect(() => {
    if (!visible || !chooseUsername) return undefined;
    const value = username.trim();
    if (!value || value === appUser?.username) { setUsernameState({ checking: false, available: value ? true : null, message: '' }); return undefined; }
    if (!/^[a-z0-9_]{3,20}$/.test(value)) {
      setUsernameState({ checking: false, available: false, message: 'Usa de 3 a 20 letras minúsculas, números o _.' });
      return undefined;
    }
    setUsernameState({ checking: true, available: null, message: '' });
    let cancelled = false;
    const timer = setTimeout(() => {
      api.checkUsernameAvailable(value)
        .then((res) => { if (!cancelled) setUsernameState({ checking: false, available: Boolean(res.available), message: res.available ? '' : 'Ese usuario ya está en uso o no está permitido.' }); })
        .catch(() => { if (!cancelled) setUsernameState({ checking: false, available: null, message: '' }); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [visible, chooseUsername, username, appUser?.username]);

  if (!visible) return null;

  // preAccepted: ya marcó la casilla antes de ingresar (cuenta nueva): solo falta elegir su usuario
  const isReturning = !chooseUsername && !preAccepted; // cuenta que ya existía: solo debe aceptar los textos actualizados
  const canSubmit = (agreed || preAccepted) && !busy && (!chooseUsername || usernameState.available !== false) && !usernameState.checking;

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy('accept');
    setError('');
    try {
      const chosen = username.trim();
      await acceptTerms(chooseUsername && chosen && chosen !== appUser?.username ? { username: chosen } : {});
    } catch (err) {
      setError(err.status === 409 && err.code !== 'terms_version_changed' ? 'Ese usuario ya está en uso. Elige otro.' : (err.message || 'No pudimos guardar tu aceptación. Intenta de nuevo.'));
      setBusy('');
    }
  };

  const leave = async () => {
    setBusy('leave');
    await declineTerms();
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-[#0a1120]/80 p-0 backdrop-blur-md sm:items-center sm:p-4">
      <form
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-gate-title"
        onSubmit={submit}
        className="max-h-[100dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl outline-none sm:rounded-3xl sm:p-7"
      >
        <img src="/images/logos/logo_completo.webp" alt="Carpetazo.cl" className="mx-auto mb-3 h-14 w-auto object-contain" />
        <h2 id="terms-gate-title" className="text-center text-xl font-extrabold text-[#12315f]">
          {preAccepted ? 'Elige tu nombre de usuario' : isReturning ? 'Actualizamos nuestros términos' : 'Un último paso antes de entrar'}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          {preAccepted
            ? 'Así te encontrarán otras personas en Carpetazo. Puedes cambiarlo después en tu perfil.'
            : isReturning
              ? 'Para seguir usando Carpetazo necesitamos que aceptes los Términos y Condiciones y que leas la Política de Privacidad.'
              : 'Para usar Carpetazo necesitamos que aceptes nuestros términos.'}
        </p>

        {chooseUsername && (
          <div className="mt-5">
            <label htmlFor="terms-username" className="block text-sm font-bold text-[#12315f]">Tu nombre de usuario</label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">@</span>
              <input
                id="terms-username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                autoComplete="username"
                maxLength={20}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-base font-semibold text-slate-900 focus:border-[#1e40af] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#facc15]/70"
              />
            </div>
            <p className={`mt-1 text-xs font-semibold ${usernameState.available === false ? 'text-red-600' : 'text-slate-500'}`} aria-live="polite">
              {usernameState.checking ? 'Verificando…' : usernameState.message || `Tu perfil será carpetazo.cl/${username || 'usuario'}. Puedes cambiarlo después.`}
            </p>
          </div>
        )}

        {!preAccepted && (<>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-[#12315f]"
          />
          <span className="text-sm font-semibold leading-snug text-slate-800">
            Tengo 18 años o más y acepto los{' '}
            <a href="/terminos" target="_blank" rel="noopener noreferrer" className="font-extrabold text-[#1e40af] underline underline-offset-2">Términos y Condiciones</a>.
          </span>
        </label>

        <p className="mt-3 text-sm text-slate-600">
          Lee cómo cuidamos tus datos en la{' '}
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-extrabold text-[#1e40af] underline underline-offset-2">Política de Privacidad</a>.
        </p>
        </>)}

        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="submit"
            disabled={!canSubmit}
            className="h-12 flex-1 rounded-full bg-[#12315f] px-5 text-sm font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === 'accept' ? 'Guardando…' : preAccepted ? 'Continuar' : 'Aceptar y continuar'}
          </button>
          <button
            type="button"
            onClick={leave}
            disabled={Boolean(busy)}
            className="h-12 rounded-full border-2 border-slate-300 px-5 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === 'leave' ? 'Saliendo…' : 'Salir'}
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">Puedes eliminar tu cuenta cuando quieras.</p>
      </form>
    </div>
  );
}
