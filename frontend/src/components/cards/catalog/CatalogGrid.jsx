import { Link } from 'react-router-dom';
import LoadableImage from '../../ui/LoadableImage';
import FinishRibbon from '../../ui/FinishRibbon';
import SvgIcon from '../../ui/SvgIcon';
import { catalogLink } from '../../../utils/catalogLink';

const TILE = 'overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(26,43,75,0.06),0_10px_24px_-18px_rgba(26,43,75,0.4)]';
const PRESS = 'transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-[0_2px_4px_rgba(26,43,75,0.08),0_18px_32px_-16px_rgba(26,43,75,0.5)] motion-reduce:transition-none';
const FICHA = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#1e40af] transition-[background-color,transform] duration-150 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] [@media(hover:hover)]:hover:bg-blue-50';

const GRID_COLUMNS = {
  grid: 'grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
  compact: 'grid-cols-3 gap-2 sm:grid-cols-4 md:gap-3 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8',
  list: 'grid-cols-1 gap-2 lg:grid-cols-2',
};

// Cartas de la edición. Tocar una abre la vista rápida; el botón de la ficha lleva a la página de la carta (si existe).
export default function CatalogGrid({ cards, view, hasFicha, onOpen }) {
  const list = view === 'list';
  const small = view === 'compact';
  return (
    <ul className={`grid ${GRID_COLUMNS[view] || GRID_COLUMNS.grid}`}>
      {cards.map((card) => {
        const to = hasFicha ? catalogLink(card) : null;
        const ficha = to && (
          <Link to={to} aria-label={`Ver ficha de ${card.name}`} title="Ver ficha" className={FICHA}><SvgIcon name="chevron_right" translate="no" aria-hidden="true" className="text-[20px]" /></Link>
        );
        return (
          <li key={card.id || card.productId} className="min-w-0">
            {list ? (
              <div className={`${TILE} flex items-center gap-3 p-2 pr-1.5`}>
                <button type="button" onClick={() => onOpen(card)} aria-label={`Ver ${card.name} en grande`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
                  <span className="relative block aspect-[63/88] w-12 shrink-0 overflow-hidden rounded-md bg-slate-100">
                    <LoadableImage src={card.imageUrl} alt="" compact loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-contain" />
                    <FinishRibbon finish={card.finish} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold text-[#12315f]">{card.name}</span>
                    {card.number && <span className="block text-xs font-bold tabular-nums text-slate-500">N.º {card.number}{card.finish && ` · ${card.finish}`}</span>}
                  </span>
                </button>
                {ficha}
              </div>
            ) : (
              <div className={`${TILE} ${PRESS}`}>
                <button type="button" onClick={() => onOpen(card)} aria-label={`Ver ${card.name} en grande`} className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1e40af]">
                  <span className="relative block aspect-[63/88] w-full overflow-hidden bg-slate-100">
                    <LoadableImage src={card.imageUrl} alt={card.name} compact={small} loading="lazy" decoding="async" className={`absolute h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-md object-contain ${small ? 'inset-1.5 h-[calc(100%-0.75rem)] w-[calc(100%-0.75rem)]' : 'inset-2'}`} />
                    <FinishRibbon finish={card.finish} />
                  </span>
                </button>
                <div className={`flex items-center gap-1 ${small ? 'px-2 py-1.5' : 'py-2 pl-3 pr-1.5'}`}>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-extrabold leading-tight text-[#12315f] ${small ? 'truncate text-[11px]' : 'line-clamp-2 text-sm'}`}>{card.name}</span>
                    {card.number && <span className={`block font-bold tabular-nums text-slate-500 ${small ? 'text-[10px]' : 'text-xs'}`}>N.º {card.number}</span>}
                  </span>
                  {!small && ficha}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
