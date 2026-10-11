import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import useEscape from '../../hooks/useEscape';

// Hoja del chat: en el celular sube desde abajo (se cierra tocando fuera, con Esc o arrastrando hacia abajo); en pantalla ancha es un cuadro centrado.
// `full` la abre a pantalla completa en el celular (para listas largas). El foco entra a la hoja y vuelve al cerrar.
export default function Sheet({ open, onClose, title, children, full = false, labelledBy, className = '', hideHeader = false, z = 'z-[80]' }) {
  const ref = useRef(null);
  const drag = useRef(null);
  useBodyScrollLock(open);

  useEscape(open, onClose);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    ref.current?.focus({ preventScroll: true });
    return () => { previous?.focus?.({ preventScroll: true }); };
  }, [open]);

  if (!open) return null;

  // Arrastrar hacia abajo desde el borde superior cierra la hoja
  const start = (event) => { drag.current = { y: event.touches[0].clientY, dy: 0 }; };
  const move = (event) => {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, event.touches[0].clientY - drag.current.y);
    if (ref.current) ref.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const end = () => {
    const dy = drag.current?.dy || 0;
    drag.current = null;
    if (ref.current) ref.current.style.transform = '';
    if (dy > 90) onClose();
  };

  return createPortal(
    <div className={`fixed inset-0 ${z} flex items-end justify-center sm:items-center`} role="presentation">
      <button type="button" aria-label="Cerrar" tabIndex={-1} onClick={onClose} className="chat-fade absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`chat-sheet relative flex w-full flex-col overflow-hidden bg-white shadow-[0_-12px_40px_-12px_rgba(8,18,42,0.45)] outline-none transition-transform duration-150 ease-out sm:max-w-md sm:rounded-3xl ${full ? 'h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[86dvh]' : 'max-h-[88dvh] rounded-t-3xl sm:max-h-[86dvh]'} ${className}`}
      >
        {!hideHeader && (
          <div onTouchStart={start} onTouchMove={move} onTouchEnd={end} className="shrink-0 touch-none">
            <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300 sm:hidden" />
            {title && (
              <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3">
                <h2 id={labelledBy} className="text-lg font-extrabold text-[#12315f]">{title}</h2>
                <button type="button" onClick={onClose} aria-label="Cerrar" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
                  <span translate="no" aria-hidden="true" className="material-symbols-outlined">close</span>
                </button>
              </div>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
