import React, { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import LazyFolderCard from '../components/folder/LazyFolderCard';
import CardsFilters, { GAMES } from '../components/cards/CardsFilters';
import HelpTip from '../components/ui/HelpTip';
import ListingToolbar from '../components/ui/ListingToolbar';
import usePageMeta from '../hooks/usePageMeta';
import EmptyState from '../components/ui/EmptyState';
import SvgIcon from '../components/ui/SvgIcon';

const SORT_OPTIONS = [
  { value: 'weekly', label: 'Más visitadas esta semana' },
  { value: 'total', label: 'Más visitadas en total' },
  { value: 'name', label: 'Nombre (A-Z)' },
];

// Compara juegos sin tildes ni signos: "Pokemon" y "Pokémon" son el mismo
const normalize = (text) => (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// La búsqueda, el juego, el orden y la página se resuelven en el servidor (40 carpetas por página)
export default function FoldersPage() {
  usePageMeta({ title: 'Carpetas de cartas TCG de vendedores chilenos | Carpetazo', description: 'Explora las carpetas públicas de vendedores de cartas TCG en Chile: Pokémon, Yu-Gi-Oh!, Magic, One Piece y más.', path: '/carpetas' });
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const selectedTcg = searchParams.get('tcg') || 'Todos';
  const sortBy = SORT_OPTIONS.some((option) => option.value === searchParams.get('sort')) ? searchParams.get('sort') : 'weekly';
  const comuna = searchParams.get('comuna') || '';
  const page = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1);

  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [result, setResult] = useState({ folders: [], total: 0, pages: 1, counts: [] });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const updateParams = useCallback((changes, { resetPage = true } = {}) => {
    const next = new URLSearchParams(searchParams);
    Object.entries({ ...changes, ...(resetPage ? { page: '' } : {}) }).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // El texto se envía a la búsqueda un momento después de dejar de escribir
  useEffect(() => {
    if (searchQuery === urlQuery) return undefined;
    const timer = setTimeout(() => updateParams({ q: searchQuery.trim() }), 350);
    return () => clearTimeout(timer);
  }, [searchQuery, updateParams, urlQuery]);
  useEffect(() => { setSearchQuery(urlQuery); }, [urlQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams();
    if (urlQuery) params.set('q', urlQuery);
    if (selectedTcg !== 'Todos') params.set('tcg', selectedTcg);
    if (sortBy !== 'weekly') params.set('sort', sortBy);
    if (comuna) params.set('comuna', comuna);
    if (page > 1) params.set('page', String(page));
    api.searchFolders(params.toString())
      .then((res) => { if (!cancelled) startTransition(() => setResult(res.success ? res : { folders: [], total: 0, pages: 1, counts: [] })); })
      .catch((error) => { console.error('Error fetching folders:', error); if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [urlQuery, selectedTcg, sortBy, comuna, page]);

  // LazyFolderCard espera el nombre del vendedor como texto
  const foldersToRender = useMemo(() => result.folders.map((folder) => ({
    ...folder,
    cardsCount: folder._count?.cards ?? 0,
    avatarUrl: folder.user?.photoURL || null,
    user: folder.user?.name || folder.user?.username || 'Vendedor anónimo',
    location: folder.user?.publicComuna ? [folder.user.publicComuna, folder.user.publicRegion].filter(Boolean).join(', ') : '',
    planBadge: folder.user?.planBadge || null,
  })), [result.folders]);

  const countsByTcg = useMemo(() => {
    const counts = new Map();
    result.counts.forEach(({ tcg, count }) => { const key = normalize(tcg); counts.set(key, (counts.get(key) || 0) + count); });
    return counts;
  }, [result.counts]);
  const totalFolders = useMemo(() => result.counts.reduce((sum, item) => sum + item.count, 0), [result.counts]);

  const gameCounts = useMemo(() => new Map([['', totalFolders], ...GAMES.map((game) => [game.name, countsByTcg.get(normalize(game.name)) || 0])]), [countsByTcg, totalFolders]);
  const hasFilters = selectedTcg !== 'Todos' || Boolean(urlQuery) || sortBy !== 'weekly' || Boolean(comuna);
  const totalPages = result.pages;

  const clearFilters = () => {
    setSearchQuery('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const goToPage = (next) => {
    updateParams({ page: next > 1 ? String(next) : '' }, { resetPage: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  return (
    <div className="mx-auto w-full max-w-[1600px] xl:px-12 2xl:px-16">
      <div className="relative z-10 min-h-[100svh] w-full bg-blue-100 px-4 pb-8 pt-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x md:border-outline-variant/30 md:px-12 md:pt-14">
        <header className="mb-5">
          <div className="flex items-center gap-3"><h1 className="text-3xl font-extrabold tracking-tight text-[#12315f] md:text-4xl">Carpetas</h1><HelpTip topic="carpetas" /></div>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 md:text-base">Catálogos públicos de jugadores y tiendas. Abre una carpeta para ver sus cartas, precios y stock.</p>
        </header>

        <div className="lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
          <CardsFilters query={searchQuery} tcg={selectedTcg === 'Todos' ? '' : selectedTcg} onQuery={(value) => setSearchQuery(value.slice(0, 80))} onTcg={(value) => updateParams({ tcg: value })} placeholder="Buscar carpeta" format={(value) => value} counts={gameCounts} />

          <section className="mt-5 min-w-0 lg:mt-0" aria-label="Resultados">
            <ListingToolbar total={result.total} loading={loading} failed={failed} one="carpeta" many="carpetas" comuna={comuna} onComuna={(value) => updateParams({ comuna: value })} sort={sortBy} onSort={(value) => updateParams({ sort: value === 'weekly' ? '' : value })} sortOptions={SORT_OPTIONS} onClear={hasFilters ? clearFilters : undefined} />

        {loading ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => <li key={i} className="skeleton aspect-[32/37] rounded-xl" />)}
          </ul>
        ) : failed ? (
          <EmptyState icon="cloud_off" title="No pudimos cargar las carpetas" action={{ label: 'Recargar página', icon: 'refresh', onClick: () => window.location.reload() }}>
            Revisa tu conexión e inténtalo de nuevo.
          </EmptyState>
        ) : foldersToRender.length === 0 ? (
          <EmptyState icon="folder_off" title="No hay carpetas con esa búsqueda" action={hasFilters ? { label: 'Quitar filtros', onClick: clearFilters } : undefined}>
            Prueba con otro nombre o cambia el juego.
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 xl:grid-cols-4 2xl:grid-cols-5">
            {foldersToRender.map((folder) => (
              <li key={folder.id} className="min-w-0"><LazyFolderCard folder={folder} /></li>
            ))}
          </ul>
        )}

        {!loading && !failed && totalPages > 1 && (
          <nav aria-label="Paginación" className="mt-8 flex items-center justify-center gap-3">
            <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)} className="flex h-10 items-center gap-1 rounded-full bg-white px-4 text-sm font-bold text-[#12315f] shadow-sm ring-1 ring-slate-900/5 disabled:opacity-40">
              <SvgIcon name="chevron_left" translate="no" className="text-[18px]" /> Anterior
            </button>
            <span className="text-sm font-semibold tabular-nums text-slate-600">Página {page} de {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} className="flex h-10 items-center gap-1 rounded-full bg-white px-4 text-sm font-bold text-[#12315f] shadow-sm ring-1 ring-slate-900/5 disabled:opacity-40">
              Siguiente <SvgIcon name="chevron_right" translate="no" className="text-[18px]" />
            </button>
          </nav>
        )}
          </section>
        </div>
      </div>
    </div>
  );
}
