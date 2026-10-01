import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import LazyFolderCard from '../LazyFolderCard';

const GAMES = [
  { name: 'Pokémon', logo: '/images/logos/pokemon.webp', scale: 'scale-100' },
  { name: 'Mitos y Leyendas', logo: '/images/logos/mitosyleyendas.webp', scale: 'scale-[1.22]' },
  { name: 'Yu-Gi-Oh!', logo: '/images/logos/yugioh.webp', scale: 'scale-[2]' },
  { name: 'Magic', logo: '/images/logos/magic.webp', scale: 'scale-[1.4]' },
  { name: 'One Piece', logo: '/images/logos/onepiece.webp', scale: 'scale-[1.4]' },
  { name: 'Riftbound', logo: '/images/logos/riftbound.webp', scale: 'scale-100' },
];

const normalize = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const formatNumber = (value) => Number(value || 0).toLocaleString('es-CL');
const formatPrice = (value) => (Number(value) > 0 ? `$${formatNumber(value)}` : 'Sin precio');

const timeAgo = (iso) => {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
};

const LANGUAGE_CODES = { English: 'EN', Spanish: 'ES', Japanese: 'JP' };
const isMyl = (tcg) => normalize(tcg) === 'mitos y leyendas';

function SectionHeader({ id, title, note, to, linkLabel }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
      <div>
        <h3 id={id} className="text-xl font-extrabold tracking-tight text-[#1a2b4b] sm:text-2xl">{title}</h3>
        {note && <p className="mt-0.5 max-w-prose text-sm text-[#1a2b4b]/65">{note}</p>}
      </div>
      {to && (
        <Link to={to} className="rounded text-sm font-semibold text-[#1e40af] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e40af]">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

function Avatar({ src, name, className = 'h-11 w-11' }) {
  // Si la foto no carga (p. ej. avatar de Google bloqueado), se muestra la inicial
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img src={src} alt="" className={`${className} shrink-0 rounded-full object-cover ring-2 ring-white`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  ) : (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-full bg-[#1e40af] font-black text-white ring-2 ring-white`}>
      {String(name || 'U').charAt(0).toUpperCase()}
    </div>
  );
}

function Skeleton({ className }) {
  return <div className={`animate-pulse rounded-xl bg-[#1a2b4b]/10 ${className}`} />;
}

// Estante con las carpetas más visitadas de la semana
function VisitedFolders({ folders }) {
  if (folders.length === 0) return null;
  return (
    <section aria-labelledby="destacados-carpetas">
      <SectionHeader
        id="destacados-carpetas"
        title="Carpetas más visitadas"
        note="Las que más compradores han abierto esta semana."
        to="/carpetas"
        linkLabel="Ver todas las carpetas"
      />
      <div className="-mx-4 flex scroll-px-4 snap-x gap-4 overflow-x-auto px-4 pb-1 pt-5 lg:mx-0 lg:scroll-px-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {folders.map((folder, index) => (
          <div key={folder.id} className="relative w-[44vw] max-w-[220px] shrink-0 snap-start sm:w-[30vw] lg:w-auto lg:max-w-none">
            <span
              className="absolute -top-3 left-1 z-20 flex h-7 min-w-7 items-center justify-center rounded-full bg-[#facc15] px-2 text-sm font-black text-[#1a2b4b] shadow-md"
              aria-label={`Puesto ${index + 1}`}
            >
              #{index + 1}
            </span>
            <LazyFolderCard folder={folder} />
          </div>
        ))}
      </div>
      {/* la repisa donde "descansan" las carpetas */}
      <div aria-hidden="true" className="-mt-1 h-3 rounded-full bg-gradient-to-b from-[#1e3a8a] to-[#172554] shadow-[0_14px_20px_-10px_rgba(30,58,138,0.55)]" />
      <div className="mt-3 flex snap-x gap-4 overflow-x-auto px-0 lg:grid lg:grid-cols-5 lg:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {folders.map((folder) => (
          <p key={folder.id} className="w-[44vw] max-w-[220px] shrink-0 snap-start text-center text-sm text-[#1a2b4b]/70 sm:w-[30vw] lg:w-auto lg:max-w-none">
            {folder.validWeeklyVisits > 0
              ? <><strong className="font-bold text-[#1a2b4b]">{formatNumber(folder.validWeeklyVisits)}</strong> visitas esta semana</>
              : <><strong className="font-bold text-[#1a2b4b]">{formatNumber(folder.validTotalVisits)}</strong> visitas en total</>}
          </p>
        ))}
      </div>
    </section>
  );
}

