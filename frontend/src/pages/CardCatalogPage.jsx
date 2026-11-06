import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchPokemonGroupCards, fetchPokemonGroups } from '../services/tcgcsvPokemon';
import { fetchGameGroupCards, fetchGameGroups } from '../services/tcgcsvGames';
import { catalogLink } from '../utils/catalogLink';
import { GAMES } from '../components/cards/CardsFilters';
import LoadableImage, { LoadingMark } from '../components/ui/LoadableImage';
import EmptyState from '../components/ui/EmptyState';
import SvgIcon from '../components/ui/SvgIcon';
import usePageMeta from '../hooks/usePageMeta';

const CATALOG_GAMES = GAMES.filter((game) => game.name !== 'Mitos y Leyendas'); // Mitos y Leyendas tiene su propio catálogo, fuera de TCGplayer
const PAGE_SIZE = 60;
const CHIP = 'flex h-11 shrink-0 items-center justify-center rounded-full px-4 text-sm font-extrabold transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 focus-visible:ring-offset-[#DBEAFE]';
const FIELD = 'h-12 w-full rounded-full border-0 bg-white px-4 text-base font-medium text-slate-900 shadow-[0_1px_2px_rgba(26,43,75,0.08)] ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-[#1e40af]';

const loadGroups = (game, signal) => (game === 'Pokémon' ? fetchPokemonGroups('en', signal) : fetchGameGroups(game, signal));
const loadCards = (game, group, signal) => (game === 'Pokémon' ? fetchPokemonGroupCards('en', group, signal) : fetchGameGroupCards(game, group, signal));

