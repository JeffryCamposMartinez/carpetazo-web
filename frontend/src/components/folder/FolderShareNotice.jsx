import { useState } from 'react';
import { api } from '../../services/api';

// Tras guardar la primera carta: invita a publicar la carpeta y compartir su enlace (copiar o WhatsApp).
// Una carpeta privada no la ve nadie, así que publicar es el paso que falta para vender.
export default function FolderShareNotice({ folder, onPublished, onClose, showToast }) {
  const [busy, setBusy] = useState(false);
  const isPublic = Boolean(folder.isPublic);
  const url = `${window.location.origin}/c/${folder.id}`;

  const ensurePublic = async () => {
    if (isPublic) return true;
    try {
      await api.updateFolder(folder.id, { isPublic: true });
      onPublished();
      return true;
    } catch (error) {
      showToast(error.message || 'No se pudo publicar la carpeta', 'error');
      return false;
    }
  };

  const copyLink = async () => {
    setBusy(true);
    if (await ensurePublic()) {
      try {
        await navigator.clipboard.writeText(url);
        showToast(isPublic ? 'Enlace copiado' : 'Carpeta publicada y enlace copiado', 'success');
        onClose();
      } catch (_error) {
        showToast('La carpeta quedó publicada, pero no se pudo copiar el enlace.', 'error');
      }
    }
    setBusy(false);
  };

  const shareWhatsapp = async () => {
    setBusy(true);
    if (await ensurePublic()) {
      const text = `Mira mi catálogo de cartas "${folder.name}" en Carpetazo: ${url}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      onClose();
    }
    setBusy(false);
  };

  const button = 'flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-bold transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2';

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-4 sm:left-auto sm:right-4 sm:px-0 sm:pb-0">
      <div role="dialog" aria-label="Publica y comparte tu carpeta" className="auth-sheet w-full max-w-md rounded-2xl bg-white p-4 shadow-[0_18px_50px_-12px_rgba(8,18,42,0.55)] ring-1 ring-slate-900/10 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#facc15] text-[#12315f]">
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[24px]">celebration</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold text-[#12315f]">¡Ya cargaste tu primera carta!</p>
            <p className="mt-0.5 text-sm text-slate-600">
              {isPublic ? 'Tu carpeta ya es pública. Comparte el enlace para que te compren.' : 'Tu carpeta es privada: nadie más la ve. Publícala y comparte el enlace para empezar a vender.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar aviso" className="-mr-1.5 -mt-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <div className="mt-3 space-y-2">
          <button type="button" disabled={busy} onClick={copyLink} className={`${button} bg-[#1e40af] text-white hover:bg-[#12315f]`}>
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px]">link</span>
            {isPublic ? 'Copiar enlace' : 'Publicar y copiar enlace'}
          </button>
          <button type="button" disabled={busy} onClick={shareWhatsapp} className={`${button} bg-[#25D366] text-white hover:bg-[#128C7E]`}>
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px]">share</span>
            {isPublic ? 'Compartir por WhatsApp' : 'Publicar y compartir por WhatsApp'}
          </button>
          <button type="button" onClick={onClose} className={`${button} text-slate-600 hover:bg-slate-100`}>Más tarde</button>
        </div>
      </div>
    </div>
  );
}
