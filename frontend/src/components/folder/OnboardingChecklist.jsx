import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/ToastProvider';
import { warmFolderPreview } from '../../utils/sharePreview';
import FolderEmptySteps from './FolderEmptySteps';
import { siteUrl } from '../../utils/siteUrl';

const hiddenKey = (uid) => `carpetazo:onboarding-hidden:${uid}`;
const readHidden = (uid) => { try { return localStorage.getItem(hiddenKey(uid)) === '1'; } catch (_error) { return false; } };

const COPY = {
  profile: { icon: 'account_circle', title: 'Completa tu perfil', text: (step) => `Agrega tu ${step.missing?.join(' y ') || 'foto y comuna'}: los compradores confían más en perfiles completos y obtienes la insignia de verificado.`, cta: 'Ir a mi perfil' },
  folder: { icon: 'create_new_folder', title: 'Crea tu primera carpeta', text: () => 'Elige el juego y un nombre, por ejemplo «Pokémon en venta».', cta: 'Crear carpeta' },
  cards: { icon: 'style', title: 'Agrega tus primeras cartas', text: (step) => `Búscalas por nombre, ponles precio y cantidad. Llevas ${step.count || 0} de ${step.goal}.`, cta: 'Agregar cartas' },
  share: { icon: 'ios_share', title: 'Comparte tu carpeta', text: () => 'Manda el enlace por WhatsApp o Instagram: se ve con una vista previa de tus cartas.', cta: 'Compartir enlace' }
};

// Guía de primeros pasos del vendedor. El avance viene del servidor (lo que ya hizo de verdad) y desaparece al completarse.
export default function OnboardingChecklist({ foldersCount, onCreateFolder, version }) {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const uid = currentUser?.uid;
  const [state, setState] = useState(null);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(() => (uid ? readHidden(uid) : false));

  const load = useCallback(() => {
    api.getOnboarding().then((res) => { if (res?.success) { setState(res); setFailed(false); } else setFailed(true); }).catch(() => setFailed(true));
  }, []);
  useEffect(() => { if (uid) load(); }, [uid, version, load]);

  const share = async () => {
    const id = state?.shareFolderId;
    if (!id) return;
    const url = siteUrl(`/c/${id}`);
    warmFolderPreview(id);
    try {
      if (navigator.share) await navigator.share({ title: 'Mi catálogo de cartas en Carpetazo', text: '¡Mira mi catálogo de cartas en Carpetazo!', url });
      else { await navigator.clipboard.writeText(url); showToast('Enlace copiado', 'success'); }
    } catch (error) {
      if (error?.name === 'AbortError') return; // cerró el menú de compartir sin enviar
      try { await navigator.clipboard.writeText(url); showToast('Enlace copiado', 'success'); } catch (_error) { showToast('No se pudo copiar el enlace.', 'error'); return; }
    }
    api.markOnboardingShared().then(load).catch(() => {});
  };

  const hide = () => {
    setHidden(true);
    try { localStorage.setItem(hiddenKey(uid), '1'); } catch (_error) { /* sin almacenamiento: solo dura esta visita */ }
  };

  if (failed && !state) return foldersCount === 0 ? <FolderEmptySteps /> : null;
  if (!state || state.complete || hidden) return null;

  const current = state.steps.find((step) => !step.done)?.key;
  const action = (key) => {
    if (key === 'profile') return { to: '/perfil' };
    if (key === 'folder') return { onClick: onCreateFolder };
    if (key === 'cards') return state.folderId ? { to: `/carpeta/${state.folderId}` } : { onClick: onCreateFolder };
    return { onClick: share };
  };
  const percent = Math.round((state.done / state.total) * 100);

  return (
    <section aria-labelledby="onboarding-title" className="mb-6 overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(26,43,75,0.06)] ring-1 ring-slate-900/5">
      <div className="flex items-start justify-between gap-3 p-4 pb-3 sm:p-6 sm:pb-4">
        <div className="min-w-0">
          <h2 id="onboarding-title" className="text-lg font-extrabold text-[#12315f] sm:text-xl">Empieza a vender en Carpetazo</h2>
          <p className="mt-0.5 text-sm text-slate-600">{state.done} de {state.total} pasos · tu carpeta lista en minutos</p>
        </div>
        <button type="button" onClick={hide} className="-mr-2 -mt-1 inline-flex h-11 shrink-0 items-center rounded-lg px-3 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">Ocultar</button>
      </div>
      <div className="mx-4 h-2 overflow-hidden rounded-full bg-[#dbeafe] sm:mx-6" role="progressbar" aria-valuemin={0} aria-valuemax={state.total} aria-valuenow={state.done} aria-label="Avance de tus primeros pasos">
        <div className="h-full rounded-full bg-gradient-to-r from-[#1e40af] to-[#facc15] transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${Math.max(percent, 6)}%` }} />
      </div>
      <ol className="mt-2 divide-y divide-slate-100 pb-2">
        {state.steps.map((step) => {
          const copy = COPY[step.key];
          const isCurrent = step.key === current;
          const go = action(step.key);
          const buttonClass = `inline-flex h-11 w-full items-center justify-center rounded-full px-5 text-sm font-extrabold transition-[filter,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 sm:w-auto ${isCurrent ? 'bg-[#facc15] text-[#12315f] shadow-sm hover:brightness-95' : 'bg-[#dbeafe] text-[#1e40af] hover:bg-[#bfdbfe]'}`;
          return (
            <li key={step.key} className={`flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-6 ${isCurrent ? 'bg-[#f5f9ff]' : ''}`}>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${step.done ? 'bg-[#1e40af] text-white' : isCurrent ? 'bg-[#facc15] text-[#12315f]' : 'bg-slate-100 text-slate-500'}`}>
                  <span translate="no" className="material-symbols-outlined text-[22px]">{step.done ? 'check' : copy.icon}</span>
                </span>
                <span className="min-w-0">
                  <span className={`block text-[15px] font-extrabold ${step.done ? 'text-slate-500 line-through decoration-slate-300' : 'text-[#12315f]'}`}>{copy.title}{step.done && <span className="sr-only"> (hecho)</span>}</span>
                  {!step.done && <span className="mt-0.5 block text-sm text-slate-600">{copy.text(step)}</span>}
                </span>
              </div>
              {!step.done && (go.to
                ? <Link to={go.to} className={buttonClass}>{copy.cta}</Link>
                : <button type="button" onClick={go.onClick} className={buttonClass}>{copy.cta}</button>)}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
