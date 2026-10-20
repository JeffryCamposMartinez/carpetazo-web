import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SafeImage } from './SafeImage';
import SvgIcon from '../ui/SvgIcon';
import CardNeighbors from '../ui/CardNeighbors';
import { cardCorners, cardRatio } from '../../utils/cardShape';

const ARROW = 'absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-[#12315f] shadow-lg transition-[transform,opacity,background-color] duration-150 hover:bg-white active:scale-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#facc15] disabled:pointer-events-none disabled:opacity-25';

// Carta a pantalla completa para agregarla a la carpeta: se pasa a la anterior o a la siguiente de los resultados (flechas o teclado)
// y ahí mismo están los datos para guardarla (`children`, el formulario).
export default function AddCardFullscreen({ card, list, onPick, onClose, imageSrc, srcOf, tcg, onImageFail, onUpload, children }) {
  const index = list.findIndex((item) => item.id === card.id);
  const [ratioW, ratioH] = cardRatio(tcg).split('/').map(Number);
  const ratio = ratioW / ratioH;
  const [brokenSrc, setBrokenSrc] = useState(null);
  const broken = !imageSrc || brokenSrc === imageSrc;
  const previous = index > 0 ? list[index - 1] : null;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null;

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') { onClose(); return; }
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || '')) return; // las flechas dentro de un campo no cambian de carta
      if (event.key === 'ArrowLeft' && previous) onPick(previous);
      if (event.key === 'ArrowRight' && next) onPick(next);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [previous, next, onPick, onClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`${card.name}: agregar a la carpeta`} className="fixed inset-0 z-[2000] flex flex-col bg-[#071634]/95 backdrop-blur-sm lg:flex-row">
      <button type="button" onClick={onClose} aria-label="Cerrar pantalla completa" className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#12315f] shadow-lg transition-transform hover:bg-white active:scale-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#facc15]">
        <SvgIcon name="close" translate="no" className="text-[24px]" />
      </button>

      <div className="relative flex h-[50vh] shrink-0 flex-col lg:h-auto lg:min-h-0 lg:flex-1">
       <div className="relative flex min-h-0 flex-1 items-center justify-center px-16 pb-3 pt-14 [container-type:size] lg:px-24 lg:pt-10">
        <button type="button" onClick={() => previous && onPick(previous)} disabled={!previous} aria-label="Carta anterior" className={`${ARROW} left-3 lg:left-8`}>
          <SvgIcon name="chevron_left" translate="no" className="text-[30px]" />
        </button>
        <div className="relative" style={{ aspectRatio: cardRatio(tcg), height: `min(100cqh, calc(100cqw / ${ratio}))` }}>
          {broken ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-gray-50 p-4 text-center shadow-2xl">
              <img src="/images/logos/logo_completo.webp" alt="" className="mb-3 max-h-[45%] w-2/3 max-w-[120px] object-contain opacity-40 grayscale" />
              <span className="text-base font-bold leading-tight text-gray-400">SIN IMAGEN</span>
            </div>
          ) : (
            <SafeImage key={imageSrc} src={imageSrc} alt={card.name} rotateLandscape style={cardCorners(tcg)} className="h-full w-full rounded-xl object-contain shadow-2xl" fallbackType="zoom-main" onFail={(failed) => { setBrokenSrc(failed); onImageFail?.(failed); }} />
          )}
          {onUpload && (
            <button type="button" onClick={onUpload} title="Subir foto real de la carta" aria-label="Subir foto real de la carta" className="absolute -bottom-3 -right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-[#1e40af] text-white shadow-lg transition-[transform,background-color] hover:bg-blue-800 active:scale-90">
              <SvgIcon name="photo_camera" translate="no" className="text-[20px]" />
            </button>
          )}
        </div>
        <button type="button" onClick={() => next && onPick(next)} disabled={!next} aria-label="Carta siguiente" className={`${ARROW} right-3 lg:right-8`}>
          <SvgIcon name="chevron_right" translate="no" className="text-[30px]" />
        </button>
        {index >= 0 && list.length > 1 && (
          <span className="absolute left-4 top-4 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tabular-nums text-white">{index + 1} / {list.length}</span>
        )}
       </div>
       <div className="lg:pb-4"><CardNeighbors cards={list} index={index} tcg={tcg} srcOf={srcOf} onPick={(step) => list[index + step] && onPick(list[index + step])} /></div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-t-3xl bg-white p-5 lg:w-[430px] lg:flex-none lg:rounded-none lg:px-7 lg:pb-7 lg:pt-16">
        {children}
      </div>
    </div>,
    document.body
  );
}
