import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import LazyFolderCard from '../LazyFolderCard';

const GAMES = [
  { name: 'Pokémon', logo: '/images/logos/pokemon.webp', scale: 'scale-100' },
  { name: 'Mitos y Leyendas', logo: '/images/logos/mitosyleyendas.webp', scale: 'scale-[1.3]' },
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
  return src ? (
    <img src={src} alt="" className={`${className} shrink-0 rounded-full object-cover ring-2 ring-white`} loading="lazy" />
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
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1 pt-5 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2 pb-2 pt-8 text-white">
                  <p className={`truncate font-bold leading-tight ${big ? 'text-sm sm:text-base' : 'text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'}`}>{card.name}</p>
                  {detail && (
                    <p className={`truncate text-[11px] text-white/75 ${big ? '' : 'hidden opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:block'}`}>{detail}</p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-[#facc15] px-1.5 py-0.5 text-[11px] font-black text-[#1a2b4b]">{formatPrice(card.price)}</span>
                    <span className="truncate text-[10px] text-white/75">{timeAgo(card.createdAt)}</span>
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
function BrowseByGame({ counts }) {
  return (
    <section aria-labelledby="destacados-juegos">
      <SectionHeader id="destacados-juegos" title="Explora por juego" note="Entra directo a las carpetas del TCG que coleccionas." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {GAMES.map((game) => {
          const count = counts[normalize(game.name)] || 0;
          return (
            <Link
              key={game.name}
              to={`/carpetas?tcg=${encodeURIComponent(game.name)}`}
              className="group flex flex-col items-center gap-2 rounded-2xl bg-white px-3 pb-3 pt-4 shadow-sm ring-1 ring-[#1a2b4b]/10 transition-shadow hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1e40af]"
            >
              <div className="flex h-14 w-full items-center justify-center overflow-hidden">
                <img src={game.logo} alt={game.name} className={`max-h-full max-w-[80%] object-contain ${game.scale}`} loading="lazy" />
              </div>
              <span className="text-xs font-semibold text-[#1a2b4b]/70">
                {count > 0 ? `${count} ${count === 1 ? 'carpeta' : 'carpetas'}` : 'Sin carpetas aún'}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function FeaturedZone() {
  const [folders, setFolders] = useState([]);
  const [recentCards, setRecentCards] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingCards, setLoadingCards] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const currentWeek = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));

    api.getPublicFolders()
      .then((res) => {
        if (cancelled) return;
        const list = res.success ? res.folders : [];
        list.forEach((folder) => {
          folder.validWeeklyVisits = folder.lastVisitWeek === currentWeek ? (folder.weeklyVisits || 0) : 0;
          folder.validTotalVisits = folder.totalVisits || 0;
        });
        setFolders(list);
      })
      .catch((error) => console.error('Error cargando carpetas destacadas:', error))
      .finally(() => { if (!cancelled) setLoadingFolders(false); });

    api.getRecentCards(9)
      .then((res) => { if (!cancelled) setRecentCards(res.success ? res.cards : []); })
      .catch(() => { /* la sección muestra su estado vacío */ })
      .finally(() => { if (!cancelled) setLoadingCards(false); });

    return () => { cancelled = true; };
  }, []);

  const visitedFolders = useMemo(
    () => [...folders]
      .sort((a, b) => (b.validWeeklyVisits - a.validWeeklyVisits) || (b.validTotalVisits - a.validTotalVisits))
      .slice(0, 5),
    [folders]
  );

  const newFolders = useMemo(
    () => [...folders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
    [folders]
  );

  const sellers = useMemo(() => {
    const map = new Map();
    folders.forEach((folder) => {
      const user = folder.user || {};
      const key = user.username || user.firebaseUid || folder.userId || folder.id;
      const entry = map.get(key) || { key, name: user.name || user.username || 'Vendedor', username: user.username, photoURL: user.photoURL, visits: 0, folders: 0, cards: 0 };
      entry.visits += folder.validTotalVisits || 0;
      entry.folders += 1;
      entry.cards += folder._count?.cards || 0;
      map.set(key, entry);
    });
    return [...map.values()].sort((a, b) => (b.visits - a.visits) || (b.cards - a.cards)).slice(0, 5);
  }, [folders]);

  const stats = useMemo(() => ({
    folders: folders.length,
    sellers: new Set(folders.map((f) => f.user?.username || f.userId)).size,
    cards: folders.reduce((sum, f) => sum + (f._count?.cards || 0), 0),
  }), [folders]);

  const gameCounts = useMemo(() => {
    const counts = {};
    folders.forEach((f) => { const key = normalize(f.tcg); counts[key] = (counts[key] || 0) + 1; });
    return counts;
  }, [folders]);

  return (
    <div className="w-full max-w-[1200px] pb-16">
      <div className="mb-10 border-t border-[#1a2b4b]/10 pt-10">
        <h2 className="text-3xl font-black tracking-tight text-[#1a2b4b] sm:text-4xl">Destacados</h2>
        {!loadingFolders && stats.folders > 0 && (
          <p className="mt-2 max-w-prose text-base text-[#1a2b4b]/75">
            Hoy hay <strong className="font-bold text-[#1a2b4b]">{formatNumber(stats.folders)}</strong> carpetas públicas de{' '}
            <strong className="font-bold text-[#1a2b4b]">{formatNumber(stats.sellers)}</strong> vendedores, con{' '}
            <strong className="font-bold text-[#1a2b4b]">{formatNumber(stats.cards)}</strong> cartas.
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
        <div className="space-y-14">
          <VisitedFolders folders={visitedFolders} />
          <RecentCards cards={recentCards} loading={loadingCards} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <TopSellers sellers={sellers} />
            <NewFolders folders={newFolders} />
          </div>
          <BrowseByGame counts={gameCounts} />
        </div>
      )}
    </div>
  );
}
