import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SafeImage } from './SafeImage';
import SvgIcon from '../ui/SvgIcon';
import { CardSideWing } from '../ui/CardNeighbors';
import { cardRatio, fullscreenCorners, tcgplayerCardImage } from '../../utils/cardShape';

const ARROW = 'absolute top-1/2 z-20 flex h-11 w-11 sm:h-12 sm:w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#12315f] shadow-lg transition-[transform,opacity,background-color] duration-150 hover:bg-white active:scale-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#facc15] disabled:pointer-events-none disabled:opacity-25';
const SWIPE_DISTANCE = 70;
const SWIPE_SPEED = 0.35;
const CLOSE_DISTANCE = 110;

// Carta a pantalla completa para agregarla a la carpeta: se pasa a la anterior o a la siguiente de los resultados (arrastrando, flechas o teclado)
// y en móvil el formulario para agregarla se puede abrir u ocultar para dejar toda la pantalla a la carta.
export default function AddCardFullscreen({ card, list, onPick, onClose, imageSrc, srcOf, tcg, onImageFail, onUpload, children }) {
  const index = list.findIndex((item) => item.id === card.id);
  const [ratioW, ratioH] = cardRatio(tcg).split('/').map(Number);
  const ratio = ratioW / ratioH;
  const [mobileFormOpen, setMobileFormOpen] = useState(false);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [direction, setDirection] = useState(0); // hacia dónde se fue la última vez, para que la nueva carta entre desde ese lado con la misma animación que en /cartas
  const gesture = useRef(null);

  const previous = index > 0 ? list[index - 1] : null;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null;
  const hasNeighbors = list.length > 1 && index >= 0;

  const go = (step) => {
    const target = list[index + step];
    if (!target) return false;
    setDirection(step);
    onPick(target);
    return true;
  };

  useEffect(() => {
    setDrag({ x: 0, y: 0, active: false });
  }, [card?.id]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') { onClose(); return; }
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || '')) return; // las flechas dentro de un campo no cambian de carta
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [index, list, onClose]);

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.target?.closest?.('button, input, textarea, select')) return;
    gesture.current = { x: event.clientX, y: event.clientY, at: Date.now(), id: event.pointerId };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_err) { /* ignore */ }
  };

  const onPointerMove = (event) => {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    let x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (Math.abs(y) > Math.abs(x)) { setDrag({ x: 0, y, active: true }); return; }
    // Sin carta anterior o siguiente, el arrastre se frena
    if ((x > 0 && index <= 0) || (x < 0 && index >= list.length - 1)) x *= 0.3;
    setDrag({ x, y: 0, active: true });
  };

  const onPointerEnd = (event) => {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    gesture.current = null;
    const x = event.clientX - start.x;
    const y = event.clientY - start.y;
    const speed = Math.abs(x) / Math.max(1, Date.now() - start.at);
    setDrag({ x: 0, y: 0, active: false });
    if (Math.abs(y) > Math.abs(x)) {
      if (Math.abs(y) > CLOSE_DISTANCE) onClose();
      return;
    }
    if (Math.abs(x) > SWIPE_DISTANCE || (speed > SWIPE_SPEED && Math.abs(x) > 25)) {
      go(x < 0 ? 1 : -1);
    }
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`${card.name}: agregar a la carpeta`} className="fixed inset-0 z-[2000] flex flex-col bg-[#071634]/95 backdrop-blur-sm lg:flex-row">
      <button type="button" onClick={onClose} aria-label="Cerrar pantalla completa" className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#12315f] shadow-lg transition-transform hover:bg-white active:scale-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#facc15]">
        <SvgIcon name="close" translate="no" className="text-[24px]" />
      </button>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className={`relative flex min-h-0 flex-1 touch-none select-none items-center justify-center gap-0 overflow-hidden px-2 pb-4 pt-14 [container-type:size] sm:gap-3.5 sm:px-14 lg:gap-5 lg:px-20 lg:pt-10 ${hasNeighbors ? '[--main-cqw:68cqw] sm:[--main-cqw:43cqw]' : '[--main-cqw:88cqw]'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <button type="button" onClick={() => go(-1)} disabled={!previous} aria-label="Carta anterior" className={`${ARROW} left-2 sm:left-3 lg:left-6`}>
            <SvgIcon name="chevron_left" translate="no" className="text-[28px] sm:text-[30px]" />
          </button>

          <CardSideWing side="left" cards={list} index={index} tcg={tcg} srcOf={srcOf} onPick={go} />

          <div
            key={card.id}
            className={`relative z-10 shrink-0 ${direction === 0 ? '' : direction > 0 ? 'lightbox-in-next' : 'lightbox-in-prev'}`}
            style={{
              aspectRatio: cardRatio(tcg),
              width: `min(var(--main-cqw), calc(96cqh * ${ratio}))`,
              height: `min(96cqh, calc(var(--main-cqw) / ${ratio}))`,
              transform: `translate(${drag.x}px, ${drag.y}px) scale(${1 - Math.min(Math.abs(drag.y), 300) / 1500})`,
              opacity: 1 - Math.min(Math.abs(drag.y), 300) / 500,
              transition: drag.active ? 'none' : 'transform 220ms cubic-bezier(0.23, 1, 0.32, 1), opacity 220ms ease-out',
            }}
          >
            <div className="relative h-full w-full overflow-hidden rounded-xl shadow-[0_24px_50px_rgba(0,0,0,0.65)]" style={fullscreenCorners(tcg)}>
              <SafeImage key={imageSrc || card.id} src={imageSrc} fallbackSrc={tcgplayerCardImage({ ...card, tcg })} alt={card.name} rotateLandscape style={fullscreenCorners(tcg)} className="pointer-events-none h-full w-full rounded-xl object-contain" fallbackType="zoom-main" onFail={(failed) => onImageFail?.(failed)} />
            </div>
            {onUpload && (
              <button type="button" onClick={onUpload} title="Subir foto real de la carta" aria-label="Subir foto real de la carta" className="absolute -bottom-3 -right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-[#1e40af] text-white shadow-lg transition-[transform,background-color] hover:bg-blue-800 active:scale-90">
                <SvgIcon name="photo_camera" translate="no" className="text-[20px]" />
              </button>
            )}
          </div>

          <CardSideWing side="right" cards={list} index={index} tcg={tcg} srcOf={srcOf} onPick={go} />

          <button type="button" onClick={() => go(1)} disabled={!next} aria-label="Carta siguiente" className={`${ARROW} right-2 sm:right-3 lg:right-6`}>
            <SvgIcon name="chevron_right" translate="no" className="text-[28px] sm:text-[30px]" />
          </button>
          {index >= 0 && list.length > 1 && (
            <span className="absolute left-4 top-4 z-20 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tabular-nums text-white">{index + 1} / {list.length}</span>
          )}
        </div>

        {/* Barra inferior en móvil cuando el formulario está oculto: deja máximo espacio a la carta y permite abrir las opciones de guardado */}
        {!mobileFormOpen && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-[#0b1f47]/95 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3 text-white lg:hidden">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold leading-tight text-white">{card.name}</p>
              <p className="truncate text-xs text-blue-200/80">Desliza la carta para cambiar · Toca para agregar</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileFormOpen(true)}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#25D366] px-5 text-sm font-extrabold text-white shadow-lg transition-transform active:scale-95"
            >
              <SvgIcon name="add_circle" translate="no" className="text-[20px]" />
              Agregar carta
            </button>
          </div>
        )}
      </div>

      {/* Panel de datos para guardar: siempre visible a la derecha en PC; desplegable a elección en móvil */}
      <div className={`${mobileFormOpen ? 'flex max-h-[58vh]' : 'hidden'} min-h-0 flex-col overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-12px_30px_rgba(0,0,0,0.35)] lg:flex lg:max-h-none lg:w-[430px] lg:flex-none lg:rounded-none lg:px-7 lg:pb-7 lg:pt-16 lg:shadow-none`}>
        <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-2.5 lg:hidden">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#1e40af]">Datos para agregar a carpeta</span>
          <button
            type="button"
            onClick={() => setMobileFormOpen(false)}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-[#12315f] transition-colors hover:bg-slate-200 active:scale-95"
          >
            <SvgIcon name="expand_more" translate="no" className="text-[18px]" />
            Ocultar opciones
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
