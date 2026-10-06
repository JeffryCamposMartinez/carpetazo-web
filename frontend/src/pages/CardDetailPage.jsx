import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/ToastProvider';
import { wishlistPayloadFromCard } from '../utils/wishlistPayload';
import LoadableImage from '../components/ui/LoadableImage';
import CardLightbox from '../components/ui/CardLightbox';
import CardOffers from '../components/cards/CardOffers';
import CardShare from '../components/cards/CardShare';
import { CardAvailability, RecentSales, TcgplayerRange } from '../components/cards/CardMarketInfo';
import ReportButton from '../components/moderation/ReportButton';
import useCardPriceRanges from '../hooks/useCardPriceRanges';

const formatCLP = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);

// Nombre con el que /cartas filtra cada juego (el servidor guarda otra forma)
const GAME_FILTER = { Pokemon: 'Pokémon', YuGiOh: 'Yu-Gi-Oh!', OnePiece: 'One Piece' };

const DETAILS = [
  ['Juego', 'tcg'], ['Edición', 'set'], ['Rareza', 'rarity'], ['Número', 'number'],
  ['Tipo', 'type'], ['Raza', 'race'], ['Costo', 'cost'],
];

function Reference({ reference }) {
  if (!reference) return null;
  const basis = reference.sales ? `${reference.sales} ventas recientes en Carpetazo` : `lo que piden ${reference.sellers} vendedores en Carpetazo`;
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
      <p className="text-xs font-bold text-slate-500">Precio referencial</p>
      <p className="mt-0.5 text-2xl font-black tabular-nums text-[#12315f]">{formatCLP(reference.clp)}</p>
      <p className="mt-0.5 text-xs text-slate-500">Mediana de {basis}. Es solo una guía.</p>
    </div>
  );
}

function DetailPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1100px] animate-pulse px-3 py-4 sm:px-6" aria-hidden="true">
      <div className="h-4 w-48 rounded bg-white/60" />
      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="aspect-[63/88] rounded-2xl bg-white/60" />
        <div className="space-y-3"><div className="h-8 w-3/4 rounded bg-white/60" /><div className="h-4 w-1/2 rounded bg-white/60" /><div className="h-24 rounded-2xl bg-white/60" /></div>
      </div>
    </div>
  );
}

