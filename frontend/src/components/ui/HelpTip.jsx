import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HELP_TOPICS } from '../../config/helpTopics';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

// Botón «Ayuda» (con el «?» amarillo) a la derecha del título de una sección: abre una ayuda corta con los pasos (textos en config/helpTopics.js)
export default function HelpTip({ topic, className = '' }) {
  const help = HELP_TOPICS[topic];
  const [open, setOpen] = useState(false);
  const closeRef = useRef(null);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!help) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Ayuda: ${help.title}`} title="¿Cómo funciona?" className={`ml-auto inline-flex h-10 [@media(pointer:coarse)]:h-11 shrink-0 items-center gap-2 rounded-full bg-[#12315f] py-1 pl-1.5 pr-1.5 text-sm min-[440px]:pr-4 font-extrabold text-white shadow-[0_6px_14px_-6px_rgba(18,49,95,0.65)] transition-[background-color,transform] duration-150 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] focus-visible:ring-offset-2 [@media(hover:hover)]:hover:bg-[#1e40af] ${className}`}><span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-[#facc15] font-['Space_Grotesk'] text-base font-black leading-none text-[#12315f]">?</span><span className="hidden min-[440px]:inline">Ayuda</span></button>
      {open && createPortal(
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="help-title" className="flex max-h-[88svh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-start gap-3 p-5 pb-3">
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ffcb05] font-['Space_Grotesk'] text-xl font-bold text-[#1a2b4b]">?</span>
              <div className="min-w-0">
                <h2 id="help-title" className="text-lg font-extrabold tracking-tight text-[#12315f]">{help.title}</h2>
                <p className="mt-0.5 text-sm text-slate-600">{help.intro}</p>
              </div>
            </div>
            <div className="overflow-y-auto px-5 pb-2">
              <ol className="flex flex-col gap-3">
                {help.steps.map((step, index) => (
                  <li key={step} className="flex items-start gap-3 text-sm text-slate-700">
                    <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#12315f] text-xs font-extrabold text-white">{index + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {help.tip && <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-[#12315f] ring-1 ring-blue-100">{help.tip}</p>}
            </div>
            <div className="p-5 pt-3">
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="h-12 w-full rounded-full bg-[#ffcb05] text-sm font-extrabold text-[#1a2b4b] shadow-sm transition-transform duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">Entendido</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
