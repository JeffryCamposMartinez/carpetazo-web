import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/ToastProvider';
import LoadableImage from '../components/ui/LoadableImage';
import SvgIcon from '../components/ui/SvgIcon';
import usePageMeta from '../hooks/usePageMeta';
import { catalogLink } from '../utils/catalogLink';

const formatCLP = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);
const WISHLIST_CATEGORIES = new Set([1, 2, 3, 68, 85, 89]); // juegos que la lista de deseadas acepta desde el catálogo de TCGplayer
const GAME_FILTER = { Pokemon: 'Pokémon', Pokemon_Japan: 'Pokémon', One_Piece: 'One Piece', Magic: 'Magic', YuGiOh: 'Yu-Gi-Oh!', Riftbound: 'Riftbound', Disney_Lorcana: 'Lorcana', Digimon_Card_Game: 'Digimon' };

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1100px] animate-pulse px-3 py-4 sm:px-6" aria-hidden="true">
      <div className="mt-2 grid gap-6 md:grid-cols-[minmax(0,21rem)_1fr]">
        <div className="aspect-[63/88] rounded-2xl bg-white/60" />
        <div className="space-y-3"><div className="h-8 w-3/4 rounded bg-white/60" /><div className="h-24 rounded-2xl bg-white/60" /><div className="h-32 rounded-2xl bg-white/60" /></div>
      </div>
    </div>
  );
}