// Visor del catálogo: todas las cartas de todas las ediciones, solo para mirarlas (juego → edición → cartas)
export default function CardCatalogPage() {
  usePageMeta({ title: 'Catálogo de cartas TCG | Carpetazo', description: 'Mira todas las cartas de todas las ediciones de Pokémon, Magic, Yu-Gi-Oh!, One Piece, Riftbound, Lorcana y Digimon.', path: '/cartas/catalogo' });
  const [params, setParams] = useSearchParams();
  const game = CATALOG_GAMES.some((item) => item.name === params.get('tcg')) ? params.get('tcg') : 'Pokémon';
  const setParam = params.get('set') || '';
  const [groups, setGroups] = useState(null); // null = cargando
  const [cards, setCards] = useState(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const controller = new AbortController();
    setGroups(null); setCards(null); setFailed(false);
    loadGroups(game, controller.signal)
      .then((list) => setGroups(list))
      .catch((error) => { if (error?.name !== 'AbortError') { setGroups([]); setFailed(true); } });
    return () => controller.abort();
  }, [game]);

  const group = useMemo(() => (groups || []).find((item) => String(item.groupId) === setParam) || (groups || [])[0] || null, [groups, setParam]);

  useEffect(() => {
    if (!group) return undefined;
    const controller = new AbortController();
    setCards(null); setFailed(false); setQuery(''); setShown(PAGE_SIZE);
    loadCards(game, group, controller.signal)
      .then((list) => setCards(list))
      .catch((error) => { if (error?.name !== 'AbortError') { setCards([]); setFailed(true); } });
    return () => controller.abort();
  }, [game, group]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? (cards || []).filter((card) => `${card.name} ${card.number}`.toLowerCase().includes(q)) : (cards || []);
  }, [cards, query]);

  const loading = groups === null || (group && cards === null);

  return (
    <div className="mx-auto w-full max-w-[1600px] xl:px-12 2xl:px-16">
      <div className="relative z-10 min-h-[100svh] w-full bg-blue-100 px-4 pb-8 pt-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x md:border-outline-variant/30 md:px-12 md:pt-14">
        <header className="mb-4 sm:mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#12315f] [text-wrap:balance] md:text-4xl">Catálogo de cartas</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600 md:text-base">Todas las cartas de cada edición, para mirarlas. Toca una para ver su ficha y quién la vende.</p>
        </header>

        <div role="group" aria-label="Juego" className="-mx-4 flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          {CATALOG_GAMES.map((item) => (
            <button key={item.name} type="button" aria-pressed={game === item.name} onClick={() => update({ tcg: item.name === 'Pokémon' ? '' : item.name, set: '' })} className={`${CHIP} ${game === item.name ? 'bg-[#12315f] text-white shadow-[0_8px_16px_-8px_rgba(18,49,95,0.7)]' : 'bg-white text-[#12315f] ring-1 ring-slate-900/10 [@media(hover:hover)]:hover:bg-blue-50'}`}>{item.name}</button>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:max-w-3xl">
          <select aria-label="Edición" value={group ? String(group.groupId) : ''} disabled={!groups?.length} onChange={(event) => update({ set: event.target.value })} className={FIELD}>
            {(groups || []).map((item) => <option key={item.groupId} value={item.groupId}>{item.name}</option>)}
          </select>
          <div className="relative">
            <SvgIcon name="search" translate="no" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[22px] text-slate-400" />
            <input type="search" value={query} onChange={(event) => { setQuery(event.target.value.slice(0, 80)); setShown(PAGE_SIZE); }} placeholder="Buscar en esta edición" aria-label="Buscar en esta edición" className={`${FIELD} pl-12 [&::-webkit-search-cancel-button]:appearance-none`} />
          </div>
        </div>

        {group && cards && <p className="mt-4 text-sm font-bold text-[#12315f]" aria-live="polite">{visible.length} {visible.length === 1 ? 'carta' : 'cartas'} en {group.name}</p>}

        <section className="mt-4" aria-label="Cartas de la edición" aria-busy={loading}>
          {loading ? (
            <div className="relative flex h-64 items-center justify-center"><LoadingMark className="absolute inset-0" /></div>
          ) : failed ? (
            <EmptyState icon="cloud_off" title="No pudimos cargar el catálogo" action={{ label: 'Reintentar', icon: 'refresh', onClick: () => window.location.reload() }} role="alert">Revisa tu conexión e inténtalo de nuevo.</EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState icon="style" title={query ? 'Ninguna carta coincide' : 'Esta edición todavía no tiene cartas'} action={query ? { label: 'Borrar búsqueda', onClick: () => setQuery('') } : undefined}>
              {query ? 'Prueba con otro nombre o número.' : 'Elige otra edición de la lista.'}
            </EmptyState>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {visible.slice(0, shown).map((card) => {
                  const to = catalogLink(card);
                  const body = (
                    <>
                      <span className="relative block aspect-[63/88] w-full overflow-hidden bg-slate-100">
                        <LoadableImage src={card.imageUrl} alt={card.name} loading="lazy" decoding="async" className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-md object-contain" />
                      </span>
                      <span className="flex flex-col gap-0.5 p-3">
                        <span className="line-clamp-2 text-sm font-extrabold leading-tight text-[#12315f]">{card.name}</span>
                        <span className="text-xs font-bold tabular-nums text-slate-500">N.º {card.number}</span>
                      </span>
                    </>
                  );
                  const tileClass = 'block overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(26,43,75,0.06),0_10px_24px_-18px_rgba(26,43,75,0.4)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-[0_2px_4px_rgba(26,43,75,0.08),0_18px_32px_-16px_rgba(26,43,75,0.5)] motion-reduce:transition-none';
                  return <li key={card.productId} className="min-w-0">{to ? <Link to={to} className={tileClass}>{body}</Link> : <div className={tileClass}>{body}</div>}</li>;
                })}
              </ul>
              {shown < visible.length && (
                <div className="mt-6 flex justify-center">
                  <button type="button" onClick={() => setShown((count) => count + PAGE_SIZE)} className="inline-flex h-12 items-center justify-center rounded-full bg-[#facc15] px-6 text-sm font-extrabold text-[#12315f] shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] transition-[background-color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 [@media(hover:hover)]:hover:bg-[#eab308]">Ver más cartas ({visible.length - shown})</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
