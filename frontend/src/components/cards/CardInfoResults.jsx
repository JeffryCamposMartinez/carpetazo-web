import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/ToastProvider';
import LoadableImage, { LoadingMark } from '../ui/LoadableImage';
import CardLightbox from '../ui/CardLightbox';
import AddToFolderModal from './AddToFolderModal';
import CardsPagination from './CardsPagination';
import useWishlistIndex, { wishlistKeyOf } from '../../hooks/useWishlistIndex';
import useCardInfoSearch, { INFO_PAGE } from '../../hooks/useCardInfoSearch';
import useReferencePrices from '../../hooks/useReferencePrices';
import { ReferencePriceLine } from '../folder/ReferencePrice';
import { formatClp } from '../../services/tcgcsvPrices';
import { cardFill, cardRatio } from '../../utils/cardShape';
import SvgIcon from '../ui/SvgIcon';
import { catalogLink } from '../../utils/catalogLink';

const NOTE = 'Referencia del catálogo: esta ficha no es una oferta de venta.';
const tcgplayerImage = (card) => {
  const id = card?.tcgProductId || card?.productId || card?.payload?.external?.productId;
  return id ? `https://tcgplayer-cdn.tcgplayer.com/product/${encodeURIComponent(String(id))}_400w.jpg` : '';
};

