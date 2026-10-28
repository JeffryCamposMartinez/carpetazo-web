import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';

export const GALLERY_MAX = 5;

// El dueño agrega o quita las fotos extra de su carta (hasta 5, con cualquier plan). Se ven en la ficha de la carta y en su carpeta pública.
export default function CardPhotosModal({ folderId, card, onClose, onChange }) {
  const { showToast } = useToast();
  const input = useRef(null);
  const [photos, setPhotos] = useState(card.photos || []);
  const [busy, setBusy] = useState('');
  useBodyScrollLock(true);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const apply = (next) => { setPhotos(next); onChange(card.id, next); };

  const add = async (files) => {
    const list = [...files].slice(0, GALLERY_MAX - photos.length);
    if (!list.length) return;
    setBusy('add');
    let current = photos;
    try {
      for (const file of list) {
        if (!file.type.startsWith('image/')) { showToast('Sube solo imágenes', 'error'); continue; }
        const form = new FormData();
        form.append('image', file);
        form.append('type', 'card');
        const uploaded = await api.uploadImage(form);
        const res = await api.addCardPhoto(folderId, card.id, uploaded.url);
        current = res.photos;
        apply(current);
      }
    } catch (error) {
      showToast(error.message || 'No se pudo agregar la foto.', 'error');
    } finally {
      setBusy('');
    }
  };

  const remove = async (photo) => {
    setBusy(photo.id);
    try {
      apply((await api.deleteCardPhoto(folderId, card.id, photo.id)).photos);
    } catch (error) {
      showToast(error.message || 'No se pudo quitar la foto.', 'error');
    } finally {
      setBusy('');
    }
  };

  const full = photos.length >= GALLERY_MAX;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="card-photos-title" className="fixed inset-0 z-[220] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <div onClick={(event) => event.stopPropagation()} className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="card-photos-title" className="text-xl font-black text-[#12315f]">Fotos de tu carta</h2>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-600">{card.name}</p>
          </div>
          <button type="button" onClick={onClose} disabled={Boolean(busy)} aria-label="Cerrar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[#12315f] transition-[background-color,transform] duration-150 hover:bg-slate-200 active:scale-[0.95] disabled:opacity-50"><SvgIcon name="close" translate="no" className="text-[22px]" /></button>
        </div>
        <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-[#1a2b4b]">Muestra tu copia real: el frente, el reverso, las esquinas y cualquier detalle. Quien visite tu carta las verá como una galería. Puedes subir hasta {GALLERY_MAX} fotos por carta.</p>

        <ul className="mt-4 grid grid-cols-3 gap-2.5" aria-label="Fotos de la galería">
          {photos.map((photo, index) => (
            <li key={photo.id} className="relative aspect-[5/7] overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
              <img src={photo.url} alt={`Foto ${index + 1} de ${card.name}`} loading="lazy" className="h-full w-full object-cover" />
              <button type="button" onClick={() => remove(photo)} disabled={Boolean(busy)} aria-label={`Quitar la foto ${index + 1}`} className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white shadow transition-[background-color,transform] duration-150 hover:bg-red-700 active:scale-[0.95] disabled:opacity-60">
                {busy === photo.id ? <ButtonSpinner /> : <SvgIcon name="delete" translate="no" className="text-[18px]" />}
              </button>
            </li>
          ))}
          {!full && (
            <li>
              <input ref={input} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={(event) => { add(event.target.files || []); event.target.value = ''; }} />
              <button type="button" disabled={Boolean(busy)} onClick={() => input.current?.click()} className="flex aspect-[5/7] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#1e40af]/40 bg-[#eef4ff] px-2 text-center text-[#1e40af] transition-[background-color,border-color,transform] duration-150 hover:border-[#1e40af] hover:bg-[#e3edff] active:scale-[0.98] disabled:opacity-60">
                {busy === 'add' ? <ButtonSpinner tone="dark" /> : <SvgIcon name="photo_camera" translate="no" aria-hidden="true" className="text-[28px]" />}
                <span className="text-[13px] font-extrabold">{busy === 'add' ? 'Subiendo…' : 'Agregar foto'}</span>
              </button>
            </li>
          )}
        </ul>
        <p className="mt-3 text-center text-sm font-bold text-slate-600" aria-live="polite">{photos.length} de {GALLERY_MAX} fotos{full ? ' · Quita una para agregar otra' : ''}</p>
        <button type="button" onClick={onClose} disabled={Boolean(busy)} className="mt-4 h-12 w-full rounded-full bg-[#12315f] text-base font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-[#1e40af] active:scale-[0.98] disabled:opacity-60">Listo</button>
      </div>
    </div>,
    document.body
  );
}
