import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import useEscape from '../../hooks/useEscape';

const SWIPE_DISTANCE = 50;
const formatCLP = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;

const NavButton = ({ side, onClick }) => (
  <button type="button" onClick={onClick} aria-label={side === 'prev' ? 'Anterior' : 'Siguiente'} className={`absolute top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] sm:flex ${side === 'prev' ? 'left-3' : 'right-3'}`}>
    <span translate="no" aria-hidden="true" className="material-symbols-outlined">{side === 'prev' ? 'chevron_left' : 'chevron_right'}</span>
  </button>
);

// Fotos y cartas de la conversación a pantalla completa: se pasa a la anterior o siguiente deslizando o con las flechas.
// `items`: [{ id, src, card?: { id, name, set, price, private } }] en orden; `startId`: con cuál se abre.
export default function ImageViewer({ items, startId, onClose }) {
  const open = items.length > 0;
  const [currentId, setCurrentId] = useState(startId);
  const [zoom, setZoom] = useState(false);
  const [direction, setDirection] = useState(0);
  const touch = useRef(null);
  useBodyScrollLock(open);
  useEscape(open, onClose);
  useEffect(() => { setCurrentId(startId); setZoom(false); setDirection(0); }, [startId, open]);

  const found = items.findIndex((item) => item.id === currentId);
  const index = found >= 0 ? found : 0;
  const item = items[index];
  const go = (step) => {
    const next = index + step;
    if (next < 0 || next >= items.length) return;
    setDirection(step);
    setZoom(false);
    setCurrentId(items[next].id);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !item) return null;
  const card = item.card;

  const onTouchStart = (event) => { touch.current = event.touches.length === 1 && !zoom ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; };
  const onTouchEnd = (event) => {
    const start = touch.current;
    touch.current = null;
    if (!start || !event.changedTouches[0]) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? 1 : -1);
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={card ? card.name : 'Foto'} className="chat-fade fixed inset-0 z-[95] flex flex-col bg-black/95 text-white">
      <div className="flex shrink-0 items-center justify-between px-2 py-2">
        <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined">arrow_back</span>
        </button>
        {items.length > 1 && <span className="text-sm font-bold tabular-nums text-white/80" aria-live="polite">{index + 1} de {items.length}</span>}
        <a href={item.src} download target="_blank" rel="noopener noreferrer" aria-label="Descargar" className="flex h-12 w-12 items-center justify-center rounded-full transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined">download</span>
        </a>
      </div>
      <div className="relative min-h-0 flex-1" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {index > 0 && <NavButton side="prev" onClick={() => go(-1)} />}
        {index < items.length - 1 && <NavButton side="next" onClick={() => go(1)} />}
        <div onClick={onClose} className={`flex h-full items-center justify-center p-2 ${zoom ? 'overflow-auto' : ''}`}>
          <img
            key={item.id} src={item.src} alt={card ? card.name : 'Foto'} onClick={(event) => { event.stopPropagation(); setZoom((value) => !value); }} draggable="false"
            className={`${zoom ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain'} select-none rounded-md ${direction === 0 ? '' : direction > 0 ? 'viewer-in-next' : 'viewer-in-prev'}`}
            style={zoom ? { width: '180%' } : undefined}
          />
        </div>
      </div>
      {card && (
        <div className="shrink-0 bg-gradient-to-t from-black to-black/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-extrabold">{card.name}</p>
              {card.set && <p className="truncate text-[13px] text-white/70">{card.set}</p>}
              <p className="text-[20px] font-black tabular-nums text-[#facc15]">{Number(card.price) > 0 ? formatCLP(card.price) : 'Consultar'}</p>
            </div>
            {card.private
              ? <span className="shrink-0 text-xs font-bold text-white/60">Carta no publicada</span>
              : <Link to={`/carta/${card.id}`} onClick={onClose} className="flex h-11 shrink-0 items-center justify-center rounded-full bg-[#facc15] px-5 text-[14px] font-extrabold text-[#12315f] transition-[filter,transform] active:scale-[0.97] hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Ir a ver carta</Link>}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
