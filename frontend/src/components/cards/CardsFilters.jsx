import { formatCardSearchQuery } from '../../utils/cardCodeSearch';
import SvgIcon from '../ui/SvgIcon';

// Juegos del sitio con su logo (un juego sin cartas a la venta se ve vacío hasta que haya ofertas).
export const GAMES = [
  { name: 'Pokémon', logo: '/images/logos/pokemon.webp' },
  { name: 'Mitos y Leyendas', logo: '/images/logos/mitosyleyendas.webp' },
  { name: 'One Piece', logo: '/images/logos/onepiece.webp' },
  { name: 'Magic', logo: '/images/logos/magic.webp' },
  { name: 'Yu-Gi-Oh!', logo: '/images/logos/yugioh.webp' },
  { name: 'Riftbound', logo: '/images/logos/riftbound.webp' },
  { name: 'Lorcana', logo: '/images/logos/lorcana.webp' },
  { name: 'Digimon', logo: '/images/logos/digimon.webp' },
];

const CHIP = 'flex h-11 shrink-0 items-center justify-center gap-2.5 rounded-full px-4 text-sm font-extrabold transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 focus-visible:ring-offset-[#DBEAFE] lg:h-12 lg:w-full lg:justify-start lg:rounded-2xl lg:px-3.5';

// Búsqueda y juego: arriba en el celular (los juegos se deslizan de lado) y en una columna fija a la izquierda en pantallas anchas
// Se reutiliza en Carpetas y Vendedores: placeholder/label cambian, `format` es opcional, `counts` (Map juego→cantidad, con `total`) muestra cuántos hay y `hideGames` deja solo la búsqueda
export default function CardsFilters({ onQuery, onTcg, query, tcg, placeholder = 'Buscar por nombre', format, counts, hideGames = false }) {
  const active = 'bg-[#12315f] text-white shadow-[0_1px_2px_rgba(8,18,42,0.35),0_8px_16px_-8px_rgba(18,49,95,0.7)]';
  const idle = 'bg-white text-[#12315f] ring-1 ring-slate-900/10 [@media(hover:hover)]:hover:bg-blue-50';

  return (
    <div className="lg:sticky lg:top-32 lg:self-start">
      <div className="relative">
        <SvgIcon name="search" translate="no" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[22px] text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(format ? format(event.target.value.slice(0, 80)) : formatCardSearchQuery(event.target.value.slice(0, 80), query))}
          placeholder={placeholder}
          aria-label={placeholder}
          enterKeyHint="search"
          className={`h-12 w-full rounded-full border-0 bg-white pl-12 ${query ? 'pr-12' : 'pr-4'} text-base font-medium text-slate-900 shadow-[0_1px_2px_rgba(26,43,75,0.08),0_10px_22px_-14px_rgba(26,43,75,0.5)] ring-1 ring-slate-900/10 transition-shadow placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1e40af] [&::-webkit-search-cancel-button]:appearance-none`}
        />
        {query && (
          <button type="button" onClick={() => onQuery('')} aria-label="Borrar búsqueda" className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition-[background-color,transform] duration-150 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] [@media(hover:hover)]:hover:bg-slate-100">
            <SvgIcon name="close" translate="no" aria-hidden="true" className="text-[20px]" />
          </button>
        )}
      </div>

      {!hideGames && <div role="group" aria-label="Juego" className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:mt-4 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
        <button type="button" aria-pressed={tcg === ''} onClick={() => onTcg('')} className={`${CHIP} ${tcg === '' ? active : idle}`}>Todos{counts && <span className="hidden text-xs font-bold tabular-nums opacity-60 lg:ml-auto lg:inline">{counts.get('') || 0}</span>}</button>
        {GAMES.map((game) => (
          <button key={game.name} type="button" aria-pressed={tcg === game.name} aria-label={game.name} title={game.name} onClick={() => onTcg(tcg === game.name ? '' : game.name)} className={`${CHIP} ${tcg === game.name ? 'bg-white text-[#12315f] ring-2 ring-[#1e40af] shadow-[0_8px_16px_-10px_rgba(30,64,175,0.7)]' : idle}`}>
            <img src={game.logo} alt="" loading="lazy" className="h-6 w-auto max-w-[5.5rem] object-contain lg:h-7 lg:w-7 lg:max-w-none lg:shrink-0" />
            <span className="hidden lg:inline">{game.name}</span>
            {counts && <span className="hidden text-xs font-bold tabular-nums opacity-60 lg:ml-auto lg:inline">{counts.get(game.name) || 0}</span>}
          </button>
        ))}
      </div>}

    </div>
  );
}
