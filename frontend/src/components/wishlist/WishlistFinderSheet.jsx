import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import WishlistCardFinder from './WishlistCardFinder';

// Móvil y tablet: el buscador de cartas ocupa toda la pantalla para que los resultados tengan espacio. Va al <body> para quedar sobre el encabezado.
export default function WishlistFinderSheet({ onClose, onAdd, addedKeys, busyKey, count, limit }) {
  const resetRef = useRef(null);
  const closeRef = useRef(null);
  // El padre se vuelve a pintar al agregar cartas: sin esta referencia el efecto se reiniciaría y devolvería el foco
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const trigger = document.activeElement;
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      if (trigger && typeof trigger.focus === 'function') trigger.focus();
    };
  }, []);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Agregar una carta" className="folder-sheet fixed inset-0 z-[200] flex flex-col bg-[#DBEAFE]">
      <div className="flex shrink-0 items-center gap-2 bg-white px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-[0_1px_0_rgba(26,43,75,0.08)]">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Cerrar buscador"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#12315f] transition-[background-color,transform] duration-150 hover:bg-slate-100 active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
        >
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[26px]">close</span>
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-extrabold leading-tight text-[#12315f]">Agregar carta</h2>
          <p className="text-xs font-semibold text-slate-500"><span className="tabular-nums">{count}</span> de {limit} en tu lista</p>
        </div>
        <button
          type="button"
          onClick={() => resetRef.current?.()}
          className="flex h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-bold text-[#1e40af] transition-[background-color,transform] duration-150 hover:bg-blue-50 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
        >
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">filter_alt_off</span>
          Limpiar
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-900/5">
          <WishlistCardFinder onAdd={onAdd} addedKeys={addedKeys} busyKey={busyKey} resetRef={resetRef} />
        </div>
      </div>
    </div>,
    document.body
  );
}
