import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import { LoadingMark } from './LoadableImage';
import { cardCorners } from '../../utils/cardShape';

const formatCLP = (value) => `$${Number(value || 0).toLocaleString('es-CL')}`;
const LANGUAGES = { English: 'Inglés', Spanish: 'Español', Japanese: 'Japonés' };

// Datos que se muestran bajo la carta en el inventario: edición, idioma, precio y stock
const describeInventoryCard = (card) => ({
  subtitle: [card.set, LANGUAGES[card.language || card.data?.language]].filter(Boolean).join(' · '),
  chips: [Number(card.price || 0) > 0 ? formatCLP(card.price) : 'Sin precio', Number(card.stock || 0) > 0 ? `${card.stock} en stock` : 'Sin stock'],
});

const SWIPE_DISTANCE = 70; // px que hay que arrastrar para cambiar de carta (o menos si el gesto es rápido)
const SWIPE_SPEED = 0.35; // px por ms
const CLOSE_DISTANCE = 110; // arrastrar hacia abajo o arriba esta distancia cierra el visor

// Carta en grande con sus datos. En el celular se pasa arrastrando hacia los lados (y se cierra arrastrando hacia abajo);
// en PC, con las flechas del teclado o los botones a los lados.
// `describe(card)` devuelve { subtitle, chips, note } para mostrar otros datos (por defecto, los del inventario).
// `renderActions(card)` pone botones (por ejemplo "Agregar") bajo la carta, para actuar sin salir del visor.
export default function CardLightbox({ cards, cardId, onChange, onClose, tcg, describe = describeInventoryCard, renderActions }) {
  const index = cards.findIndex((card) => card.id === cardId);
  const card = cards[index];
  const closeRef = useRef(null);
  const [loadedId, setLoadedId] = useState(null); // carta cuya imagen ya cargó: mientras tanto se muestra el logo con el espiral
  const [failedId, setFailedId] = useState(null);
  const [ratios, setRatios] = useState({}); // proporción (ancho/alto) de la imagen de cada carta, para que sus esquinas redondeadas sean las de la carta y no las de una caja más ancha
  const state = useRef({});
  state.current = { index, cards, onChange, onClose };
  useBodyScrollLock();

  // Arrastre con el dedo (o el mouse): la carta sigue al puntero y al soltar cambia, se cierra o vuelve a su lugar
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [direction, setDirection] = useState(0); // hacia dónde se fue la última vez, para que la nueva carta entre desde ese lado
  const gesture = useRef(null);
  const go = (step) => {
    const target = cards[index + step];
    if (!target) return false;
    setDirection(step);
    onChange(target.id);
    return true;
  };
  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    gesture.current = { x: event.clientX, y: event.clientY, at: Date.now(), id: event.pointerId };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_error) { /* el navegador no permite capturar este puntero: el arrastre sigue dentro del área */ }
  };
  const onPointerMove = (event) => {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    let x = event.clientX - start.x;
    const y = event.clientY - start.y;
    if (Math.abs(y) > Math.abs(x)) { setDrag({ x: 0, y, active: true }); return; }
    // Sin carta anterior o siguiente, el arrastre se frena
    if ((x > 0 && index <= 0) || (x < 0 && index >= cards.length - 1)) x *= 0.3;
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
    if (Math.abs(y) > Math.abs(x)) { if (Math.abs(y) > CLOSE_DISTANCE) onClose(); return; }
    if (Math.abs(x) > SWIPE_DISTANCE || (speed > SWIPE_SPEED && Math.abs(x) > 25)) go(x < 0 ? 1 : -1);
  };

  useEffect(() => {
    const trigger = document.activeElement;
    closeRef.current?.focus();
    const onKey = (event) => {
      const { index: at, cards: list, onChange: change, onClose: close } = state.current;
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight' && at < list.length - 1) change(list[at + 1].id);
      if (event.key === 'ArrowLeft' && at > 0) change(list[at - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (trigger && typeof trigger.focus === 'function') trigger.focus();
    };
  }, []);

  // La carta puede desaparecer de la vista (borrada o movida mientras estaba abierta)
  useEffect(() => { if (!card) onClose(); }, [card, onClose]);
  if (!card) return null;

  const info = describe(card);
  const nav = 'absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#12315f] shadow-lg transition-[transform,opacity] duration-150 active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] disabled:opacity-30';

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={card.name} className="fixed inset-0 z-[1300] flex flex-col bg-[#08122a]/90 backdrop-blur-sm" onClick={onClose}>
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] text-white" onClick={(event) => event.stopPropagation()}>
        <p className="min-w-0 truncate text-sm font-bold tabular-nums text-white/80">{cards.length > 1 ? `${index + 1} de ${cards.length}` : ''}</p>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition-[background-color,transform] duration-150 hover:bg-white/20 active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[24px]">close</span>
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden px-3 [container-type:size]"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {/* Botones a los lados: solo donde hay mouse; en pantallas táctiles se arrastra */}
        {card.imageUrl && loadedId !== card.id && <LoadingMark still={failedId === card.id} className="absolute inset-0 scale-125" />}
        <button type="button" aria-label="Carta anterior" disabled={index <= 0} onClick={() => go(-1)} onPointerDown={(event) => event.stopPropagation()} className={`${nav} left-2 hidden sm:left-6 [@media(hover:hover)]:flex ${cards.length < 2 ? "!hidden" : ""}`}>
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[28px]">chevron_left</span>
        </button>
        <div
          key={card.id}
          className={`flex h-full max-w-full items-center justify-center ${direction === 0 ? '' : direction > 0 ? 'lightbox-in-next' : 'lightbox-in-prev'}`}
          style={{ transform: `translate(${drag.x}px, ${drag.y}px) scale(${1 - Math.min(Math.abs(drag.y), 300) / 1500})`, opacity: 1 - Math.min(Math.abs(drag.y), 300) / 500, transition: drag.active ? 'none' : 'transform 220ms cubic-bezier(0.23, 1, 0.32, 1), opacity 220ms ease-out' }}
        >
          {card.imageUrl
            ? <img
              src={card.imageUrl}
              referrerPolicy="no-referrer"
              alt={card.name}
              draggable={false}
              onLoad={(event) => { setLoadedId(card.id); const { naturalWidth, naturalHeight } = event.currentTarget; if (naturalWidth && naturalHeight) setRatios((prev) => ({ ...prev, [card.id]: naturalWidth / naturalHeight })); }}
              onError={() => setFailedId(card.id)}
              ref={(img) => { if (img?.complete && img.naturalWidth > 0 && loadedId !== card.id) { setLoadedId(card.id); setRatios((prev) => (prev[card.id] ? prev : { ...prev, [card.id]: img.naturalWidth / img.naturalHeight })); } }}
              // Misma altura para todas las cartas; si no cabe a lo ancho, se reduce sin dejar bordes vacíos (el redondeo queda en la carta)
              style={{ aspectRatio: ratios[card.id] || 63 / 88, height: `min(100cqh, calc((100cqw - 1.5rem) / ${ratios[card.id] || 63 / 88}))`, width: 'auto', ...cardCorners(card.tcg || card.game || tcg) }}
              className={`rounded-2xl object-contain shadow-2xl transition-opacity duration-200 ${loadedId === card.id ? 'opacity-100' : 'opacity-0'}`}
            />
            : <span className="rounded-2xl bg-white/10 px-6 py-10 text-sm font-bold text-white/70">Sin imagen</span>}
        </div>
        <button type="button" aria-label="Carta siguiente" disabled={index >= cards.length - 1} onClick={() => go(1)} onPointerDown={(event) => event.stopPropagation()} className={`${nav} right-2 hidden sm:right-6 [@media(hover:hover)]:flex ${cards.length < 2 ? "!hidden" : ""}`}>
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[28px]">chevron_right</span>
        </button>
      </div>
      {cards.length > 1 && <p className="pointer-events-none shrink-0 pb-1 text-center text-[11px] font-semibold text-white/50 [@media(hover:hover)]:hidden" aria-hidden="true">Desliza para ver las demás</p>}

      <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-center text-white" onClick={(event) => event.stopPropagation()}>
        <p className="line-clamp-2 text-base font-extrabold leading-tight">{card.name}</p>
        <p className="mt-0.5 text-xs text-white/70">{info.subtitle || ' '}</p>
        {info.chips?.length > 0 && (
          <p className="mt-2 inline-flex flex-wrap justify-center gap-x-3 gap-y-1 rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold tabular-nums">
            {info.chips.map((chip, index) => (
              <span key={chip} className="inline-flex items-center gap-3">{index > 0 && <span className="text-white/40" aria-hidden="true">|</span>}{chip}</span>
            ))}
          </p>
        )}
        {info.note && <p className="mx-auto mt-2 max-w-sm text-xs italic text-white/70">{info.note}</p>}
        {renderActions && <div className="mx-auto mt-3 flex w-full max-w-xs justify-center">{renderActions(card)}</div>}
      </div>
    </div>,
    document.body
  );
}
