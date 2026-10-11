import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import useEscape from '../../hooks/useEscape';

export const MAX_PHOTOS = 5;
const MAX_BYTES = 10 * 1024 * 1024;

// Vista previa antes de enviar fotos: se ve cada una, se le puede escribir un texto y quitar las que sobran
export default function ImagePreview({ files, onSend, onClose, onRemove }) {
  const [index, setIndex] = useState(0);
  const [captions, setCaptions] = useState({});
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);
  useBodyScrollLock(files.length > 0);
  const safe = Math.min(index, Math.max(0, files.length - 1));

  useEscape(files.length > 0, onClose);

  if (!files.length) return null;
  const send = () => onSend(files.map((file, at) => ({ file, caption: (captions[at] || '').trim() })));

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Enviar fotos" className="chat-fade fixed inset-0 z-[95] flex flex-col bg-[#0b1220] text-white">
      <div className="flex shrink-0 items-center justify-between px-2 py-2">
        <button type="button" onClick={onClose} aria-label="Cancelar" className="flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined">close</span>
        </button>
        <span className="text-sm font-bold text-white/80">{files.length > 1 ? `${safe + 1} de ${files.length}` : 'Vista previa'}</span>
        <span className="w-12" />
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-3">
        <img src={urls[safe]} alt={`Foto ${safe + 1}`} className="max-h-full max-w-full rounded-lg object-contain" />
      </div>
      {files.length > 1 && (
        <div className="hide-scrollbar flex shrink-0 gap-2 overflow-x-auto px-3 py-2">
          {urls.map((url, at) => (
            <div key={url} className="relative shrink-0">
              <button type="button" onClick={() => setIndex(at)} aria-label={`Ver foto ${at + 1}`} className={`block h-14 w-14 overflow-hidden rounded-lg ring-2 transition-[box-shadow] focus:outline-none focus-visible:ring-[#facc15] ${at === safe ? 'ring-[#facc15]' : 'ring-transparent opacity-70'}`}>
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
              <button type="button" onClick={() => onRemove(at)} aria-label={`Quitar foto ${at + 1}`} className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-800 shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
                <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex shrink-0 items-end gap-2 px-3 pt-2 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
        <input
          value={captions[safe] || ''}
          onChange={(event) => setCaptions((previous) => ({ ...previous, [safe]: event.target.value }))}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); send(); } }}
          maxLength={1000}
          aria-label="Texto de la foto"
          placeholder="Agrega un texto…"
          className="h-12 min-w-0 flex-1 rounded-full border-0 bg-white/10 px-5 text-[16px] text-white outline-none ring-1 ring-white/15 placeholder:text-white/60 focus:ring-2 focus:ring-[#facc15]"
        />
        <button type="button" onClick={send} aria-label="Enviar" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#facc15] text-[#12315f] shadow transition-[transform,filter] duration-150 hover:brightness-95 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined">send</span>
        </button>
      </div>
    </div>,
    document.body
  );
}

// Deja pasar solo imágenes del tamaño permitido; devuelve { files, error }
export const pickPhotos = (incoming, current = []) => {
  const images = incoming.filter((file) => file.type.startsWith('image/'));
  if (!images.length) return { files: current, error: 'Elige una imagen válida.' };
  if (images.some((file) => file.size > MAX_BYTES)) return { files: current, error: 'Cada foto debe pesar menos de 10 MB.' };
  const files = [...current, ...images].slice(0, MAX_PHOTOS);
  return { files, error: current.length + images.length > MAX_PHOTOS ? `Puedes enviar hasta ${MAX_PHOTOS} fotos a la vez.` : '' };
};
