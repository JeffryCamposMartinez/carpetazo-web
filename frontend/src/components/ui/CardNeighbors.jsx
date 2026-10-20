import { cardRatio, fullscreenCorners, NO_IMAGE_CARD_URL, onCardImageError, tcgplayerCardImage } from '../../utils/cardShape';

// Escala de las cartas vecinas a los lados de la carta principal en pantalla completa:
// ±1 (inmediata anterior/siguiente) se ve mediana; ±2 (dos lugares) más pequeña.
const SIDE_LOOK = {
  1: {
    size: (ratio) => ({
      aspectRatio: `${ratio}`,
      width: `min(14cqw, calc(54cqh * ${ratio}))`,
      height: `min(54cqh, calc(14cqw / ${ratio}))`,
    }),
    mobileSize: (ratio) => ({
      aspectRatio: `${ratio}`,
      width: `min(22cqw, calc(48cqh * ${ratio}))`,
      height: `min(48cqh, calc(22cqw / ${ratio}))`,
    }),
    opacity: 'opacity-75 [@media(hover:hover)]:hover:opacity-100 [@media(hover:hover)]:hover:scale-[1.04]',
    ring: 'ring-1 ring-white/35 shadow-[0_14px_30px_rgba(0,0,0,0.55)]',
  },
  2: {
    size: (ratio) => ({
      aspectRatio: `${ratio}`,
      width: `min(9.5cqw, calc(38cqh * ${ratio}))`,
      height: `min(38cqh, calc(9.5cqw / ${ratio}))`,
    }),
    mobileSize: (ratio) => ({
      aspectRatio: `${ratio}`,
      width: `min(15cqw, calc(34cqh * ${ratio}))`,
      height: `min(34cqh, calc(15cqw / ${ratio}))`,
    }),
    opacity: 'opacity-45 [@media(hover:hover)]:hover:opacity-90 [@media(hover:hover)]:hover:scale-[1.04]',
    ring: 'ring-1 ring-white/20 shadow-[0_10px_22px_rgba(0,0,0,0.45)]',
  },
};

function SideThumb({ card, offset, src, tcg, onPick, mobile = false }) {
  const step = Math.abs(offset);
  const look = SIDE_LOOK[step];
  const ratioStr = cardRatio(tcg);
  const [rw, rh] = ratioStr.split('/').map(Number);
  const ratio = (rw && rh) ? rw / rh : 63 / 88;
  const boxStyle = mobile ? look.mobileSize(ratio) : look.size(ratio);

  if (!card) {
    // Reserva el mismo espacio para que la carta central nunca salte al llegar al principio o al final
    return <div aria-hidden="true" className="pointer-events-none shrink-0" style={boxStyle} />;
  }

  const fallbackUrl = tcgplayerCardImage({ ...card, tcg });
  const initialSrc = src || fallbackUrl || NO_IMAGE_CARD_URL;

  return (
    <button
      type="button"
      onClick={() => onPick(offset)}
      aria-label={`${offset < 0 ? 'Anterior' : 'Siguiente'}: ${card.name}`}
      onPointerDown={(event) => event.stopPropagation()}
      style={{ ...boxStyle, ...fullscreenCorners(tcg) }}
      className={`${look.opacity} ${look.ring} relative shrink-0 overflow-hidden rounded-xl bg-white/10 transition-[opacity,transform] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] active:scale-95`}
    >
      <img
        src={initialSrc}
        alt=""
        loading="lazy"
        draggable={false}
        referrerPolicy="no-referrer"
        onError={(event) => onCardImageError(event, fallbackUrl)}
        style={fullscreenCorners(tcg)}
        className="h-full w-full select-none object-cover"
      />
    </button>
  );
}

// Cartas vecinas a un lado ('left' -> [-2, -1], 'right' -> [+1, +2]) de la carta en pantalla completa.
export function CardSideWing({ side, cards, index, onPick, tcg, srcOf = (card) => card.imageUrl }) {
  if (!cards || cards.length < 2 || index < 0) return null;
  const offsets = side === 'left' ? [-2, -1] : [1, 2];
  const mobileOffset = side === 'left' ? -1 : 1;
  const mobileCard = cards[index + mobileOffset] || null;
  const mobileTcg = mobileCard?.tcg || mobileCard?.game || tcg;

  return (
    <>
      {/* Escritorio y tablet: muestra hasta 2 cartas a cada lado en escalera (-2, -1 | CARTA | +1, +2) */}
      <div className="hidden shrink-0 items-center gap-2.5 sm:flex lg:gap-4" role="group" aria-label={side === 'left' ? 'Cartas anteriores' : 'Cartas siguientes'}>
        {offsets.map((offset) => {
          const item = cards[index + offset] || null;
          const itemTcg = item?.tcg || item?.game || tcg;
          return (
            <SideThumb
              key={item ? `${offset}-${item.id}` : `empty-${offset}`}
              card={item}
              offset={offset}
              src={item ? srcOf(item) : ''}
              tcg={itemTcg}
              onPick={onPick}
            />
          );
        })}
      </div>

      {/* Móvil: muestra la carta anterior/siguiente asomándose a cada lado de la carta principal */}
      <div
        className={`flex shrink-0 items-center sm:hidden ${side === 'left' ? '-mr-6 z-0' : '-ml-6 z-0'}`}
        role="group"
        aria-label={side === 'left' ? 'Carta anterior' : 'Carta siguiente'}
      >
        <SideThumb
          card={mobileCard}
          offset={mobileOffset}
          src={mobileCard ? srcOf(mobileCard) : ''}
          tcg={mobileTcg}
          onPick={onPick}
          mobile
        />
      </div>
    </>
  );
}

export default CardSideWing;
