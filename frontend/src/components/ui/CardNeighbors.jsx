import { useState } from 'react';
import { cardRatio } from '../../utils/cardShape';

// Tamaños según la distancia a la carta actual: las más cercanas se ven más grandes y nítidas
const LOOK = {
  0: { height: 'h-[4.75rem] sm:h-[5.5rem]', opacity: 'opacity-100', ring: 'ring-2 ring-[#facc15]' },
  1: { height: 'h-14 sm:h-16', opacity: 'opacity-80', ring: 'ring-1 ring-white/30' },
  2: { height: 'h-10 sm:h-12', opacity: 'opacity-50', ring: 'ring-1 ring-white/20' },
};

function Thumb({ card, offset, src, tcg, onPick }) {
  const [failed, setFailed] = useState(false);
  const look = LOOK[Math.abs(offset)];
  return (
    <button
      type="button"
      onClick={offset === 0 ? undefined : () => onPick(offset)}
      aria-label={offset === 0 ? `${card.name} (actual)` : `${offset < 0 ? 'Anterior' : 'Siguiente'}: ${card.name}`}
      aria-current={offset === 0 ? 'true' : undefined}
      tabIndex={offset === 0 ? -1 : 0}
      onPointerDown={(event) => event.stopPropagation()}
      className={`${look.height} ${look.opacity} ${look.ring} shrink-0 overflow-hidden rounded-md bg-white/10 transition-[opacity,transform] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] ${offset === 0 ? 'cursor-default' : '[@media(hover:hover)]:hover:opacity-100 active:scale-95'}`}
      style={{ aspectRatio: cardRatio(tcg) }}
    >
      {src && !failed
        ? <img src={src} alt="" loading="lazy" draggable={false} referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover" />
        : <span className="flex h-full w-full items-center justify-center px-0.5 text-center text-[8px] font-bold leading-tight text-white/60">{card.name}</span>}
    </button>
  );
}

// Vista previa de las 2 cartas anteriores y las 2 siguientes de un visor a pantalla completa; al tocar una, el visor pasa a ella.
// `onPick(step)` recibe cuántos lugares moverse (-2, -1, 1 o 2); `srcOf(card)` da la imagen de cada carta.
export default function CardNeighbors({ cards, index, onPick, tcg, srcOf = (card) => card.imageUrl }) {
  if (cards.length < 2 || index < 0) return null;
  const offsets = [-2, -1, 0, 1, 2].filter((offset) => cards[index + offset]);
  return (
    <div className="flex shrink-0 items-center justify-center gap-1.5 px-3 pb-2 sm:gap-2.5" role="group" aria-label="Cartas cercanas">
      {offsets.map((offset) => {
        const card = cards[index + offset];
        return <Thumb key={card.id} card={card} offset={offset} src={srcOf(card)} tcg={card.tcg || card.game || tcg} onPick={onPick} />;
      })}
    </div>
  );
}
