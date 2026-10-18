import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import ComunaSelect from '../components/ui/ComunaSelect';
import LocationLine from '../components/ui/LocationLine';
import Select from '../components/ui/Select';
import usePageMeta from '../hooks/usePageMeta';
import EmptyState from '../components/ui/EmptyState';
import VerifiedBadge from '../components/ui/VerifiedBadge';
import PlanBadge from '../components/ui/PlanBadge';

const SORTS = [
  { value: 'visits', label: 'Más visitados' },
  { value: 'cards', label: 'Más cartas' },
  { value: 'name', label: 'Nombre (A-Z)' },
];

const formatNumber = (value) => Number(value || 0).toLocaleString('es-CL');

function Avatar({ seller }) {
  return seller.photoURL ? (
    <img src={seller.photoURL} alt="" loading="lazy" className="h-14 w-14 flex-shrink-0 rounded-full border-2 border-[#facc15] bg-white object-cover" />
  ) : (
    <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#facc15] bg-[#12315f] text-xl font-black text-white">{(seller.name || 'V')[0].toUpperCase()}</span>
  );
}

// La búsqueda, el orden y la página se resuelven en el servidor (24 vendedores por página)
export default function SellersPage() {
  usePageMeta({ title: 'Vendedores de cartas TCG en Chile | Carpetazo', description: 'Encuentra vendedores y tiendas de cartas TCG en Chile, por comuna y por cantidad de cartas a la venta.', path: '/vendedores' });
  const [result, setResult] = useState({ sellers: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sort, setSort] = useState('visits');
  const [comuna, setComuna] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedQuery(query.trim()); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (sort !== 'visits') params.set('sort', sort);
    if (comuna) params.set('comuna', comuna);
    if (page > 1) params.set('page', String(page));
    api.getSellers(params.toString())
      .then((res) => { if (!cancelled) startTransition(() => setResult(res.success ? res : { sellers: [], total: 0, pages: 1 })); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery, sort, comuna, page]);

  const sellers = useMemo(() => result.sellers.map((seller) => ({ ...seller, key: seller.username || seller.name, photoURL: seller.photoURL || '', tcgs: seller.tcgs || [] })), [result.sellers]);

  return (
    <div className="mx-auto min-h-[100svh] w-full max-w-[1470px] px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
      <div className="rounded-[1.6rem] border border-white/70 bg-[#DBEAFE]/95 p-4 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.8)] md:rounded-[2rem] md:p-8">
        <header className="mb-5">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#12315f] md:text-4xl">Vendedores</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 md:text-base">Personas y tiendas con carpetas públicas. Las visitas suman todas sus carpetas.</p>
        </header>

        <div className="mb-5 flex flex-col gap-2 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-900/5 md:flex-row md:items-center md:p-3">
          <div className="relative min-w-0 flex-1">
            <span translate="no" className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">search</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 60))}
              placeholder="Buscar vendedor por nombre o usuario"
              aria-label="Buscar vendedor"
              className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-900 transition focus:border-[#1e40af] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#facc15]/70"
            />
          </div>
          <ComunaSelect value={comuna} onChange={(value) => { setComuna(value); setPage(1); }} className="md:w-56" />
          <Select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} aria-label="Ordenar" className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-[#12315f] focus:outline-none focus:ring-2 focus:ring-[#facc15]/70">
            {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </div>

        {loading ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => <li key={i} className="skeleton h-28 rounded-2xl" />)}
          </ul>
        ) : failed ? (
          <EmptyState icon="cloud_off" title="No pudimos cargar los vendedores" action={{ label: 'Recargar página', icon: 'refresh', onClick: () => window.location.reload() }}>
            Revisa tu conexión e inténtalo de nuevo.
          </EmptyState>
        ) : sellers.length === 0 ? (
          <EmptyState icon="storefront" title="No hay vendedores con esa búsqueda">
            {comuna ? 'Solo aparecen vendedores que indicaron su comuna. Prueba con otra comuna o quita el filtro.' : 'Prueba con otro nombre.'}
          </EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sellers.map((seller) => {
              const body = (
                <>
                  <Avatar seller={seller} />
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-1 text-base font-extrabold text-[#12315f]"><span className="truncate">{seller.name}</span>{seller.verified && <VerifiedBadge size={18} />}</p>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5"><p className="truncate text-xs font-semibold text-slate-500">{seller.username ? `@${seller.username}` : 'Vendedor'}</p><PlanBadge badge={seller.planBadge} compact /></div>
                    <LocationLine comuna={seller.publicComuna} region={seller.publicRegion} className="mt-0.5 text-xs font-semibold text-[#1e40af]" />
                    <p className="mt-1.5 text-xs font-semibold tabular-nums text-slate-600">
                      {formatNumber(seller.folders)} {seller.folders === 1 ? 'carpeta' : 'carpetas'} · {formatNumber(seller.cards)} {seller.cards === 1 ? 'carta' : 'cartas'} · {formatNumber(seller.visits)} {seller.visits === 1 ? 'visita' : 'visitas'}
                    </p>
                    {seller.tcgs.length > 0 && <p className="mt-0.5 truncate text-xs text-slate-500">{seller.tcgs.join(', ')}</p>}
                  </div>
                  <span translate="no" className="material-symbols-outlined text-[22px] text-slate-400">chevron_right</span>
                </>
              );
              const rowClass = 'flex min-w-0 items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5';
              return (
                <li key={seller.key} className="min-w-0">
                  {seller.username ? (
                    <Link to={`/${seller.username}`} className={`${rowClass} transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]`}>{body}</Link>
                  ) : (
                    <div className={rowClass}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!loading && !failed && result.pages > 1 && (
          <nav aria-label="Paginación" className="mt-6 flex items-center justify-center gap-3">
            <button type="button" disabled={page <= 1} onClick={() => { setPage(page - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex h-10 items-center gap-1 rounded-full bg-white px-4 text-sm font-bold text-[#12315f] shadow-sm ring-1 ring-slate-900/5 disabled:opacity-40">
              <span translate="no" className="material-symbols-outlined text-[18px]">chevron_left</span> Anterior
            </button>
            <span className="text-sm font-semibold tabular-nums text-slate-600">Página {page} de {result.pages}</span>
            <button type="button" disabled={page >= result.pages} onClick={() => { setPage(page + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex h-10 items-center gap-1 rounded-full bg-white px-4 text-sm font-bold text-[#12315f] shadow-sm ring-1 ring-slate-900/5 disabled:opacity-40">
              Siguiente <span translate="no" className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