// Ficha de una carta del catálogo, la tenga alguien a la venta o no: sus datos, quién la vende y cómo pedir que te avisen
export default function CatalogCardPage() {
  const { productId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | missing | failed
  const [wished, setWished] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus('loading'); setData(null); setWished(false);
    api.getCatalogCard(productId)
      .then((json) => { if (active) { setData(json); setStatus('ready'); } })
      .catch((error) => { if (active) setStatus(/no encontrada|404/i.test(error.message || '') ? 'missing' : 'failed'); });
    return () => { active = false; };
  }, [productId]);

  const card = data?.card;
  const offers = data?.offers || [];
  const where = card ? [card.set, card.gameLabel].filter(Boolean).join(', ') : '';
  usePageMeta(card ? {
    title: `${card.name}${card.set ? ` (${card.set})` : ''} - ${card.gameLabel}${data.low ? ` desde ${formatCLP(data.low)}` : ''} | Carpetazo`,
    description: offers.length
      ? `${card.name}${where ? ` (${where})` : ''}: ${offers.length} ${offers.length === 1 ? 'oferta' : 'ofertas'} en Chile desde ${formatCLP(data.low)}. Compra cartas ${card.gameLabel} a vendedores chilenos en Carpetazo.`
      : `${card.name}${where ? ` (${where})` : ''}. Datos de la carta y aviso cuando un vendedor chileno la publique en Carpetazo, el mercado de cartas TCG en Chile.`,
    path: card.path,
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'Product', name: card.name, sku: String(card.productId), category: card.gameLabel,
      ...(/^https:\/\//.test(card.imageUrl || '') ? { image: card.imageUrl } : {}),
      url: `https://carpetazo.cl${card.path}`,
      ...(data.low ? { offers: { '@type': 'AggregateOffer', priceCurrency: 'CLP', lowPrice: Math.round(data.low), highPrice: Math.round(data.high), offerCount: offers.length, availability: 'https://schema.org/InStock' } } : {}),
    },
  } : {});

  const canWish = card && WISHLIST_CATEGORIES.has(card.categoryId);
  const addToWishlist = async () => {
    if (!currentUser) { navigate('/bienvenida'); return; }
    if (wished) return;
    setWished(true);
    try {
      await api.addWishlistItem({ name: card.name.slice(0, 100), imageUrl: card.imageUrl || undefined, detail: card.set ? card.set.slice(0, 100) : undefined, external: { categoryId: card.categoryId, productId: String(card.productId) } });
      showToast(`${card.name} agregada a tus deseadas`, { type: 'success', action: { label: 'Ver lista', run: () => navigate('/dashboard?tab=deseadas') } });
    } catch (error) {
      setWished(false);
      showToast(error.message || 'No se pudo agregar la carta', 'error');
    }
  };

  if (status === 'loading') return <PageSkeleton />;
  if (status !== 'ready' || !card) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-[#12315f]">{status === 'missing' ? 'No encontramos esta carta' : 'No pudimos cargar la carta'}</h1>
        <p className="mt-2 text-sm text-slate-600">{status === 'missing' ? 'Puede que el enlace esté incompleto. Búscala por su nombre.' : 'Revisa tu conexión e inténtalo de nuevo.'}</p>
        <Link to="/cartas" className="mt-6 inline-flex h-11 items-center rounded-xl bg-[#1e40af] px-5 text-sm font-bold text-white">Buscar cartas</Link>
      </div>
    );
  }

  const details = [['Juego', card.gameLabel], ['Edición', card.set], ['Número', card.number], ['Rareza', card.rarity]].filter(([, value]) => value);
  const best = offers.find((offer) => Number(offer.price) > 0);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 py-3 sm:px-6 sm:py-6">
      <div className="rounded-[1.6rem] border border-white/70 bg-[#DBEAFE]/95 p-3 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.8)] sm:p-6 md:rounded-[2rem] lg:p-8">
        <nav aria-label="Ruta" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-slate-600">
          <Link to="/cartas" className="font-semibold text-[#1e40af] hover:underline">Cartas</Link>
          <span aria-hidden="true">/</span>
          <span className="min-w-0 truncate">{card.name}</span>
        </nav>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] md:items-start lg:gap-10">
          <div className="mx-auto w-full max-w-[12.5rem] sm:max-w-[16rem] md:max-w-none">
            <div className="relative aspect-[63/88] overflow-hidden rounded-2xl bg-white p-2 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.7)]">
              {card.imageUrl && <LoadableImage src={card.imageUrl} alt={card.name} rotateLandscape className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-lg object-contain" />}
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <h1 className="text-2xl font-extrabold leading-tight text-[#12315f] [text-wrap:balance] md:text-3xl">{card.name}</h1>

            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
              {offers.length > 0 ? (
                <>
                  <p className="text-xs font-bold text-slate-500">{offers.length > 1 ? 'Desde' : 'Precio'}</p>
                  <p className="mt-0.5 text-3xl font-black tabular-nums text-[#12315f]">{best ? formatCLP(best.price) : 'Consultar'}</p>
                  <p className="mt-1 text-sm text-slate-600">{offers.length} {offers.length === 1 ? 'oferta' : 'ofertas'} en Carpetazo</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-extrabold text-[#12315f]">Nadie la vende por ahora</p>
                  <p className="mt-1 text-sm text-slate-600">{canWish ? 'Agrégala a tus deseadas y te avisamos cuando un vendedor la publique.' : 'Cuando un vendedor la publique, aparecerá aquí.'}</p>
                </>
              )}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {best && (
                  <Link to={`/carta/${best.id}`} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#facc15] px-4 text-[15px] font-extrabold text-[#12315f] transition-[background-color,transform] duration-150 hover:bg-[#fbbf24] active:scale-[0.98] sm:flex-1">
                    <SvgIcon name="shopping_bag" translate="no" aria-hidden="true" className="text-[22px]" />Ver la oferta más barata
                  </Link>
                )}
                {canWish && (
                  <button type="button" onClick={addToWishlist} aria-pressed={wished} className={`flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-bold ring-1 transition-[background-color,transform] duration-150 active:scale-[0.98] sm:flex-1 ${wished ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-white text-[#12315f] ring-slate-300 hover:bg-slate-50'}`}>
                    <SvgIcon name="favorite" translate="no" aria-hidden="true" className="text-[22px]" style={wished ? { fontVariationSettings: "'FILL' 1" } : undefined} />
                    {wished ? 'En tus deseadas' : 'Agregar a deseadas'}
                  </button>
                )}
              </div>
            </div>

            {details.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-2xl bg-white p-4 text-sm ring-1 ring-slate-900/5">
                {details.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs font-bold text-slate-500">{label}</dt>
                    <dd className="truncate font-semibold text-[#12315f]">
                      {label === 'Juego' ? <Link to={`/cartas?tcg=${encodeURIComponent(GAME_FILTER[card.game] || value)}`} className="text-[#1e40af] hover:underline">{value}</Link> : value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {card.text && (
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
                <p className="text-xs font-bold text-slate-500">Texto de la carta</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{card.text}</p>
              </div>
            )}
          </div>
        </div>

        {offers.length > 0 && (
          <section aria-label="Ofertas" className="mt-6">
            <h2 className="text-lg font-extrabold text-[#12315f]">Ofertas en Carpetazo</h2>
            <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/5">
              {offers.map((offer) => (
                <li key={offer.id}>
                  <Link to={`/carta/${offer.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold text-[#12315f]">{offer.seller.name || offer.seller.username || 'Vendedor'}</span>
                      <span className="block truncate text-xs text-slate-500">{[offer.seller.comuna, offer.language, `${offer.stock} ${offer.stock === 1 ? 'unidad' : 'unidades'}`].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="shrink-0 text-base font-black tabular-nums text-[#12315f]">{offer.price ? formatCLP(offer.price) : 'Consultar'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.others.length > 0 && (
          <section aria-label="Otras versiones" className="mt-6">
            <h2 className="text-lg font-extrabold text-[#12315f]">Otras versiones de esta carta</h2>
            <ul className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {data.others.map((other) => (
                <li key={other.productId} className="min-w-0">
                  <Link to={other.path} className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
                    <span className="relative block aspect-[63/88] overflow-hidden rounded-xl bg-white ring-1 ring-slate-900/5 transition-transform duration-150 group-hover:-translate-y-0.5">
                      {other.imageUrl && <LoadableImage src={other.imageUrl} alt={other.name} loading="lazy" compact className="absolute inset-0 h-full w-full object-contain" />}
                    </span>
                    <span className="mt-1 block truncate text-xs font-bold text-[#12315f]">{other.set || other.name}</span>
                    {other.number && <span className="block truncate text-xs text-slate-500">{other.number}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