// Ranking de vendedores según las visitas a sus carpetas públicas
function TopSellers({ sellers }) {
  if (sellers.length === 0) return null;
  const leader = Math.max(1, sellers[0].visits);
  return (
    <section aria-labelledby="destacados-vendedores">
      <SectionHeader id="destacados-vendedores" title="Vendedores más visitados" note="Suman las visitas de todas sus carpetas públicas." to="/vendedores" linkLabel="Ver vendedores" />
      <ol className="divide-y divide-[#1a2b4b]/10 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#1a2b4b]/10">
        {sellers.map((seller, index) => {
          const content = (
            <>
              <span className="w-6 shrink-0 text-center text-lg font-black tabular-nums text-[#1e40af]">{index + 1}</span>
              <Avatar src={seller.photoURL} name={seller.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-[#1a2b4b]">{seller.name}</p>
                <p className="truncate text-xs text-[#1a2b4b]/60">
                  {seller.username ? `@${seller.username}` : 'Vendedor'} · {seller.folders} {seller.folders === 1 ? 'carpeta' : 'carpetas'} · {formatNumber(seller.cards)} cartas
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#1e40af]/10" role="presentation">
                    <div className="h-full rounded-full bg-[#1e40af]" style={{ width: `${Math.max(4, Math.round((seller.visits / leader) * 100))}%` }} />
                  </div>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-[#1a2b4b]">{formatNumber(seller.visits)} visitas</span>
                </div>
              </div>
            </>
          );
          const rowClass = 'flex items-center gap-3 px-4 py-3.5 sm:gap-4';
          return (
            <li key={seller.key}>
              {seller.username ? (
                <Link to={`/${seller.username}`} className={`${rowClass} transition-colors hover:bg-[#dbeafe]/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1e40af]`}>{content}</Link>
              ) : (
                <div className={rowClass}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// Carpetas recién publicadas
function NewFolders({ folders }) {
  if (folders.length === 0) return null;
  return (
    <section aria-labelledby="destacados-nuevas">
      <SectionHeader id="destacados-nuevas" title="Carpetas nuevas" note="Recién publicadas." />
      <ul className="space-y-2">
        {folders.map((folder) => (
          <li key={folder.id}>
            <Link
              to={`/c/${folder.id}`}
              className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-[#1a2b4b]/10 transition-colors hover:bg-[#dbeafe]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1e40af]"
            >
              <Avatar src={folder.user?.photoURL} name={folder.user?.name || folder.user?.username} className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#1a2b4b]">{folder.name}</p>
                <p className="truncate text-xs text-[#1a2b4b]/60">{folder.tcg} · {folder.user?.name || folder.user?.username || 'Vendedor'}</p>
              </div>
              <span className="shrink-0 text-xs text-[#1a2b4b]/55">{timeAgo(folder.createdAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Mosaico de cartas: la más nueva ocupa el doble
function RecentCards({ cards, loading }) {
  const visible = cards.slice(0, 9);
  return (
    <section aria-labelledby="destacados-cartas">
      <SectionHeader id="destacados-cartas" title="Cartas subidas hace poco" note="Lo último que publicaron los vendedores, con stock disponible." to="/cartas" linkLabel="Buscar cartas" />
      {loading ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[63/88]" />)}
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-[#1a2b4b]/70 ring-1 ring-[#1a2b4b]/10">
          Todavía no hay cartas nuevas. Publica las tuyas y aparecerán aquí.
        </p>
      ) : (
        <div className="grid grid-cols-3 items-start gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {visible.map((card, index) => {
            const big = index === 0;
            const myl = isMyl(card.folder?.tcg);
            const detail = !myl && card.language ? `${LANGUAGE_CODES[card.language] || card.language}${card.set ? ` · ${card.set}` : ''}` : card.set;
            return (
              <Link
                key={card.id}
                to={`/c/${card.folder.id}`}
                title={`${card.name} · ${card.folder.name}`}
                className={`group relative block overflow-hidden rounded-xl bg-[#1a2b4b]/10 ring-1 ring-[#1a2b4b]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e40af] ${big ? 'lg:col-span-2 lg:row-span-2 lg:h-full' : ''} ${index === 8 ? 'sm:max-lg:hidden' : ''}`}
                style={{ aspectRatio: myl ? '709 / 1016' : '63 / 88' }}
              >
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                />
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/80 via-black/25 to-transparent px-1.5 pb-1.5 pt-8 text-white sm:px-2 sm:pb-2 sm:via-black/45">
                  <p className={`hidden truncate text-xs font-bold leading-tight sm:block sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100 ${big ? 'lg:text-base lg:opacity-100' : ''}`}>{card.name}</p>
                  {detail && (
                    <p className={`hidden truncate text-[11px] text-white/75 sm:block sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100 ${big ? 'lg:opacity-100' : ''}`}>{detail}</p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-[#facc15] px-1.5 py-0.5 text-[11px] font-black text-[#1a2b4b]">{formatPrice(card.price)}</span>
                    <span className="hidden truncate text-[10px] text-white/75 sm:inline">{timeAgo(card.createdAt)}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

// Entrada por juego, con cuántas carpetas públicas tiene cada uno
function BrowseByGame({ counts, loading }) {
  return (
    <section aria-labelledby="destacados-juegos">
      <SectionHeader id="destacados-juegos" title="Explora por juego" note="Entra directo a las carpetas del TCG que coleccionas." />
      <div className="-mx-4 flex scroll-px-4 snap-x gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:mx-0 sm:scroll-px-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {GAMES.map((game) => {
          const count = counts[normalize(game.name)] || 0;
          return (
            <Link
              key={game.name}
              to={`/carpetas?tcg=${encodeURIComponent(game.name)}`}
              className="group flex w-[36vw] max-w-[170px] shrink-0 snap-start flex-col items-center gap-2 rounded-2xl bg-white px-3 pb-3.5 pt-4 shadow-[0_1px_2px_rgba(26,43,75,0.06),0_10px_24px_-16px_rgba(26,43,75,0.35)] ring-1 ring-[#1a2b4b]/8 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_30px_-16px_rgba(26,43,75,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e40af] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-auto sm:max-w-none"
            >
              <div className="flex h-16 w-full items-center justify-center">
                <img src={game.logo} alt={game.name} className={`max-h-full max-w-[80%] object-contain ${game.scale}`} loading="lazy" />
              </div>
              <span className="text-xs font-semibold text-[#1a2b4b]/65">
                {loading ? ' ' : count > 0 ? `${count} ${count === 1 ? 'carpeta' : 'carpetas'}` : 'Sin carpetas aún'}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function FeaturedZone({ recentCards = [], loadingCards = false }) {
  // Un solo pedido trae lo que muestra la portada (carpetas más visitadas, nuevas, mejores vendedores y cifras)
  const [data, setData] = useState(null);
  const [loadingFolders, setLoadingFolders] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getFeatured()
      .then((res) => { if (!cancelled && res.success) setData(res); })
      .catch((error) => console.error('Error cargando carpetas destacadas:', error))
      .finally(() => { if (!cancelled) setLoadingFolders(false); });
    return () => { cancelled = true; };
  }, []);

  const visitedFolders = data?.visited || [];
  const newFolders = data?.newest || [];
  const sellers = useMemo(() => (data?.topSellers || []).map((seller) => ({ key: seller.username || seller.name, name: seller.name || seller.username || 'Vendedor', username: seller.username, photoURL: seller.photoURL, visits: seller.visits, folders: seller.folders, cards: seller.cards })), [data]);
  const stats = data?.stats || { folders: 0, sellers: 0, cards: 0 };
  const gameCounts = useMemo(() => {
    const counts = {};
    (data?.counts || []).forEach(({ tcg, count }) => { const key = normalize(tcg); counts[key] = (counts[key] || 0) + count; });
    return counts;
  }, [data]);

  return (
    <div className="w-full pb-16 pt-8 sm:pt-10">
      <BrowseByGame counts={gameCounts} loading={loadingFolders} />

      <div className="mb-8 mt-12 sm:mt-14">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#1a2b4b] sm:text-4xl">Destacados</h2>
        {!loadingFolders && stats.folders > 0 && (
          <p className="mt-2 max-w-prose text-base text-[#1a2b4b]/75">
            Hoy hay <strong className="font-bold tabular-nums text-[#1a2b4b]">{formatNumber(stats.folders)}</strong> carpetas públicas de{' '}
            <strong className="font-bold tabular-nums text-[#1a2b4b]">{formatNumber(stats.sellers)}</strong> vendedores, con{' '}
            <strong className="font-bold tabular-nums text-[#1a2b4b]">{formatNumber(stats.cards)}</strong> cartas.
          </p>
        )}
      </div>

      {loadingFolders ? (
        <div className="space-y-10">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="aspect-[32/37]" />)}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : (
        <div className="space-y-14 sm:space-y-16">
          <VisitedFolders folders={visitedFolders} />
          <RecentCards cards={recentCards} loading={loadingCards} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <TopSellers sellers={sellers} />
            <NewFolders folders={newFolders} />
          </div>
        </div>
      )}
    </div>
  );
}
