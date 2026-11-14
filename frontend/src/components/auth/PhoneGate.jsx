import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const PREFIX = '+569'; // celulares de Chile
const isValidPhone = (value) => /^\+?[0-9][0-9 ()-]{6,19}$/.test(value.trim());

// Pide un teléfono a quien ingresa sin tenerlo (cuenta nueva o antigua) para que otras personas puedan escribirle por WhatsApp.
// Aparece después de aceptar los términos y de indicar la comuna; no se puede cerrar: solo guardar el teléfono o salir.
export default function PhoneGate() {
  const { currentUser, appUser, legal, refreshAppUser, logout } = useAuth();
  const location = useLocation();
  const [phone, setPhone] = useState(PREFIX);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const dialogRef = useRef(null);

  const visible = Boolean(currentUser && appUser && appUser.role !== 'deleted' && legal?.accepted && appUser.publicComuna && !String(appUser.phone || '').trim()) && !['/terminos', '/privacidad'].includes(location.pathname);

  useBodyScrollLock(visible);
  useEffect(() => {
    if (visible) dialogRef.current?.focus();
  }, [visible]);

  if (!visible) return null;

  const valid = isValidPhone(phone);

  const submit = async (event) => {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy('save');
    setError('');
    try {
      await api.updateProfile({ phone: phone.trim() });
      await refreshAppUser();
    } catch (err) {
      setError(err.message && /teléfono/i.test(err.message) ? err.message : 'No pudimos guardar tu teléfono. Inténtalo de nuevo.');
    } finally {
      setBusy('');
    }
  };

  const leave = async () => {
    setBusy('leave');
    try { await logout(); } finally { setBusy(''); }
  };

  return (
    <div className="fixed inset-0 z-[2800] flex items-end justify-center bg-[#0a1120]/80 p-0 backdrop-blur-md sm:items-center sm:p-4">
      <form
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-gate-title"
        onSubmit={submit}
        className="max-h-[100dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl outline-none sm:rounded-3xl sm:p-7"
      >
        <img src="/images/logos/logo_completo.webp" alt="Carpetazo.cl" className="mx-auto mb-3 h-14 w-auto object-contain" />
        <h2 id="phone-gate-title" className="text-center text-xl font-extrabold text-[#12315f]">¿A qué número te escriben?</h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Para comprar, vender o cambiar cartas, las personas te contactan por WhatsApp. Ingresa tu número para continuar. <strong>Aparece en tu perfil como botón de WhatsApp; puedes ocultarlo cuando quieras.</strong>
        </p>

        <div className="mt-5">
          <label htmlFor="phone-gate-input" className="block text-sm font-bold text-[#12315f]">Tu teléfono</label>
          <input
            id="phone-gate-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/[^0-9+ ()-]/g, '').slice(0, 20))}
            maxLength={20}
            aria-invalid={phone.trim().length > PREFIX.length && !valid}
            className="mt-1 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-semibold text-slate-900 focus:border-[#1e40af] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e40af]/25"
          />
          <p className={`mt-1 text-xs font-semibold ${phone.trim().length > PREFIX.length && !valid ? 'text-red-600' : 'text-slate-500'}`} aria-live="polite">
            Usa solo números, con + o espacios. Ej.: +56 9 1234 5678.
          </p>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Más detalles en los <a href="/terminos" target="_blank" rel="noopener noreferrer" className="font-bold text-[#1e40af] underline underline-offset-2">Términos</a> y la <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-bold text-[#1e40af] underline underline-offset-2">Política de Privacidad</a>.
        </p>

        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button type="submit" disabled={!valid || Boolean(busy)} className="h-12 shrink-0 rounded-full sm:flex-1 bg-[#12315f] px-5 text-sm font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-50">
            {busy === 'save' ? 'Guardando…' : 'Guardar y continuar'}
          </button>
          <button type="button" onClick={leave} disabled={Boolean(busy)} className="h-12 rounded-full border-2 border-slate-300 px-5 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
            {busy === 'leave' ? 'Saliendo…' : 'Salir'}
          </button>
        </div>
      </form>
    </div>
  );
}