// Cuando una carta no está a la venta: las que coinciden en el catálogo (TCGCSV), para ver su imagen y datos. No tienen precio ni compra.
export default function CardInfoResults({ query, game, enabled, hasOffers = false, sort = '' }) {
  const [page, setPage] = useState(1);
  const { results, searching, exhausted, pages: indexedPages, total: indexedTotal } = useCardInfoSearch({ query, game, enabled, page, sort });
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState(null);
  const [wished, setWished] = useState({});
  const wishlistIndex = useWishlistIndex(Boolean(currentUser));
  // Lo que hizo la persona en esta pantalla manda; si no hizo nada con esa carta, vale lo que ya tenía en sus listas
  const stateOf = (card) => (wished[card.id] !== undefined ? wished[card.id] : (wishlistIndex.get(wishlistKeyOf(card.payload)) || false));
  const [addTarget, setAddTarget] = useState(null);

  useEffect(() => { setPage(1); }, [query, game, sort]);
  // Si la última página quedó vacía porque ya no hay más ediciones, se vuelve a la última con cartas
  const known = indexedPages || Math.max(1, Math.ceil(results.length / INFO_PAGE));
  useEffect(() => { if (exhausted && page > known) setPage(known); }, [exhausted, page, known]);

  // El índice remoto ya devuelve la página solicitada; el fallback antiguo devuelve la lista acumulada.
  const shown = indexedTotal > results.length || indexedPages > 1
    ? results
    : results.slice((page - 1) * INFO_PAGE, page * INFO_PAGE);
  // Precio de mercado de TCGplayer como referencia (Mitos y Leyendas no está en TCGplayer)
  const { variantsFor } = useReferencePrices(shown.filter((card) => card.groupId), 'pokemon');

  if (!enabled) return null;

  const goToPage = (next) => { setPage(next); document.getElementById('cartas-informativas')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); };

  // wished[id]: id del ítem en la lista (ya agregada), 'pending' mientras se guarda, o vacío. Tocar el corazón otra vez la quita.
  const wish = async (card) => {
    if (!currentUser) { navigate('/bienvenida'); return; }
    const current = stateOf(card);
    if (current === 'pending') return;
    if (current) {
      setWished((previous) => ({ ...previous, [card.id]: false })); // el corazón responde al instante
      try {
        await api.deleteWishlistItem(current);
        showToast(`${card.name} quitada de tus deseadas`, 'success');
      } catch (error) {
        setWished((previous) => ({ ...previous, [card.id]: current }));
        showToast(error.message || 'No se pudo quitar la carta', 'error');
      }
      return;
    }
    setWished((previous) => ({ ...previous, [card.id]: 'pending' }));
    try {
      const response = await api.addWishlistItem(card.payload);
      setWished((previous) => ({ ...previous, [card.id]: response?.item?.id || 'pending' }));
      showToast(`${card.name} agregada a tus deseadas`, { type: 'success', action: { label: 'Ver lista', run: () => navigate('/dashboard?tab=deseadas') } });
    } catch (error) {
      setWished((previous) => ({ ...previous, [card.id]: false }));
      showToast(error.message || 'No se pudo agregar la carta', 'error');
    }
  };

  const addToFolder = (card) => {
    if (!currentUser) { navigate('/bienvenida'); return; }
    setAddTarget(card);
  };

  return (
    <section id="cartas-informativas" aria-label="Coincidencias del catálogo" className="mt-5 scroll-mt-28">
      <div className="mb-3 flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
        <SvgIcon name="info" translate="no" aria-hidden="true" className="mt-0.5 text-[24px] text-[#1e40af]" />
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-[#12315f]">{hasOffers ? `Más coincidencias del catálogo para "${query.trim()}"` : `Sin ofertas para "${query.trim()}": busca también en el catálogo`}</h2>
          <p className="mt-0.5 text-sm text-slate-600">Coincidencias por nombre o similitud. Estas fichas son informativas, no ofertas de venta; la disponibilidad se muestra en los resultados de arriba. Puedes agregarlas a tus deseadas.</p>
        </div>
      </div>

      {shown.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {shown.map((card, index) => (
            <li key={card.id}>
              <div className="@container relative block w-full rounded-2xl bg-white p-2 ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(26,43,75,0.06),0_10px_24px_-18px_rgba(26,43,75,0.4)]">
              <button type="button" onClick={() => setOpenId(card.id)} className="group block w-full rounded-xl text-left transition-transform duration-150 active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
                <div className="relative w-full overflow-hidden rounded-xl bg-slate-50" style={{ aspectRatio: cardRatio(card.game) }}>
                  {card.imageUrl || tcgplayerImage(card) ? <LoadableImage loading={index < 10 ? 'eager' : 'lazy'} src={card.imageUrl || tcgplayerImage(card)} fallbackSrc={card.imageUrl ? tcgplayerImage(card) : undefined} alt={card.name} rotateLandscape className="h-full w-full object-contain" style={cardFill(card.game)} /> : <span className="flex h-full items-center justify-center text-xs font-semibold text-slate-400">Sin imagen</span>}
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-[#12315f]/90 px-2 py-0.5 text-[11px] font-extrabold text-white">Catálogo</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-extrabold leading-snug text-[#12315f]">{card.name}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{card.setName}</p>
              </button>
              <div className="mt-1 flex items-center justify-between gap-2">
                <ReferencePriceLine variants={card.groupId ? variantsFor(card) : null} className="shrink-0 text-xs" />
                <button type="button" onClick={() => addToFolder(card)} title="Agregar a mi carpeta" className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center gap-0.5 rounded-lg bg-[#1e40af] px-0 text-xs font-extrabold @[10.5rem]:w-auto @[10.5rem]:pl-1.5 @[10.5rem]:pr-2.5 text-white transition-[background-color,transform] duration-150 hover:bg-[#12315f] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
                  <SvgIcon name="add" translate="no" aria-hidden="true" className="text-[16px]" /><span aria-hidden="true" className="hidden @[10.5rem]:inline">Agregar</span><span className="sr-only">Agregar a mi carpeta</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => wish(card)}
                aria-pressed={Boolean(stateOf(card))}
                aria-label={stateOf(card) ? `Quitar ${card.name} de mis deseadas` : `Agregar ${card.name} a mis deseadas`}
                className={`absolute right-3.5 top-3.5 z-10 flex h-11 w-11 items-center justify-center rounded-full shadow-md ring-1 ring-black/10 transition-[transform,background-color] duration-150 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${stateOf(card) ? 'bg-[#facc15]/90 text-[#12315f]' : 'bg-white/55 text-[#12315f] backdrop-blur-sm hover:bg-white/80'}`}
              >
                <SvgIcon name="favorite" key={stateOf(card) ? 'on' : 'off'} translate="no" aria-hidden="true" className={`text-[24px] ${stateOf(card) ? 'heart-pop' : ''}`} style={stateOf(card) ? { fontVariationSettings: "'FILL' 1" } : undefined} />
              </button>
                            </div>
            </li>
          ))}
        </ul>
      )}

      {searching && (
        <div role="status" className="flex flex-col items-center py-6">
          <LoadingMark className="relative" />
          <span className="sr-only">Buscando en el catálogo…</span>
        </div>
      )}
      {!searching && exhausted && results.length === 0 && <p className="py-6 text-center text-sm text-slate-600">Tampoco encontramos esa carta en el catálogo. Revisa el nombre.</p>}
      <CardsPagination page={page} pages={known} openEnded={!exhausted} onPage={goToPage} />

      {openId && (
        <CardLightbox
          cards={shown}
          cardId={openId}
          onChange={setOpenId}
          onClose={() => setOpenId(null)}
          describe={(card) => {
            const prices = (card.groupId ? variantsFor(card) : null) || [];
            return {
              subtitle: [card.game, card.setName, card.language].filter(Boolean).join(' · '),
              chips: ['Referencia del catálogo', ...prices.slice(0, 3).map((variant) => `${variant.name} ${formatClp(variant.clp)}`)],
              note: prices.length ? `${NOTE} El precio es una referencia de mercado en TCGplayer.` : NOTE,
            };
          }}
          renderActions={(card) => (
            <div className="mx-auto flex w-full flex-wrap items-center justify-center gap-2">
              {catalogLink(card) && <Link to={catalogLink(card)} className="flex min-h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-white/40 px-3.5 py-1.5 text-xs font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-white/10 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] sm:min-h-11 sm:px-5 sm:py-2 sm:text-sm"><SvgIcon name="info" translate="no" aria-hidden="true" className="shrink-0 text-[18px] sm:text-[20px]" />Ver ficha de la carta</Link>}
              <button type="button" onClick={() => addToFolder(card)} className="flex min-h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[#facc15] px-3.5 py-1.5 text-xs font-extrabold text-[#12315f] transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:min-h-11 sm:px-5 sm:py-2 sm:text-sm">
                <SvgIcon name="add_circle" translate="no" aria-hidden="true" className="shrink-0 text-[18px] sm:text-[20px]" />Agregar a mi carpeta
              </button>
              <button type="button" onClick={() => wish(card)} aria-pressed={Boolean(stateOf(card))} disabled={stateOf(card) === 'pending'} className="flex min-h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-white/40 px-3.5 py-1.5 text-xs font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-white/10 active:scale-[0.97] disabled:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] sm:min-h-11 sm:px-5 sm:py-2 sm:text-sm">
                <SvgIcon name="favorite" translate="no" aria-hidden="true" className={`shrink-0 text-[18px] sm:text-[20px] ${stateOf(card) ? 'text-red-400' : ''}`} style={stateOf(card) ? { fontVariationSettings: "'FILL' 1" } : undefined} />{stateOf(card) ? 'En tus deseadas · Quitar' : 'Avísame cuando la vendan'}
              </button>
            </div>
          )}
        />
      )}

      {addTarget && <AddToFolderModal card={addTarget} variants={addTarget.groupId ? variantsFor(addTarget) : []} onClose={() => setAddTarget(null)} />}
    </section>
  );
}
