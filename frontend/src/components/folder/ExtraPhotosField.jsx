import { useRef } from 'react';
import { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';
import { GALLERY_MAX } from '../cards/CardPhotosModal';

// Fotos extra de la copia que se está agregando (hasta 5, con cualquier plan): se suben al elegirlas y se guardan junto con la carta.
// La foto de portada es el botón de la cámara sobre la imagen; estas forman la galería que ve quien visite la carta.
export default function ExtraPhotosField({ photos, onAdd, onRemove, busy = false, disabled = false }) {
  const input = useRef(null);
  const full = photos.length >= GALLERY_MAX;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">Más fotos de tu copia</label>
        <span className="text-xs font-bold text-gray-500" aria-live="polite">{photos.length} de {GALLERY_MAX}</span>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Fotos extra de la carta">
        {photos.map((url, index) => (
          <li key={url} className="relative h-[4.5rem] w-[3.25rem] overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-300">
            <img src={url} alt={`Foto extra ${index + 1}`} className="h-full w-full object-cover" />
            <button type="button" onClick={() => onRemove(url)} disabled={disabled || busy} aria-label={`Quitar la foto extra ${index + 1}`} className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow transition-[background-color,transform] duration-150 hover:bg-red-700 active:scale-[0.92] disabled:opacity-60">
              <SvgIcon name="close" translate="no" className="text-[14px]" />
            </button>
          </li>
        ))}
        {!full && (
          <li>
            <input ref={input} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={(event) => { onAdd([...(event.target.files || [])]); event.target.value = ''; }} />
            <button type="button" onClick={() => input.current?.click()} disabled={disabled || busy} aria-label="Agregar fotos extra" className="flex h-[4.5rem] w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-[#1e40af]/40 bg-[#eef4ff] text-[#1e40af] transition-[background-color,border-color,transform] duration-150 hover:border-[#1e40af] hover:bg-[#e3edff] active:scale-[0.96] disabled:opacity-60">
              {busy ? <ButtonSpinner tone="dark" /> : <SvgIcon name="add" translate="no" aria-hidden="true" className="text-[22px]" />}
              <span className="text-[10px] font-extrabold leading-none">{busy ? 'Subiendo' : 'Foto'}</span>
            </button>
          </li>
        )}
      </ul>
      {photos.length === 0 && <p className="mt-1 text-xs text-gray-500">Opcional: frente, reverso o detalles de tu carta. Se ven como galería en su ficha.</p>}
    </div>
  );
}