// Ficha de una carta a la venta: sus datos, el precio referencial y todos los vendedores que la tienen
export default function CardDetailPage() {
  const { cardId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | missing | failed
  const [zoom, setZoom] = useState(false);
  const [wished, setWished] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus('loading'); setData(null); setWished(false);
    api.getCardOffers(cardId)
      .then((json) => { if (active) { setData(json); setStatus('ready'); } })
      .catch((error) => { if (active) setStatus(/no encontrada|404/i.test(error.message || '') ? 'missing' : 'failed'); });
    return () => { active = false; };
  }, [cardId]);

  const card = data?.card;
  const offers = useMemo(() => data?.offers || [], [data]);
  const chosen = offers.find((offer) => offer.id === cardId);
  const best = offers.find((offer) => Number(offer.price) > 0);
  const priceRanges = useCardPriceRanges(card, chosen?.language || best?.language);
  const lightboxCards = useMemo(() => (card ? [{ id: card.id, name: card.name, imageUrl: card.imageUrl }] : []), [card]);

  const addToWishlist = async () => {
    if (!currentUser) { navigate('/bienvenida'); return; }
    if (wished) return;
    setWished(true);
    try {
      await api.addWishlistItem(wishlistPayloadFromCard({ ...card, language: chosen?.language }, card.tcg));
      showToast(`${card.name} agregada a tus deseadas`, { type: 'success', action: { label: 'Ver lista', run: () => navigate('/dashboard?tab=deseadas') } });
    } catch (error) {
      setWished(false);
      showToast(error.message || 'No se pudo agregar la carta', 'error');
    }
  };

  if (status === 'loading') return <DetailPageSkeleton />;
  if (status !== 'ready' || !card) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-[#12315f]">{status === 'missing' ? 'Esta carta ya no está a la venta' : 'No pudimos cargar la carta'}</h1>
        <p className="mt-2 text-sm text-slate-600">{status === 'missing' ? 'Puede que se haya vendido o que el vendedor la haya quitado.' : 'Revisa tu conexión e inténtalo de nuevo.'}</p>
        <Link to="/cartas" className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#1e40af] px-5 text-sm font-bold text-white">Ver cartas en venta</Link>
      </div>
    );
  }

  const details = DETAILS.map(([label, key]) => [label, card[key]]).filter(([, value]) => value && value !== 'Unknown');

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 py-3 sm:px-6 sm:py-6">
      <div className="rounded-[1.6rem] border border-white/70 bg-[#DBEAFE]/95 p-3 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.8)] sm:p-6 md:rounded-[2rem] lg:p-8">
        <nav aria-label="Ruta" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
          <Link to="/cartas" className="font-semibold text-[#1e40af] hover:underline">Cartas en venta</Link>
          <span aria-hidden="true">/</span>
          <span className="min-w-0 truncate">{card.name}</span>
        </nav>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] md:items-start lg:gap-10">
          <div className="mx-auto w-full min-w-0 max-w-[12.5rem] sm:max-w-[16rem] md:col-start-1 md:row-start-1 md:max-w-none">
            <button type="button" onClick={() => setZoom(true)} aria-label={`Ver ${card.name} en pantalla grande`} className="relative block w-full cursor-zoom-in overflow-hidden rounded-2xl bg-white p-2 shadow-[0_18px_40px_-24px_rgba(26,43,75,0.6)] ring-1 ring-slate-900/5 transition-transform duration-150 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]" style={{ aspectRatio: '63 / 88' }}>
              {card.imageUrl ? <LoadableImage src={card.imageUrl} alt={card.name} className="h-full w-full rounded-lg object-contain" /> : <span className="flex h-full items-center justify-center text-sm font-semibold text-slate-400">Sin imagen</span>}
            </button>
          </div>

          <div className="min-w-0 space-y-4 md:col-start-2 md:row-span-2 md:row-start-1">
            <h1 className="text-2xl font-extrabold leading-tight text-[#12315f] [text-wrap:balance] md:text-3xl">{card.name}</h1>

            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
              <p className="text-xs font-bold text-slate-500">{offers.length > 1 ? 'Desde' : 'Precio'}</p>
              <p className="mt-0.5 text-3xl font-black tabular-nums text-[#12315f]">{best ? formatCLP(best.price) : 'Consultar'}</p>
              {best && (
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-slate-600">
                  Vendido por
                  {best.folder.user?.username
                    ? <Link to={`/${best.folder.user.username}`} className="font-extrabold text-[#1e40af] hover:underline">{best.folder.user.name || best.folder.user.username}</Link>
                    : <span className="font-extrabold text-[#12315f]">{best.folder.user?.name || 'un vendedor'}</span>}
                  <span className="text-slate-400">·</span>
                  <span>{offers.length === 1 ? 'único vendedor' : `y ${offers.length - 1} ${offers.length - 1 === 1 ? 'vendedor más' : 'vendedores más'}`}</span>
                </p>
              )}
              {best?.folder.user?.username && (
                <Link to={`/cartas?seller=${encodeURIComponent(best.folder.user.username)}`} className="mt-1 inline-flex min-h-8 items-center gap-1 text-xs font-bold text-[#1e40af] hover:underline focus:outline-none focus-visible:underline">
                  <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[16px]">style</span>
                  Ver más cartas de este vendedor
                </Link>
              )}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {best && (
                  <Link to={`/c/${best.folder.id}`} className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#facc15] sm:flex-1 px-4 text-[15px] font-extrabold text-[#12315f] transition-[background-color,transform] duration-150 hover:bg-[#eab308] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
                    <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px]">folder_open</span>
                    Ver la carpeta del mejor precio
                  </Link>
                )}
                <button type="button" onClick={addToWishlist} aria-pressed={wished} className={`flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-bold ring-1 transition-[background-color,transform] duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${wished ? 'bg-[#facc15] text-[#12315f] ring-[#facc15]' : 'bg-white text-[#12315f] ring-slate-300 hover:bg-slate-50'}`}>
                  <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px]" style={wished ? { fontVariationSettings: "'FILL' 1" } : undefined}>favorite</span>
                  {wished ? 'En tus deseadas' : 'Agregar a deseadas'}
                </button>
              </div>
            </div>

            <CardAvailability stats={data.stats || { copies: offers.reduce((sum, offer) => sum + (offer.stock || 0), 0), sellers: offers.length }} />
            <TcgplayerRange status={priceRanges.status} ranges={priceRanges.ranges} />
            <Reference reference={data.reference} />

            {details.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-900/5">
                {details.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs font-bold text-slate-500">{label}</dt>
                    <dd className="truncate font-semibold text-[#12315f]">
                      {label === 'Juego'
                        ? <Link to={`/cartas?tcg=${encodeURIComponent(GAME_FILTER[value] || value)}`} className="text-[#1e40af] hover:underline">{value}</Link>
                        : value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {card.effect && (
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
                <p className="text-xs font-bold text-slate-500">Habilidad</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{card.effect}</p>
              </div>
            )}
            <RecentSales sales={data.sales || []} />
          </div>
          <div className="min-w-0 md:col-start-1 md:row-start-2">
            <CardShare cardId={chosen?.id || card.id} name={card.name} message={`¡Mira esta carta en Carpetazo! ${card.name}${best ? ` desde ${formatCLP(best.price)}` : ''}`} showToast={showToast}>
              <ReportButton targetType="card" targetId={chosen?.id || best?.id || card.id} label="Reportar esta publicación" className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-red-600" />
            </CardShare>
          </div>
        </div>

        <CardOffers offers={offers} chosenId={cardId} />
      </div>

      {zoom && <CardLightbox cards={lightboxCards} cardId={card.id} onChange={() => {}} onClose={() => setZoom(false)} describe={() => ({ subtitle: [card.set, card.rarity].filter(Boolean).join(' • '), chips: [] })} />}
    </div>
  );
}
