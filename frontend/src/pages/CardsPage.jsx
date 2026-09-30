import React, { startTransition, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const TCG_OPTIONS = ['Pokémon', 'Mitos y Leyendas', 'One Piece', 'Magic', 'Yu-Gi-Oh!', 'Riftbound'];
const SORT_OPTIONS = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
];

const formatCLP = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);

export default function CardsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [wanted, setWanted] = useState({}); // cartas ya agregadas a la lista de deseadas en esta visita
  const [wishStatus, setWishStatus] = useState('');
  const urlQuery = searchParams.get('q') || '';
  const tcg = searchParams.get('tcg') || '';
  const sort = SORT_OPTIONS.some((option) => option.value === searchParams.get('sort')) ? searchParams.get('sort') : 'recent';
  const page = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1);

  const [queryInput, setQueryInput] = useState(urlQuery);
  const [result, setResult] = useState({ cards: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const updateParams = (changes, { resetPage = true } = {}) => {
    const next = new URLSearchParams(searchParams);
    Object.entries({ ...changes, ...(resetPage ? { page: '' } : {}) }).forEach(([key, value]) => {
      if (value) next.set(key, value); else next.delete(key);
    });
    setSearchParams(next, { replace: true });
  };

  // El texto se envía a la búsqueda medio segundo después de dejar de escribir
  useEffect(() => {
    if (queryInput === urlQuery) return undefined;
    const timer = setTimeout(() => updateParams({ q: queryInput.trim() }), 450);
    return () => clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => { setQueryInput(urlQuery); }, [urlQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams();
    if (urlQuery) params.set('q', urlQuery);
    if (tcg) params.set('tcg', tcg);
    if (sort !== 'recent') params.set('sort', sort);
    if (page > 1) params.set('page', String(page));
    api.searchCards(params.toString())
      .then((res) => { if (!cancelled) startTransition(() => setResult(res.success ? res : { cards: [], total: 0, pages: 1 })); })
      .catch(() => { if (!cancelled) { setFailed(true); setResult({ cards: [], total: 0, pages: 1 }); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [urlQuery, tcg, sort, page]);

  const goToPage = (next) => {
    updateParams({ page: next > 1 ? String(next) : '' }, { resetPage: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasFilters = Boolean(urlQuery || tcg || sort !== 'recent');

  const addToWishlist = async (card) => {
    if (!currentUser) { navigate('/bienvenida'); return; }
    if (wanted[card.id]) return;
    try {
      await api.addWishlistItem({
        productId: card.tcgId || undefined,
        name: card.name,
        imageUrl: card.imageUrl || undefined,
        game: card.folder?.tcg || undefined,
        detail: [card.set, card.language].filter(Boolean).join(' · ').slice(0, 100) || undefined,
      });
      setWanted((previous) => ({ ...previous, [card.id]: true }));
      setWishStatus(`${card.name} agregada a tu lista de deseadas`);
    } catch (error) {
      setWishStatus(error.message || 'No se pudo agregar la carta');
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1470px] px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
      <div className="rounded-[1.6rem] border border-white/70 bg-[#DBEAFE]/95 p-4 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.8)] md:rounded-[2rem] md:p-8">
        <header className="mb-5">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#12315f] md:text-4xl">Cartas en venta</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 md:text-base">Busca una carta entre las carpetas públicas de los vendedores. Solo se muestran cartas con stock disponible.</p>
        </header>

        <form onSubmit={(event) => { event.preventDefault(); updateParams({ q: queryInput.trim() }); }} className="mb-5 flex flex-col gap-2 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-900/5 md:flex-row md:items-center md:p-3">
          <div className="relative min-w-0 flex-1">
            <span translate="no" className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">search</span>
            <input
              type="search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value.slice(0, 80))}
              placeholder="Buscar carta por nombre"
              aria-label="Buscar carta por nombre"
              className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-900 transition focus:border-[#1e40af] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#facc15]/70"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <select value={tcg} onChange={(event) => updateParams({ tcg: event.target.value })} aria-label="Juego" className="h-11 min-w-0 rounded-full border border-slate-200 bg-white pl-3 pr-1 text-[13px] font-bold text-[#12315f] focus:outline-none focus:ring-2 focus:ring-[#facc15]/70 md:px-4 md:text-sm">
              <option value="">Todos los juegos</option>
              {TCG_OPTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select value={sort} onChange={(event) => updateParams({ sort: event.target.value === 'recent' ? '' : event.target.value })} aria-label="Ordenar" className="h-11 min-w-0 rounded-full border border-slate-200 bg-white pl-3 pr-1 text-[13px] font-bold text-[#12315f] focus:outline-none focus:ring-2 focus:ring-[#facc15]/70 md:px-4 md:text-sm">
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </form>

        <p className="sr-only" role="status" aria-live="polite">{wishStatus}</p>

        <p className="mb-3 text-sm font-semibold text-slate-600" aria-live="polite">
          {loading ? 'Buscando cartas…' : failed ? '' : `${result.total.toLocaleString('es-CL')} ${result.total === 1 ? 'carta disponible' : 'cartas disponibles'}`}
        </p>

        {failed ? (
          <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-900/5" role="alert">
            <p className="text-lg font-extrabold text-[#12315f]">No pudimos cargar las cartas</p>
            <p className="mt-1 text-sm text-slate-600">Revisa tu conexión e inténtalo de nuevo.</p>
            <button type="button" onClick={() => setSearchParams(new URLSearchParams(searchParams), { replace: true })} className="mt-4 rounded-full bg-[#facc15] px-6 py-2.5 text-sm font-extrabold text-[#12315f]">Reintentar</button>
          </div>
        ) : !loading && result.cards.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-900/5">
            <p className="text-lg font-extrabold text-[#12315f]">No encontramos cartas con esa búsqueda</p>
            <p className="mt-1 text-sm text-slate-600">Prueba con otro nombre o cambia el juego.</p>
            {hasFilters && (
              <button type="button" onClick={() => { setQueryInput(''); setSearchParams(new URLSearchParams(), { replace: true }); }} className="mt-4 rounded-full bg-[#facc15] px-6 py-2.5 text-sm font-extrabold text-[#12315f]">Quitar filtros</button>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 xl:grid-cols-6">
            {(loading ? Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, skeleton: true })) : result.cards).map((card) => (
              <li key={card.id} className="relative min-w-0">
                {card.skeleton ? (
                  <div className="aspect-[63/110] animate-pulse rounded-xl bg-white/70" />
                ) : (
                  <Link to={`/c/${card.folder.id}`} className="group flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
                    <div className="relative w-full overflow-hidden bg-slate-100" style={{ aspectRatio: '63 / 88' }}>
                      {card.imageUrl ? (
                        <img src={card.imageUrl} alt={card.name} loading="lazy" decoding="async" className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-md object-contain" />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-400">Sin imagen</span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-2.5">
                      <p className="line-clamp-2 text-sm font-bold leading-tight text-[#12315f]">{card.name}</p>
                      {(card.set || card.language) && <p className="truncate text-xs text-slate-500">{[card.set, card.language].filter(Boolean).join(' · ')}</p>}
                      <div className="mt-auto flex items-end justify-between gap-2 pt-1">
                        <span className="text-base font-black tabular-nums text-[#12315f]">{card.price ? formatCLP(card.price) : 'Consultar'}</span>
                        <span className="text-xs font-bold tabular-nums text-slate-500">{card.stock > 999 ? '999+' : card.stock} disp.</span>
                      </div>
                      <p className="truncate border-t border-slate-100 pt-1.5 text-xs font-semibold text-slate-500">
                        {card.folder.user?.name || card.folder.user?.username || 'Vendedor'} · {card.folder.name}
                      </p>
                    </div>
                  </Link>
                )}
                {!card.skeleton && (
                  <button
                    type="button"
                    onClick={() => addToWishlist(card)}
                    aria-pressed={Boolean(wanted[card.id])}
                    aria-label={wanted[card.id] ? `${card.name} está en tu lista de deseadas` : `Agregar ${card.name} a mis deseadas`}
                    className={`absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full shadow-md ring-1 ring-black/10 transition active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${wanted[card.id] ? 'bg-[#facc15] text-[#12315f]' : 'bg-white/95 text-[#12315f]'}`}
                  >
                    <span translate="no" className="material-symbols-outlined text-[24px]" style={wanted[card.id] ? { fontVariationSettings: "'FILL' 1" } : undefined}>favorite</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!loading && !failed && result.pages > 1 && (
          <nav aria-label="Paginación" className="mt-6 flex items-center justify-center gap-3">
            <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)} className="flex h-10 items-center gap-1 rounded-full bg-white px-4 text-sm font-bold text-[#12315f] shadow-sm ring-1 ring-slate-900/5 disabled:opacity-40">
              <span translate="no" className="material-symbols-outlined text-[18px]">chevron_left</span> Anterior
            </button>
            <span className="text-sm font-semibold tabular-nums text-slate-600">Página {page} de {result.pages}</span>
            <button type="button" disabled={page >= result.pages} onClick={() => goToPage(page + 1)} className="flex h-10 items-center gap-1 rounded-full bg-white px-4 text-sm font-bold text-[#12315f] shadow-sm ring-1 ring-slate-900/5 disabled:opacity-40">
              Siguiente <span translate="no" className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
