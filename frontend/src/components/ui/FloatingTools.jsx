import { useEffect, useState } from 'react';
import { scrollToTopThen } from '../../utils/scrollToTopThen';

const SHOW_AFTER_PX = 600;
const smooth = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

// Botones flotantes de una lista larga: «Volver arriba», que aparece al bajar, y «Limpiar filtros» (si se pasa `onClear`),
// que primero sube a la primera carta y después quita los filtros.
// Va dentro del panel de la página: el contenedor «sticky» de altura 0 lo deja pegado abajo sin tapar el contenido ni el pie.
export default function FloatingTools({ onClear }) {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="pointer-events-none sticky bottom-5 z-30 h-0 w-full md:bottom-8">
      <div className="pointer-events-auto absolute bottom-0 right-[-0.25rem] flex flex-col items-center gap-2.5 sm:right-[-1rem]">
        {onClear && (
          <button
            type="button"
            onClick={() => scrollToTopThen(onClear)}
            title="Limpiar filtros"
            aria-label="Limpiar filtros"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-600 shadow-[0_2px_4px_rgba(8,18,42,0.18),0_10px_22px_-8px_rgba(8,18,42,0.45)] ring-1 ring-slate-200 transition-[color,transform] duration-150 hover:text-[#1e40af] active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
          >
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[24px]">filter_alt_off</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: smooth() })}
          title="Volver arriba"
          aria-label="Volver arriba"
          tabIndex={showTop ? 0 : -1}
          aria-hidden={!showTop}
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-[#1e40af] text-white shadow-[0_2px_4px_rgba(8,18,42,0.25),0_10px_22px_-8px_rgba(30,64,175,0.7)] ring-2 ring-white/40 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.94] focus:outline-none focus-visible:ring-white motion-reduce:transition-opacity ${showTop ? 'scale-100 opacity-100' : 'pointer-events-none scale-90 opacity-0'}`}
        >
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[26px]">arrow_upward</span>
        </button>
      </div>
    </div>
  );
}
