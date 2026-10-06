import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { chileData } from '../../config/chileData';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import ThemedSelect from '../ui/ThemedSelect';


// Pide la región y la comuna a quien ingresa sin tenerlas (cuenta nueva o antigua) antes de seguir.
// Aparece después de aceptar los términos; no se puede cerrar: solo guardar la ubicación o salir.
export default function LocationGate() {
  const { currentUser, appUser, legal, refreshAppUser, logout } = useAuth();
  const location = useLocation();
  const [region, setRegion] = useState('');
  const [comuna, setComuna] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const dialogRef = useRef(null);

  const visible = Boolean(currentUser && appUser && legal?.accepted && !appUser.publicComuna) && !['/terminos', '/privacidad'].includes(location.pathname);
  const regionOptions = useMemo(() => chileData.map((item) => ({ value: item.region, label: item.region })), []);
  const comunaOptions = useMemo(() => (chileData.find((item) => item.region === region)?.comunas || []).map((item) => ({ value: item, label: item })), [region]);

  useBodyScrollLock(visible);
  useEffect(() => {
    if (visible) dialogRef.current?.focus();
  }, [visible]);

  if (!visible) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (!region || !comuna || busy) return;
    setBusy('save');
    setError('');
    try {
      // Solo región y comuna: el servidor valida la comuna y deduce la región
      await api.updateProfile({ addresses: [{ id: 'ubicacion', name: 'Mi ubicación', region, comuna, isDefault: true }] });
      await refreshAppUser();
    } catch (_error) {
      setError('No pudimos guardar tu ubicación. Inténtalo de nuevo.');
    } finally {
      setBusy('');
    }
  };

  const leave = async () => {
    setBusy('leave');
    try { await logout(); } finally { setBusy(''); }
  };

  return (
    <div className="fixed inset-0 z-[2900] flex items-end justify-center bg-[#0a1120]/80 p-0 backdrop-blur-md sm:items-center sm:p-4">
      <form
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-gate-title"
        onSubmit={submit}
        className="max-h-[100dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl outline-none sm:rounded-3xl sm:p-7"
      >
        <img src="/images/logos/logo_completo.webp" alt="Carpetazo.cl" className="mx-auto mb-3 h-14 w-auto object-contain" />
        <h2 id="location-gate-title" className="text-center text-xl font-extrabold text-[#12315f]">¿Desde dónde nos visitas?</h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Indica tu región y comuna para continuar. Se muestran en tu perfil y en tus carpetas, y ayudan a que otras personas te encuentren. <strong>No te pedimos tu dirección exacta.</strong>
        </p>

        <div className="mt-5">
          <p className="mb-1 text-sm font-bold text-[#12315f]">Región</p>
          <ThemedSelect value={region} onChange={(value) => { setRegion(value); setComuna(''); }} options={regionOptions} placeholder="Selecciona tu región" icon="map" ariaLabel="Región" />
        </div>
        <div className="mt-3">
          <p className="mb-1 text-sm font-bold text-[#12315f]">Comuna</p>
          <ThemedSelect value={comuna} onChange={setComuna} options={comunaOptions} placeholder={region ? 'Selecciona tu comuna' : 'Primero elige tu región'} searchable searchPlaceholder="Escribe tu comuna…" icon="location_on" ariaLabel="Comuna" disabled={!region} />
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Más detalles en los <a href="/terminos" target="_blank" rel="noopener noreferrer" className="font-bold text-[#1e40af] underline underline-offset-2">Términos</a> y la <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-bold text-[#1e40af] underline underline-offset-2">Política de Privacidad</a>. Puedes cambiarla después en tu perfil.
        </p>

        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button type="submit" disabled={!region || !comuna || Boolean(busy)} className="h-12 flex-1 rounded-full bg-[#12315f] px-5 text-sm font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-40">
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
