import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/ToastProvider';
import LoadableImage, { LoadingMark } from '../ui/LoadableImage';
import CardLightbox from '../ui/CardLightbox';
import CardsPagination from './CardsPagination';
import useCardInfoSearch, { INFO_PAGE } from '../../hooks/useCardInfoSearch';
import useReferencePrices from '../../hooks/useReferencePrices';
import { ReferencePriceLine } from '../folder/ReferencePrice';
import { formatClp } from '../../services/tcgcsvPrices';
import { cardFill, cardRatio } from '../../utils/cardShape';

const NOTE = 'Referencia del catálogo: esta ficha no es una oferta de venta.';
const tcgplayerImage = (card) => {
  const id = card?.tcgProductId || card?.productId || card?.payload?.external?.productId;
  return id ? `https://tcgplayer-cdn.tcgplayer.com/product/${encodeURIComponent(String(id))}_400w.jpg` : '';
};

// Cuando una carta no está a la venta: las que coinciden en el catálogo (TCGCSV), para ver su imagen y datos. No tienen precio ni compra.
export default function CardInfoResults({ query, game, enabled, hasOffers = false }) {
  const [page, setPage] = useState(1);
  const { results, searching, exhausted, pages: indexedPages, total: indexedTotal } = useCardInfoSearch({ query, game, enabled, page });
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState(null);
  const [wished, setWished] = useState({});

  useEffect(() => { setPage(1); }, [query, game]);
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

  const wish = async (card) => {
    if (!currentUser) { navigate('/bienvenida'); return; }
    if (wished[card.id]) return;
    setWished((previous) => ({ ...previous, [card.id]: true }));
    try {
      await api.addWishlistItem(card.payload);
      showToast(`${card.name} agregada a tus deseadas`, { type: 'success', action: { label: 'Ver lista', run: () => navigate('/dashboard?tab=deseadas') } });
    } catch (error) {
      setWished((previous) => ({ ...previous, [card.id]: false }));
      showToast(error.message || 'No se pudo agregar la carta', 'error');
    }
  };

  return (
    <section id="cartas-informativas" aria-label="Coincidencias del catálogo" className="mt-5 scroll-mt-28">
      <div className="mb-3 flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
        <span translate="no" aria-hidden="true" className="material-symbols-outlined mt-0.5 text-[24px] text-[#1e40af]">info</span>
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-[#12315f]">{hasOffers ? `Más coincidencias del catálogo para "${query.trim()}"` : `Sin ofertas para "${query.trim()}": busca también en el catálogo`}</h2>
          <p className="mt-0.5 text-sm text-slate-600">Coincidencias por nombre o similitud. Estas fichas son informativas, no ofertas de venta; la disponibilidad se muestra en los resultados de arriba. Puedes agregarlas a tus deseadas.</p>
        </div>
      </div>

      {shown.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {shown.map((card, index) => (
            <li key={card.id}>
              <button type="button" onClick={() => setOpenId(card.id)} className="group block w-full rounded-2xl bg-white p-2 text-left ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(26,43,75,0.06),0_10px_24px_-18px_rgba(26,43,75,0.4)] transition-transform duration-150 active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
                <div className="relative w-full overflow-hidden rounded-xl bg-slate-50" style={{ aspectRatio: cardRatio(card.game) }}>
                  {card.imageUrl || tcgplayerImage(card) ? <LoadableImage loading={index < 10 ? 'eager' : 'lazy'} src={card.imageUrl || tcgplayerImage(card)} fallbackSrc={card.imageUrl ? tcgplayerImage(card) : undefined} alt={card.name} className="h-full w-full object-contain" style={cardFill(card.game)} /> : <span className="flex h-full items-center justify-center text-xs font-semibold text-slate-400">Sin imagen</span>}
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-[#12315f]/90 px-2 py-0.5 text-[11px] font-extrabold text-white">Catálogo</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-extrabold leading-snug text-[#12315f]">{card.name}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{card.setName}</p>
                <ReferencePriceLine variants={card.groupId ? variantsFor(card) : null} className="mt-0.5 text-xs" />
              </button>
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
            <button type="button" onClick={() => wish(card)} disabled={Boolean(wished[card.id])} className="h-11 rounded-full bg-[#facc15] px-6 text-sm font-extrabold text-[#12315f] transition-transform duration-150 active:scale-[0.97] disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">{wished[card.id] ? 'En tus deseadas' : 'Avísame cuando la vendan'}</button>
          )}
        />
      )}
    </section>
  );
}
