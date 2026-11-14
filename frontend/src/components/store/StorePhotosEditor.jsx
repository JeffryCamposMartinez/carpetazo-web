import { useRef, useState } from 'react';
import { api } from '../../services/api';
import SvgIcon from '../ui/SvgIcon';
import { ButtonSpinner } from '../ui/LoadingState';

const MAX_PHOTOS = 6;

// Hasta 6 fotos del local: se suben como las demás imágenes (type 'store') y la ficha guarda sus URLs
export default function StorePhotosEditor({ value = [], onChange, onError }) {
  const input = useRef(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (event) => {
    const files = [...(event.target.files || [])].slice(0, MAX_PHOTOS - value.length);
    event.target.value = '';
    if (!files.length) return;
    setUploading(true);
    const added = [];
    try {
      for (const file of files) {
        const form = new FormData();
        form.append('image', file);
        form.append('type', 'store');
        const r = await api.uploadImage(form);
        if (r?.url) added.push(r.url);
      }
    } catch (error) {
      onError?.(error.message || 'No se pudo subir la foto.');
    } finally {
      if (added.length) onChange([...value, ...added]);
      setUploading(false);
    }
  };

  return (
    <div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {value.map((url) => (
          <li key={url} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100">
            <img src={url} alt="Foto del local" className="h-full w-full object-cover" loading="lazy" />
            <button type="button" aria-label="Quitar foto" onClick={() => onChange(value.filter((u) => u !== url))} className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-slate-700 shadow transition hover:text-red-600 active:scale-[0.95]">
              <SvgIcon name="close" className="text-base" />
            </button>
          </li>
        ))}
        {value.length < MAX_PHOTOS && (
          <li>
            <button type="button" disabled={uploading} onClick={() => input.current?.click()} className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs font-bold text-slate-500 transition hover:border-[#1e40af] hover:text-[#1e40af] active:scale-[0.98] disabled:opacity-60">
              {uploading ? <ButtonSpinner /> : <SvgIcon name="photo_camera" className="text-2xl" />}
              {uploading ? 'Subiendo…' : 'Agregar'}
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={pick} />
      <p className="mt-2 text-xs text-slate-500">{value.length}/{MAX_PHOTOS} fotos · fachada, vitrina o mesas de juego.</p>
    </div>
  );
}
