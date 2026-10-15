import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import { ButtonSpinner } from '../ui/LoadingState';

// Piezas compartidas por las cargas del catálogo: la de Mitos y Leyendas y la de TCGplayer
export const STEPS = ['Elegir archivo', 'Revisar', 'Cargar'];

export const sizeLabel = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function Stepper({ current }) {
  return (
    <ol aria-label="Pasos de la carga" className="mb-5 flex items-center gap-2 text-sm font-bold">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} aria-current={active ? 'step' : undefined} className="flex min-w-0 items-center gap-2">
            {index > 0 && <span aria-hidden="true" className={`h-px w-4 sm:w-8 ${done || active ? 'bg-[#1e40af]' : 'bg-slate-300'}`} />}
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs tabular-nums transition-colors duration-200 ${done ? 'bg-[#1e40af] text-white' : active ? 'bg-[#12315f] text-[#facc15]' : 'bg-slate-200 text-slate-500'}`}>
              {done ? <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[16px]">check</span> : index + 1}
            </span>
            <span className={`truncate ${active ? 'text-[#12315f]' : done ? 'text-slate-700' : 'text-slate-500'} ${active ? '' : 'max-sm:hidden'}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// Aviso de confirmación antes de escribir en la base real. Interrumpe a propósito: la carga no se deshace desde aquí.
export function ConfirmDialog({ count, updates = 0, busy, onCancel, onConfirm }) {
  const cancelRef = useRef(null);
  useBodyScrollLock(true);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);
  return createPortal(
    <div className="sheet-backdrop fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/55 p-3 sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="catalog-confirm-title" className="mod-confirm-in w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fef3c7] text-[#92400e]"><span translate="no" aria-hidden="true" className="material-symbols-outlined text-[28px]">library_add</span></span>
        <h2 id="catalog-confirm-title" className="mt-4 text-xl font-extrabold text-[#12315f]">¿Cargar {[count > 0 && `${count} ${count === 1 ? 'carta nueva' : 'cartas nuevas'}`, updates > 0 && `${updates} ${updates === 1 ? 'corrección' : 'correcciones'}`].filter(Boolean).join(' y ')}?</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Las nuevas se agregan a la base de datos de Carpetazo y las correcciones cambian el nombre, la imagen, los datos y, si corresponde, la edición de cartas que ya existen. Esta carga no se deshace desde aquí.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel} className="h-12 rounded-full border-2 border-slate-300 text-sm font-extrabold text-slate-700 transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <button type="button" disabled={busy} onClick={onConfirm} className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#facc15] text-sm font-extrabold text-[#12315f] transition-[filter,transform] duration-150 active:scale-[0.97] hover:brightness-95 disabled:opacity-70">
            {busy && <ButtonSpinner tone="dark" />}
            {busy ? 'Cargando…' : 'Sí, cargar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
