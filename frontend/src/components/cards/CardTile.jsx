import { Link } from 'react-router-dom';
import LoadableImage from '../ui/LoadableImage';

const formatCLP = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);
const NEW_WINDOW_MS = 72 * 60 * 60 * 1000;

const SURFACE = 'bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(26,43,75,0.06),0_10px_24px_-18px_rgba(26,43,75,0.4)]';
const LIFT = 'transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.985] [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-[0_2px_4px_rgba(26,43,75,0.08),0_18px_32px_-16px_rgba(26,43,75,0.5)] motion-reduce:transition-none motion-reduce:[@media(hover:hover)]:hover:translate-y-0';

// Etiqueta de precio pegada a la carta, como en una tienda
function PriceTag({ price, size = 'md' }) {
  const has = Number(price) > 0;
  return (
    <span className={`inline-flex items-center rounded-lg font-black tabular-nums shadow-[0_2px_5px_rgba(8,18,42,0.3)] ${size === 'lg' ? 'px-3 py-1.5 text-[17px]' : 'px-2.5 py-1 text-[15px]'} ${has ? 'bg-[#facc15] text-[#12315f]' : 'bg-white text-slate-600'}`}>
      {has ? formatCLP(price) : 'Consultar'}
    </span>
  );
}

function Seller({ card }) {
  const user = card.folder?.user || {};
  const name = user.name || user.username || 'Vendedor';
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-600">
      {user.photoURL
        ? <img src={user.photoURL} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-5 w-5 shrink-0 rounded-full bg-slate-100 object-cover ring-1 ring-black/10" />
        : <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1e40af] text-[10px] font-extrabold text-white">{name.charAt(0).toUpperCase()}</span>}
      <span className="min-w-0 truncate">{name}<span className="font-medium text-slate-400"> · {card.folder?.name}</span></span>
    </span>
  );
}

const LANGUAGES = { English: 'Inglés', Spanish: 'Español', Japanese: 'Japonés' };

// El idioma va en su propia etiqueta: así nunca queda cortado por el nombre largo de la edición
function LanguageChip({ language }) {
  if (!language) return null;
  return <span className="shrink-0 rounded-full bg-[#dbeafe] px-2 py-0.5 text-[11px] font-extrabold text-[#1e40af]">{LANGUAGES[language] || language}</span>;
}

function Availability({ stock }) {
  if (stock === 1) return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-extrabold text-amber-800">Última unidad</span>;
  return <span className="text-xs font-bold tabular-nums text-slate-500">{stock > 999 ? '999+' : stock} disponibles</span>;
}

function CardImage({ card, className }) {
  return card.imageUrl
    ? <LoadableImage src={card.imageUrl} alt={card.name} loading="lazy" decoding="async" className={className} />
    : <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs font-semibold text-slate-400">Sin imagen</span>;
}

function WishButton({ card, wanted, onWish, className }) {
  return (
    <button
      type="button"
      onClick={() => onWish(card)}
      aria-pressed={wanted}
      aria-label={wanted ? `${card.name} está en tu lista de deseadas` : `Agregar ${card.name} a mis deseadas`}
      className={`absolute z-10 flex h-11 w-11 items-center justify-center rounded-full shadow-md ring-1 ring-black/10 transition-[transform,background-color] duration-150 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${wanted ? 'bg-[#facc15] text-[#12315f]' : 'bg-white/95 text-[#12315f]'} ${className}`}
    >
      <span key={wanted ? 'on' : 'off'} translate="no" className={`material-symbols-outlined text-[24px] ${wanted ? 'heart-pop' : ''}`} style={wanted ? { fontVariationSettings: "'FILL' 1" } : undefined}>favorite</span>
    </button>
  );
}

export function CardTileSkeleton({ view }) {
  return view === 'list'
    ? <li className="flex h-[8.5rem] animate-pulse gap-3 rounded-2xl bg-white/70 p-2.5" aria-hidden="true"><div className="w-[5.5rem] shrink-0 rounded-xl bg-slate-200/70" /><div className="flex-1 space-y-2 py-1"><div className="h-4 w-3/4 rounded bg-slate-200/70" /><div className="h-3 w-1/2 rounded bg-slate-200/70" /><div className="h-3 w-2/3 rounded bg-slate-200/70" /></div></li>
    : <li className="animate-pulse overflow-hidden rounded-2xl bg-white/70" aria-hidden="true"><div className="aspect-[63/88] bg-slate-200/70" /><div className="space-y-2 p-3"><div className="h-4 w-4/5 rounded bg-slate-200/70" /><div className="h-3 w-1/2 rounded bg-slate-200/70" /><div className="h-3 w-3/5 rounded bg-slate-200/70" /></div></li>;
}

export default function CardTile({ card, index, view, wanted, onWish }) {
  const isNew = card.createdAt && Date.now() - new Date(card.createdAt).getTime() < NEW_WINDOW_MS;
  const meta = card.set || '';

  if (view === 'list') {
    return (
      <li className="card-enter relative min-w-0" style={{ '--i': index }}>
        <Link to={`/carta/${card.id}`} className={`group flex gap-3 rounded-2xl p-2.5 pr-14 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${SURFACE} ${LIFT}`}>
          <span className="relative block w-[5.5rem] shrink-0 overflow-hidden rounded-xl bg-slate-100" style={{ aspectRatio: '63 / 88' }}>
            <CardImage card={card} className="absolute inset-1.5 h-[calc(100%-0.75rem)] w-[calc(100%-0.75rem)] rounded-md object-contain" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
            <span className="line-clamp-2 text-[15px] font-extrabold leading-tight text-[#12315f]">{card.name}</span>
            {meta && <span className="truncate text-xs text-slate-500">{meta}</span>}
            <Seller card={card} />
            <span className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
              <PriceTag price={card.price} />
              {isNew && <span className="rounded-full bg-[#12315f] px-2 py-0.5 text-[11px] font-extrabold text-white">Nueva</span>}
              <span className="flex flex-wrap items-center gap-1.5"><Availability stock={card.stock} /><LanguageChip language={card.language} /></span>
            </span>
          </span>
        </Link>
        <WishButton card={card} wanted={wanted} onWish={onWish} className="right-2 top-2" />
      </li>
    );
  }

  return (
    <li className="card-enter relative min-w-0" style={{ '--i': index }}>
      <Link to={`/carta/${card.id}`} className={`group flex h-full flex-col overflow-hidden rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${SURFACE} ${LIFT}`}>
        <span className="relative block w-full overflow-hidden bg-slate-100" style={{ aspectRatio: '63 / 88' }}>
          <CardImage card={card} className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-md object-contain" />
          {isNew && <span className="absolute left-2 top-2 rounded-full bg-[#12315f] px-2 py-0.5 text-[11px] font-extrabold text-white shadow">Nueva</span>}
          <span className="absolute bottom-2 left-2 -rotate-1"><PriceTag price={card.price} /></span>
        </span>
        <span className="flex flex-1 flex-col gap-1 p-3">
          <span className="line-clamp-2 text-sm font-extrabold leading-tight text-[#12315f] sm:text-[15px]">{card.name}</span>
          {meta && <span className="truncate text-xs text-slate-500">{meta}</span>}
          <span className="mt-auto flex flex-col gap-1.5 pt-1.5">
            <span className="flex flex-wrap items-center gap-1.5"><Availability stock={card.stock} /><LanguageChip language={card.language} /></span>
            <Seller card={card} />
          </span>
        </span>
      </Link>
      <WishButton card={card} wanted={wanted} onWish={onWish} className="right-2 top-2" />
    </li>
  );
}
