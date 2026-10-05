import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const formatCLP = (value) => `$${Number(value || 0).toLocaleString('es-CL')}`;
const LANGUAGES = { English: 'Inglés', Spanish: 'Español', Japanese: 'Japonés' };

// Carta en grande con sus datos. Flechas del teclado o botones para pasar a la anterior y a la siguiente de la vista actual.
export default function CardLightbox({ cards, cardId, onChange, onClose }) {
  const index = cards.findIndex((card) => card.id === cardId);
  const card = cards[index];
  const closeRef = useRef(null);
  const state = useRef({});
  state.current = { index, cards, onChange, onClose };
  useBodyScrollLock();

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

  const language = LANGUAGES[card.language || card.data?.language] || null;
  const nav = 'absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#12315f] shadow-lg transition-[transform,opacity] duration-150 active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] disabled:opacity-30';

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={card.name} className="fixed inset-0 z-[1300] flex flex-col bg-[#08122a]/90 backdrop-blur-sm" onClick={onClose}>
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] text-white" onClick={(event) => event.stopPropagation()}>
        <p className="min-w-0 truncate text-sm font-bold tabular-nums text-white/80">{index + 1} de {cards.length}</p>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition-[background-color,transform] duration-150 hover:bg-white/20 active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[24px]">close</span>
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3" onClick={(event) => event.stopPropagation()}>
        <button type="button" aria-label="Carta anterior" disabled={index <= 0} onClick={() => onChange(cards[index - 1].id)} className={`${nav} left-2 sm:left-6`}>
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[28px]">chevron_left</span>
        </button>
        {card.imageUrl
          ? <img src={card.imageUrl} referrerPolicy="no-referrer" alt={card.name} className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl" />
          : <span className="rounded-2xl bg-white/10 px-6 py-10 text-sm font-bold text-white/70">Sin imagen</span>}
        <button type="button" aria-label="Carta siguiente" disabled={index >= cards.length - 1} onClick={() => onChange(cards[index + 1].id)} className={`${nav} right-2 sm:right-6`}>
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[28px]">chevron_right</span>
        </button>
      </div>

      <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-center text-white" onClick={(event) => event.stopPropagation()}>
        <p className="line-clamp-2 text-base font-extrabold leading-tight">{card.name}</p>
        <p className="mt-0.5 text-xs text-white/70">{[card.set, language].filter(Boolean).join(' · ') || ' '}</p>
        <p className="mt-2 inline-flex gap-3 rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold tabular-nums">
          <span>{Number(card.price || 0) > 0 ? formatCLP(card.price) : 'Sin precio'}</span>
          <span className="text-white/40" aria-hidden="true">|</span>
          <span>{Number(card.stock || 0) > 0 ? `${card.stock} en stock` : 'Sin stock'}</span>
        </p>
      </div>
    </div>,
    document.body
  );
}
