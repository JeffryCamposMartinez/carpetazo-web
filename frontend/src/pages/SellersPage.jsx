import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';

const SORTS = [
  { value: 'visits', label: 'Más visitados' },
  { value: 'cards', label: 'Más cartas' },
  { value: 'name', label: 'Nombre (A-Z)' },
];

const formatNumber = (value) => Number(value || 0).toLocaleString('es-CL');

// Un vendedor es la suma de sus carpetas públicas
const groupSellers = (folders) => {
  const sellers = new Map();
  folders.forEach((folder) => {
    const user = folder.user || {};
    const key = user.username || folder.userId;
    if (!key) return;
    const entry = sellers.get(key) || { key, name: user.name || user.username || 'Vendedor', username: user.username || '', photoURL: user.photoURL || '', folders: 0, cards: 0, visits: 0, tcgs: new Set() };
    entry.folders += 1;
    entry.cards += folder._count?.cards || 0;
    entry.visits += folder.totalVisits || 0;
    if (folder.tcg) entry.tcgs.add(folder.tcg);
    sellers.set(key, entry);
  });
  return [...sellers.values()].map((seller) => ({ ...seller, tcgs: [...seller.tcgs] }));
};

function Avatar({ seller }) {
  return seller.photoURL ? (
    <img src={seller.photoURL} alt="" loading="lazy" className="h-14 w-14 flex-shrink-0 rounded-full border-2 border-[#facc15] bg-white object-cover" />
  ) : (
    <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#facc15] bg-[#12315f] text-xl font-black text-white">{(seller.name || 'V')[0].toUpperCase()}</span>
  );
}

export default function SellersPage() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('visits');

  useEffect(() => {
    let cancelled = false;
    api.getPublicFolders()
      .then((res) => { if (!cancelled) startTransition(() => setFolders(res.success ? res.folders : [])); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const sellers = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = groupSellers(folders).filter((seller) => !term || seller.name.toLowerCase().includes(term) || seller.username.toLowerCase().includes(term));
    const sorters = {
      visits: (a, b) => (b.visits - a.visits) || (b.cards - a.cards),
      cards: (a, b) => (b.cards - a.cards) || (b.visits - a.visits),
      name: (a, b) => a.name.localeCompare(b.name, 'es'),
    };
    return list.sort(sorters[sort]);
  }, [folders, query, sort]);

  return (
    <div className="mx-auto w-full max-w-[1470px] px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
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
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar" className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-[#12315f] focus:outline-none focus:ring-2 focus:ring-[#facc15]/70">
            {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        {loading ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => <li key={i} className="h-28 animate-pulse rounded-2xl bg-white/70" />)}
          </ul>
        ) : failed ? (
          <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-900/5" role="alert">
            <p className="text-lg font-extrabold text-[#12315f]">No pudimos cargar los vendedores</p>
            <p className="mt-1 text-sm text-slate-600">Revisa tu conexión y recarga la página.</p>
          </div>
        ) : sellers.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-900/5">
            <p className="text-lg font-extrabold text-[#12315f]">No hay vendedores con esa búsqueda</p>
            <p className="mt-1 text-sm text-slate-600">Prueba con otro nombre.</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sellers.map((seller) => {
              const body = (
                <>
                  <Avatar seller={seller} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-extrabold text-[#12315f]">{seller.name}</p>
                    <p className="truncate text-xs font-semibold text-slate-500">{seller.username ? `@${seller.username}` : 'Vendedor'}</p>
                    <p className="mt-1.5 text-xs font-semibold tabular-nums text-slate-600">
                      {formatNumber(seller.folders)} {seller.folders === 1 ? 'carpeta' : 'carpetas'} · {formatNumber(seller.cards)} {seller.cards === 1 ? 'carta' : 'cartas'} · {formatNumber(seller.visits)} {seller.visits === 1 ? 'visita' : 'visitas'}
                    </p>
                    {seller.tcgs.length > 0 && <p className="mt-0.5 truncate text-xs text-slate-500">{seller.tcgs.join(', ')}</p>}
                  </div>
                  <span translate="no" className="material-symbols-outlined text-[22px] text-slate-400">chevron_right</span>
                </>
              );
              const rowClass = 'flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5';
              return (
                <li key={seller.key}>
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
      </div>
    </div>
  );
}
