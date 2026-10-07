import LoadableImage from '../ui/LoadableImage';
import { cardFit, cardRatio, isYugioh } from '../../utils/cardShape';
import { Link } from 'react-router-dom';
// En celular las fotos de cartas se descargan al acercarse a la pantalla; en PC se mantienen como siempre
const MOBILE_IMAGE_LOADING = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 'lazy' : undefined;

export default function CatalogCard({ tcg, card, availableStock, cartQuantity, onAddToCart, onRemoveFromCart, onWish, wished = false }) {
  const isOutOfStock = availableStock <= 0;
  const isMyl = Boolean(card.type || card.race || card.cost || card.effect) && card.supertype !== 'Pokémon' && card.supertype !== 'Trainer' && card.supertype !== 'Energy';

  // Formatear el código de la carta para la búsqueda
  let numStr = (card.number || card.id?.split('-')[1] || '').toString();
  let totalStr = (card.total || card.set?.printedTotal || '').toString();
  let cardCode = '';
  if (numStr && totalStr) {
    if (/^\d+$/.test(numStr)) numStr = numStr.padStart(3, '0');
    if (/^\d+$/.test(totalStr)) totalStr = totalStr.padStart(3, '0');
    cardCode = `${numStr}/${totalStr}`;
  }

  const searchTerm = cardCode ? `${card.name} ${cardCode}` : card.name;

  // URLs de búsqueda
  // El enlace guardado en la carta lo escribe el vendedor: solo se usa si es https de TCGplayer
  const savedTcgPlayerUrl = /^https:\/\/([a-z0-9-]+\.)*tcgplayer\.com(\/|$)/i.test(String(card.tcgplayer?.url || '')) ? card.tcgplayer.url : '';
  const tcgPlayerUrl = savedTcgPlayerUrl || `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodeURIComponent(searchTerm)}`;
  const tcgMatchUrl = `https://tcgmatch.cl/cartas/busqueda/q=${encodeURIComponent(searchTerm)}`;

  const langMap = {
    English: 'EN',
    Spanish: 'ES',
    Japanese: 'JP',
    French: 'FR',
    German: 'DE',
    Italian: 'IT',
    Portuguese: 'PT'
  };
  const langBadge = card.language ? (langMap[card.language] || card.language.substring(0, 2).toUpperCase()) : 'EN';
  const mylType = card.type || card.supertype || 'Carta';
  const mylCode = card.number || card.collectorCode || card.tcgId || '';
  const mylSetLine = [card.set, mylCode].filter(Boolean).join(' · ');

  return (
    <article className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden border border-gray-200 ${isMyl ? 'min-h-0' : ''}`}>
      {/* Top Image Section */}
      <div className={`relative w-full ${isMyl ? 'aspect-[63/86] p-1.5' : isYugioh(tcg) ? 'p-0' : 'aspect-[63/88] p-2'} bg-gray-50 flex items-center justify-center`} style={isYugioh(tcg) ? { aspectRatio: cardRatio(tcg) } : undefined}>
        <LoadableImage 
          loading={MOBILE_IMAGE_LOADING}
          decoding="async"
          className={`w-full h-full ${isMyl ? 'object-fill' : 'object-contain'} ${isOutOfStock && cartQuantity === 0 ? 'grayscale opacity-60' : ''}`} 
          src={card.imageUrl} 
          alt={card.name} 
          style={isYugioh(tcg) ? cardFit(tcg) : undefined}
        />
        {onWish && (
          <button
            type="button"
            onClick={() => onWish(card)}
            aria-pressed={wished}
            aria-label={wished ? `${card.name} está en tu lista de deseadas` : `Agregar ${card.name} a mis deseadas`}
            className={`absolute right-1.5 top-1.5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/10 transition active:scale-90 ${wished ? 'text-rose-500' : 'text-slate-500'}`}
          >
            <span translate="no" className="material-symbols-outlined text-[22px]" style={wished ? { fontVariationSettings: "'FILL' 1" } : undefined}>favorite</span>
          </button>
        )}
        {isOutOfStock && cartQuantity === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-slate-950/85 px-4 py-1.5 text-xs font-black text-white shadow-lg ring-2 ring-white/70">Sin stock</span>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className={`${isMyl ? 'p-2.5 pb-12' : 'p-3'} relative flex flex-col flex-grow bg-white border-t border-gray-100`}>
        {/* Name and Type */}
        <div className={`flex justify-between items-start gap-2 ${isMyl ? 'mb-0.5' : 'mb-1'}`}>
          <h3 className={`${isMyl ? 'text-[15px]' : ''} font-bold text-gray-900 line-clamp-1`}>
            <Link to={`/carta/${card.id}`} title="Ver ficha: compara precios y vendedores" className="hover:underline focus:outline-none focus-visible:underline">{card.name}</Link>
            {card.pseudoName && <span className="text-gray-500 font-normal text-[11px] ml-1.5 align-middle">({card.pseudoName})</span>}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            {!isMyl && (
              <span className="px-1.5 py-0.5 rounded-sm bg-[#ffcb05]/20 text-[#1a2b4b] text-[9px] uppercase font-extrabold border border-[#ffcb05]/40" title={card.language || 'English'}>
                {langBadge}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-600 text-[10px] uppercase font-bold">
              {isMyl ? mylType : card.supertype}
            </span>
          </div>
        </div>
        
        {/* Set Name */}
        <div className={`text-gray-500 text-xs font-semibold ${isMyl ? 'mb-2 line-clamp-1' : 'mb-3'}`}>
          {isMyl ? mylSetLine : (
            <>
              {card.set} • #{(() => {
                let numStr = (card.number || card.id?.split('-')[1] || '').toString();
                let totalStr = (card.total || '---').toString();
                if (/^\d+$/.test(numStr)) numStr = numStr.padStart(3, '0');
                if (/^\d+$/.test(totalStr)) totalStr = totalStr.padStart(3, '0');
                return `${numStr}/${totalStr}`;
              })()}
            </>
          )}
        </div>

        {/* Price Section */}
        <div className={`flex justify-between items-end relative ${isMyl ? 'mb-2' : 'mb-4'}`}>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl text-[#1a2b4b]">
              {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(card.price)} CLP
            </span>
          </div>
          {/* Stock Indicator */}
          <div className="absolute right-0 top-0 flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 border border-gray-200 text-gray-600 text-xs font-bold" title={`${availableStock + cartQuantity} en total`}>
            {availableStock + cartQuantity}
          </div>
        </div>

        {/* Bottom Actions Row */}
        <div className={`${isMyl ? 'hidden' : 'pt-3'} mt-auto border-t border-gray-100 flex items-center justify-between`}>
          {!isMyl && (
            <div className="flex flex-col gap-1">
              <a href={tcgPlayerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-gray-400 hover:text-[#1e40af] text-[11px] font-bold transition-colors">
                <span translate="no" className="material-symbols-outlined text-[12px]">open_in_new</span>
                TCGPlayer
              </a>
              <a href={tcgMatchUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-gray-400 hover:text-[#1e40af] text-[11px] font-bold transition-colors">
                <span translate="no" className="material-symbols-outlined text-[12px]">open_in_new</span>
                TCGMatch
              </a>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {cartQuantity > 0 ? (
              <>
                <button 
                  onClick={() => onRemoveFromCart()}
                  className="w-8 h-8 rounded-full border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 flex items-center justify-center transition-colors"
                >
                  <span translate="no" className="material-symbols-outlined text-[16px]">remove</span>
                </button>
                <span className="text-[#1a2b4b] font-bold min-w-[12px] text-center">{cartQuantity}</span>
              </>
            ) : null}
            <button 
              onClick={() => onAddToCart(card)}
              disabled={isOutOfStock}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                isOutOfStock ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' : 'bg-[#ffcb05] text-[#1a2b4b] hover:scale-105 shadow-sm hover:shadow-md'
              }`}
            >
              <span translate="no" className="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>
        </div>

        {isMyl && (
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            {cartQuantity > 0 ? (
              <>
                <button 
                  onClick={() => onRemoveFromCart()}
                  className="w-7 h-7 rounded-full border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 flex items-center justify-center transition-colors shadow-sm"
                >
                  <span translate="no" className="material-symbols-outlined text-[15px]">remove</span>
                </button>
                <span className="text-[#1a2b4b] font-bold min-w-[12px] text-center text-sm">{cartQuantity}</span>
              </>
            ) : null}
            <button 
              onClick={() => onAddToCart(card)}
              disabled={isOutOfStock}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                isOutOfStock ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' : 'bg-[#ffcb05] text-[#1a2b4b] hover:scale-105 shadow-sm hover:shadow-md'
              }`}
            >
              <span translate="no" className="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

