import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import useEscape from '../../hooks/useEscape';
import { LoadingMark } from './LoadableImage';
import { CardSideWing } from './CardNeighbors';
import { cardRatio, fullscreenCorners, isYugioh, NO_IMAGE_CARD_URL, onCardImageError, tcgplayerCardImage } from '../../utils/cardShape';
import SvgIcon from './SvgIcon';

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
  const state = useRef({});
  state.current = { index, cards, onChange, onClose };
  useBodyScrollLock();
  useEscape(true, () => state.current.onClose()); // Esc cierra solo lo que está más arriba

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
      const { index: at, cards: list, onChange: change } = state.current;
      if (event.target?.closest?.('input, textarea, select')) return; // las flechas mueven el cursor del campo, no la carta
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
  const gameTcg = card.tcg || card.game || tcg;
  const ratio = isYugioh(gameTcg) ? 59 / 86 : 63 / 88;
  const fallbackUrl = tcgplayerCardImage({ ...card, tcg: gameTcg });
  const initialSrc = card.imageUrl || fallbackUrl || NO_IMAGE_CARD_URL;
  const nav = 'absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#12315f] shadow-lg transition-[transform,opacity] duration-150 active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] disabled:opacity-30';

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={card.name} className="fixed inset-0 z-[1300] flex flex-col bg-[#08122a]/90 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-white" onClick={(event) => event.stopPropagation()}>
        <p className="min-w-0 truncate text-sm font-bold tabular-nums text-white/80">{cards.length > 1 ? `${index + 1} de ${cards.length}` : ''}</p>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition-[background-color,transform] duration-150 hover:bg-white/20 active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
          <SvgIcon name="close" translate="no" aria-hidden="true" className="text-[24px]" />
        </button>
      </div>

      <div
        className={`relative flex min-h-0 flex-1 touch-none select-none items-center justify-center gap-0 overflow-hidden px-2 [container-type:size] sm:gap-3.5 sm:px-14 lg:gap-5 lg:px-20 ${cards.length > 1 ? '[--main-cqw:68cqw] sm:[--main-cqw:43cqw]' : '[--main-cqw:88cqw]'}`}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {/* Botones a los lados: solo donde hay mouse; en pantallas táctiles se arrastra */}
        {loadedId !== card.id && <LoadingMark still={failedId === card.id} className="absolute inset-0 scale-125" />}
        <button type="button" aria-label="Carta anterior" disabled={index <= 0} onClick={() => go(-1)} onPointerDown={(event) => event.stopPropagation()} className={`${nav} left-2 hidden sm:left-6 [@media(hover:hover)]:flex ${cards.length < 2 ? "!hidden" : ""}`}>
          <SvgIcon name="chevron_left" translate="no" aria-hidden="true" className="text-[28px]" />
        </button>

        <CardSideWing side="left" cards={cards} index={index} tcg={tcg} onPick={go} />

        <div
          key={card.id}
          className={`relative z-10 flex shrink-0 items-center justify-center ${direction === 0 ? '' : direction > 0 ? 'lightbox-in-next' : 'lightbox-in-prev'}`}
          style={{
            aspectRatio: cardRatio(gameTcg),
            width: `min(var(--main-cqw), calc(96cqh * ${ratio}))`,
            height: `min(96cqh, calc(var(--main-cqw) / ${ratio}))`,
            transform: `translate(${drag.x}px, ${drag.y}px) scale(${1 - Math.min(Math.abs(drag.y), 300) / 1500})`,
            opacity: 1 - Math.min(Math.abs(drag.y), 300) / 500,
            transition: drag.active ? 'none' : 'transform 220ms cubic-bezier(0.23, 1, 0.32, 1), opacity 220ms ease-out',
          }}
        >
          <img
            src={initialSrc}
            referrerPolicy="no-referrer"
            alt={card.name}
            draggable={false}
            onLoad={() => setLoadedId(card.id)}
            onError={(event) => {
              if (event.currentTarget.src === NO_IMAGE_CARD_URL) setFailedId(card.id);
              else onCardImageError(event, fallbackUrl);
            }}
            ref={(img) => { if (img?.complete && img.naturalWidth > 0 && loadedId !== card.id) setLoadedId(card.id); }}
            style={fullscreenCorners(gameTcg)}
            className={`h-full w-full rounded-2xl object-contain shadow-[0_24px_50px_rgba(0,0,0,0.65)] transition-opacity duration-200 ${loadedId === card.id ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>

        <CardSideWing side="right" cards={cards} index={index} tcg={tcg} onPick={go} />

        <button type="button" aria-label="Carta siguiente" disabled={index >= cards.length - 1} onClick={() => go(1)} onPointerDown={(event) => event.stopPropagation()} className={`${nav} right-2 hidden sm:right-6 [@media(hover:hover)]:flex ${cards.length < 2 ? "!hidden" : ""}`}>
          <SvgIcon name="chevron_right" translate="no" aria-hidden="true" className="text-[28px]" />
        </button>
      </div>
      {cards.length > 1 && <p className="pointer-events-none shrink-0 py-1 text-center text-[11px] font-semibold leading-tight text-white/55 [@media(hover:hover)]:hidden" aria-hidden="true">Desliza para ver las demás</p>}

      {/* Pie de altura fija: la carta de arriba mantiene siempre la misma posición y tamaño aunque cambien los textos o botones */}
      <div
        className={`flex shrink-0 flex-col items-center justify-start overflow-y-auto overscroll-contain px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1.5 text-center text-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${renderActions ? 'h-[calc(14.25rem+env(safe-area-inset-bottom,0px))] sm:h-[11rem]' : 'h-[calc(7.5rem+env(safe-area-inset-bottom,0px))]'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="max-w-full shrink-0 truncate text-base font-extrabold leading-snug">{card.name}</p>
        <p className="mt-0.5 max-w-full shrink-0 truncate text-xs leading-normal text-white/75">{info.subtitle || '\u00A0'}</p>
        {info.chips?.length > 0 && (
          <p className="mt-1.5 inline-flex max-w-full shrink-0 flex-wrap justify-center gap-x-2.5 gap-y-1 rounded-2xl bg-white/10 px-3.5 py-1 text-xs font-bold leading-snug tabular-nums sm:rounded-full sm:px-4 sm:py-1.5 sm:text-sm">
            {info.chips.map((chip, index) => (
              <span key={chip} className="inline-flex items-center gap-2.5">{index > 0 && <span className="text-white/40" aria-hidden="true">|</span>}{chip}</span>
            ))}
          </p>
        )}
        {info.note && <p className="mx-auto mt-1.5 max-w-xl shrink-0 line-clamp-2 text-[11px] leading-snug italic text-white/70 sm:text-xs">{info.note}</p>}
        {renderActions && <div className="mx-auto mt-2.5 flex w-full max-w-4xl shrink-0 justify-center">{renderActions(card)}</div>}
      </div>
    </div>,
    document.body
  );
}
