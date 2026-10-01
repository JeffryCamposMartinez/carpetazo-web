import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import LazyFolderCard from '../components/LazyFolderCard';

const TCG_CATEGORIES = [
  { name: 'Pokémon', logo: '/images/logos/pokemon.webp' },
  { name: 'Mitos y Leyendas', logo: '/images/logos/mitosyleyendas.webp' },
  { name: 'One Piece', logo: '/images/logos/onepiece.webp' },
  { name: 'Magic', logo: '/images/logos/magic.webp' },
  { name: 'Yu-Gi-Oh!', logo: '/images/logos/yugioh.webp' },
  { name: 'Riftbound', logo: '/images/logos/riftbound.webp' },
];

const SORT_OPTIONS = [
  { value: 'weekly', label: 'Más visitadas esta semana' },
  { value: 'total', label: 'Más visitadas en total' },
  { value: 'name', label: 'Nombre (A-Z)' },
];

// Compara juegos sin tildes ni signos: "Pokemon" y "Pokémon" son el mismo
const normalize = (text) => (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// La búsqueda, el juego, el orden y la página se resuelven en el servidor (40 carpetas por página)
export default function FoldersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const selectedTcg = searchParams.get('tcg') || 'Todos';
  const sortBy = SORT_OPTIONS.some((option) => option.value === searchParams.get('sort')) ? searchParams.get('sort') : 'weekly';
  const page = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1);

  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [result, setResult] = useState({ folders: [], total: 0, pages: 1, counts: [] });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const updateParams = (changes, { resetPage = true } = {}) => {
    const next = new URLSearchParams(searchParams);
    Object.entries({ ...changes, ...(resetPage ? { page: '' } : {}) }).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
    setSearchParams(next, { replace: true });
  };

  // El texto se envía a la búsqueda un momento después de dejar de escribir
  useEffect(() => {
    if (searchQuery === urlQuery) return undefined;
    const timer = setTimeout(() => updateParams({ q: searchQuery.trim() }), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  useEffect(() => { setSearchQuery(urlQuery); }, [urlQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams();
    if (urlQuery) params.set('q', urlQuery);
    if (selectedTcg !== 'Todos') params.set('tcg', selectedTcg);
    if (sortBy !== 'weekly') params.set('sort', sortBy);
    if (page > 1) params.set('page', String(page));
    api.searchFolders(params.toString())
      .then((res) => { if (!cancelled) startTransition(() => setResult(res.success ? res : { folders: [], total: 0, pages: 1, counts: [] })); })
      .catch((error) => { console.error('Error fetching folders:', error); if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [urlQuery, selectedTcg, sortBy, page]);

  // LazyFolderCard espera el nombre del vendedor como texto
  const foldersToRender = useMemo(() => result.folders.map((folder) => ({
    ...folder,
    cardsCount: folder._count?.cards ?? 0,
    avatarUrl: folder.user?.photoURL || null,
    user: folder.user?.name || folder.user?.username || 'Vendedor anónimo',
    location: '',
  })), [result.folders]);

  const countsByTcg = useMemo(() => {
    const counts = new Map();
    result.counts.forEach(({ tcg, count }) => { const key = normalize(tcg); counts.set(key, (counts.get(key) || 0) + count); });
    return counts;
  }, [result.counts]);
  const totalFolders = useMemo(() => result.counts.reduce((sum, item) => sum + item.count, 0), [result.counts]);

  const hasFilters = selectedTcg !== 'Todos' || Boolean(urlQuery) || sortBy !== 'weekly';
  const totalPages = result.pages;

  const clearFilters = () => {
    setSearchQuery('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const goToPage = (next) => {
    updateParams({ page: next > 1 ? String(next) : '' }, { resetPage: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const chipBase = 'flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]';

  return (
    <div className="mx-auto w-full max-w-[1470px] flex-1 px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
      <div className="rounded-[1.6rem] border border-white/70 bg-[#DBEAFE]/95 p-4 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.8)] md:rounded-[2rem] md:p-8">
        <header className="mb-5">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#12315f] md:text-4xl">Carpetas</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 md:text-base">Catálogos públicos de jugadores y tiendas. Abre una carpeta para ver sus cartas, precios y stock.</p>
        </header>

        <div className="mb-3 flex flex-col gap-2 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-900/5 md:flex-row md:items-center md:p-3">
          <div className="relative min-w-0 flex-1">
            <span translate="no" className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">search</span>
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value.slice(0, 80))}
              placeholder="Buscar por carpeta o vendedor"
              aria-label="Buscar carpeta o vendedor"
              className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-900 transition focus:border-[#1e40af] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#facc15]/70"
            />
          </div>
          <select
            value={sortBy}
            onChange={(event) => updateParams({ sort: event.target.value === 'weekly' ? '' : event.target.value })}
            aria-label="Ordenar carpetas"
            className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-[#12315f] focus:outline-none focus:ring-2 focus:ring-[#facc15]/70"
          >
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        {/* Juego: una fila de opciones que se desliza en móvil */}
        <div role="group" aria-label="Juego" className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-2 hide-scrollbar">
          <button
            type="button"
            onClick={() => updateParams({ tcg: '' })}
            aria-pressed={selectedTcg === 'Todos'}
            className={`${chipBase} ${selectedTcg === 'Todos' ? 'border-[#12315f] bg-[#12315f] text-white' : 'border-slate-200 bg-white text-[#12315f] hover:border-[#12315f]/40'}`}
          >
            Todos
            <span className={`text-xs tabular-nums ${selectedTcg === 'Todos' ? 'text-blue-200' : 'text-slate-400'}`}>{totalFolders}</span>
          </button>
          {TCG_CATEGORIES.map((tcg) => {
            const active = normalize(selectedTcg) === normalize(tcg.name);
            const count = countsByTcg.get(normalize(tcg.name)) || 0;
            return (
              <button
                key={tcg.name}
                type="button"
                onClick={() => updateParams({ tcg: tcg.name })}
                aria-pressed={active}
                className={`${chipBase} ${active ? 'border-[#12315f] bg-[#12315f] text-white' : 'border-slate-200 bg-white text-[#12315f] hover:border-[#12315f]/40'}`}
              >
                <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded bg-white p-0.5">
                  <img src={tcg.logo} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                </span>
                {tcg.name}
                <span className={`text-xs tabular-nums ${active ? 'text-blue-200' : 'text-slate-400'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <p className="mb-4 text-sm font-semibold text-slate-600" aria-live="polite">
          {loading ? 'Cargando carpetas…' : failed ? '' : `${result.total.toLocaleString('es-CL')} ${result.total === 1 ? 'carpeta' : 'carpetas'}`}
          {!loading && !failed && hasFilters && (
            <button type="button" onClick={clearFilters} className="ml-3 font-bold text-[#1e40af] underline-offset-2 hover:underline">Quitar filtros</button>
          )}
        </p>

        {loading ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => <li key={i} className="aspect-[32/37] animate-pulse rounded-xl bg-white/70" />)}
          </ul>
        ) : failed ? (
          <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-900/5" role="alert">
            <p className="text-lg font-extrabold text-[#12315f]">No pudimos cargar las carpetas</p>
            <p className="mt-1 text-sm text-slate-600">Revisa tu conexión e inténtalo de nuevo.</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-full bg-[#facc15] px-6 py-2.5 text-sm font-extrabold text-[#12315f]">Recargar página</button>
          </div>
        ) : foldersToRender.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-900/5">
            <p className="text-lg font-extrabold text-[#12315f]">No hay carpetas con esa búsqueda</p>
            <p className="mt-1 text-sm text-slate-600">Prueba con otro nombre o cambia el juego.</p>
            {hasFilters && <button type="button" onClick={clearFilters} className="mt-4 rounded-full bg-[#facc15] px-6 py-2.5 text-sm font-extrabold text-[#12315f]">Quitar filtros</button>}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 xl:grid-cols-5">
            {foldersToRender.map((folder) => (
              <li key={folder.id} className="min-w-0"><LazyFolderCard folder={folder} /></li>
            ))}
          </ul>
        )}

        {!loading && !failed && totalPages > 1 && (
          <nav aria-label="Paginación" className="mt-8 flex items-center justify-center gap-3">
            <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)} className="flex h-10 items-center gap-1 rounded-full bg-white px-4 text-sm font-bold text-[#12315f] shadow-sm ring-1 ring-slate-900/5 disabled:opacity-40">
              <span translate="no" className="material-symbols-outlined text-[18px]">chevron_left</span> Anterior
            </button>
            <span className="text-sm font-semibold tabular-nums text-slate-600">Página {page} de {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} className="flex h-10 items-center gap-1 rounded-full bg-white px-4 text-sm font-bold text-[#12315f] shadow-sm ring-1 ring-slate-900/5 disabled:opacity-40">
              Siguiente <span translate="no" className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
