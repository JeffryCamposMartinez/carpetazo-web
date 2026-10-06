import LoadableImage from '../../ui/LoadableImage';
import { Link } from 'react-router-dom';
// Vista ampliada de una carta dentro del álbum: imagen a un lado y datos al otro.
export default function AlbumCardPreview({
  fetchedAbility, fetchingAbility, isDesktop, previewCard, previewSubtitle, renderCardActions,
  setActiveCardId, setPreviewCard, tcg
}) {
  return (
    <div 
      className="absolute rounded-2xl md:rounded-3xl shadow-[0_24px_48px_rgba(0,0,0,0.85)] md:shadow-[0_30px_60px_rgba(0,0,0,0.95)] z-[1000] flex flex-col md:flex-row overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.10),transparent_34%),linear-gradient(135deg,rgba(12,12,12,0.96),rgba(3,3,3,0.92))] backdrop-blur-md"
      style={{
        top: isDesktop ? '7%' : '8px',
        bottom: isDesktop ? '7%' : '18px',
        right: isDesktop ? '8%' : '12px',
        left: isDesktop ? 'calc(-82% - 18px)' : '12px',
        height: isDesktop ? undefined : 'auto',
        // Apenas delante de las páginas: con más profundidad la perspectiva lo agranda y el texto y la carta se ven borrosos
        transform: 'translateZ(2px)'
      }}
      onClick={(e) => { e.stopPropagation(); setPreviewCard(null); setActiveCardId(null); }}
    >
      <style>{`
        .album-preview-actions > div > button.w-full {
          padding-top: 8px !important;
          padding-bottom: 8px !important;
          font-size: 13px !important;
        }
        @media (min-width: 768px) {
          .album-preview-actions > div > button.w-full {
            padding-top: 12px !important;
            padding-bottom: 12px !important;
            font-size: 16px !important;
          }
        }
        .album-preview-actions .bg-slate-100 {
          padding: 6px !important;
        }
        .album-preview-actions .bg-slate-100 span.font-bold {
          font-size: 16px !important;
          padding-left: 12px !important;
          padding-right: 12px !important;
        }
        .album-preview-actions .bg-slate-100 button {
          width: 28px !important;
          height: 28px !important;
        }
      `}</style>

      <button 
        className="absolute top-2 right-2 md:top-4 md:right-4 w-8 h-8 md:w-10 md:h-10 bg-white/10 hover:bg-white/20 flex items-center justify-center rounded-full text-white transition-colors z-[1010] border border-white/10 shadow-lg"
        onClick={(e) => { e.stopPropagation(); setPreviewCard(null); setActiveCardId(null); }}
      >
        <span translate="no" className="material-symbols-outlined text-xl md:text-2xl">close</span>
      </button>

      {/* Left Side (Image) */}
      <div className="w-full md:w-[52%] h-[46%] md:h-full bg-black/20 flex items-center justify-center p-2 md:p-8 relative" onClick={(e) => e.stopPropagation()}>
        {isDesktop && <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black/80 to-transparent pointer-events-none z-10" />}
        <div className="absolute inset-3 md:inset-6 rounded-2xl border border-white/10 bg-white/[0.03] shadow-[inset_0_0_28px_rgba(255,255,255,0.04)]" />
        <div className="absolute right-1 top-[62%] z-30 flex w-[44%] -translate-y-1/2 flex-col items-start gap-2 md:hidden">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-yellow-300/30 bg-yellow-300/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-yellow-200">
              {tcg || 'Carta'}
            </span>
            {(tcg === 'Mitos y Leyendas' ? previewCard.set : previewCard.number) && (
              <span className="max-w-[92px] truncate rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold text-slate-300">
                {tcg === 'Mitos y Leyendas' ? previewCard.set : `#${previewCard.number}`}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-xl bg-yellow-400 px-2.5 py-1 text-[15px] font-black leading-none text-black shadow-lg">
              {previewCard.price ? '$' + Number(previewCard.price).toLocaleString('es-CL') : 'Sin precio'}
            </span>
            <span className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/90 px-2.5 py-1.5 text-[10.5px] font-bold leading-none text-white shadow-md">
              <span translate="no" className="material-symbols-outlined text-[14px]">inventory_2</span>
              {Number(previewCard.stock || 0) <= 0 ? 'Sin stock' : `x${Number(previewCard.stock || 0) > 999 ? '999+' : (previewCard.stock || 0)}`}
            </span>
          </div>
        </div>
        <LoadableImage 
          src={previewCard.imageUrl} 
          alt={previewCard.name} 
          className={`max-h-full md:max-h-[92%] max-w-[69%] md:max-w-full object-contain rounded-xl md:rounded-2xl shadow-[0_14px_32px_rgba(0,0,0,0.7)] md:shadow-[0_18px_45px_rgba(0,0,0,0.78)] relative z-20 -translate-x-[52%] md:translate-x-0 ${Number(previewCard.stock || 0) <= 0 ? 'grayscale opacity-60' : ''}`}
        />
      </div>

      {/* Right Side (Info) */}
      <div className="w-full md:w-[48%] h-[54%] md:h-full flex flex-col justify-between p-2.5 md:p-6 pt-5 md:pt-6 text-white relative bg-transparent" onClick={(e) => e.stopPropagation()}>
        {isDesktop && <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black/80 to-transparent pointer-events-none z-10" />}

        <div className="flex flex-col gap-1.5 md:gap-4 h-full md:pl-6 relative z-20 pr-1">
          <div className="flex flex-col gap-1 md:gap-2">
            <div className="hidden md:flex flex-wrap items-center gap-1.5 md:gap-2">
              <span className="rounded-full border border-yellow-300/30 bg-yellow-300/10 px-2 py-0.5 md:px-2.5 md:py-1 text-[9px] md:text-xs font-black uppercase tracking-[0.12em] md:tracking-[0.14em] text-yellow-200">
                {tcg || 'Carta'}
              </span>
              {(tcg === 'Mitos y Leyendas' ? previewCard.set : previewCard.number) && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 md:px-2.5 md:py-1 text-[9px] md:text-xs font-bold text-slate-300 truncate max-w-[150px] md:max-w-[220px]">
                  {tcg === 'Mitos y Leyendas' ? previewCard.set : `#${previewCard.number}`}
                </span>
              )}
            </div>
            <h2 className="text-[18px] md:text-3xl font-black leading-[1] text-white drop-shadow-md line-clamp-1">{previewCard.name}</h2>
            <Link to={`/carta/${previewCard.id}`} className="mt-1 inline-flex min-h-8 items-center gap-1 self-start rounded-full bg-white/15 px-3 text-[11px] font-bold text-white ring-1 ring-white/25 transition-colors hover:bg-white/25 md:text-sm"><span translate="no" aria-hidden="true" className="material-symbols-outlined text-[16px] md:text-[18px]">open_in_new</span>Ver ficha y comparar precios</Link>
            {previewSubtitle && (
              <p className="text-slate-400 text-[11px] md:text-sm italic leading-tight line-clamp-1">
                {previewSubtitle}
              </p>
            )}
          </div>

          <div className="hidden md:flex flex-wrap items-center gap-1.5 md:gap-3">
            <span className="bg-yellow-400 text-black px-2.5 py-1 md:px-4 md:py-2.5 rounded-xl font-black text-base md:text-2xl shadow-lg leading-none">
              {previewCard.price ? '$' + Number(previewCard.price).toLocaleString('es-CL') : 'Sin precio'}
            </span>
            <span className="bg-slate-800/90 border border-slate-700 px-2.5 py-1.5 md:px-3.5 md:py-2.5 rounded-xl text-white font-bold text-[11px] md:text-sm flex items-center gap-1.5 leading-none shadow-md">
                <span translate="no" className="material-symbols-outlined text-[14px] md:text-xl">inventory_2</span>
                {Number(previewCard.stock || 0) <= 0 ? 'Sin stock' : `x${Number(previewCard.stock || 0) > 999 ? '999+' : (previewCard.stock || 0)} Disponibles`}
            </span>
          </div>

          {tcg === 'Mitos y Leyendas' ? (
            <>
                                        <div className="flex gap-1.5 md:gap-2">
                  <p className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5 md:px-3 md:py-2">
                    <strong className="block text-white/45 text-[9px] md:text-[10px] uppercase tracking-wider">Tipo</strong>
                    <span className="block text-[11px] md:text-sm font-extrabold text-white leading-tight">{previewCard.type || previewCard.supertype || 'Carta'}</span>
                  </p>
                  {previewCard.race && previewCard.race !== 'SIN_RAZA' && previewCard.race !== '—' && previewCard.race !== '-' && (
                    <p className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5 md:px-3 md:py-2">
                      <strong className="block text-white/45 text-[9px] md:text-[10px] uppercase tracking-wider">Raza</strong>
                      <span className="block text-[11px] md:text-sm font-extrabold text-white leading-tight">{previewCard.race}</span>
                    </p>
                  )}
                  {previewCard.cost !== null && previewCard.cost !== undefined && previewCard.cost !== '' && (
                    <p className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5 md:px-3 md:py-2">
                      <strong className="block text-white/45 text-[9px] md:text-[10px] uppercase tracking-wider">Coste</strong>
                      <span className="block text-[11px] md:text-sm font-extrabold text-white leading-tight">{previewCard.cost}</span>
                    </p>
                  )}
                </div><div className="w-full bg-black/45 p-2 md:p-4 rounded-2xl border border-white/10 shadow-inner overflow-y-auto custom-scrollbar flex-shrink">
                <p className="flex flex-col">
                  <strong className="flex items-center gap-1.5 text-yellow-100/80 text-[9px] md:text-sm uppercase tracking-wider mb-1 md:mb-2">
                    <span translate="no" className="material-symbols-outlined text-[14px] md:text-[16px]">auto_fix_high</span>
                    Habilidad
                  </strong> 
                  <span className="font-medium text-white text-[10px] md:text-sm leading-snug md:leading-relaxed whitespace-pre-wrap">
                  {fetchingAbility ? 'Buscando habilidad ancestral...' : (fetchedAbility || 'Sin habilidad registrada')}
                  </span>
                </p>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:gap-y-3 text-xs md:text-base bg-black/40 p-3 md:p-5 rounded-xl border border-white/5 shadow-inner">
              <p className="flex flex-col"><strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-0.5">Rareza</strong> <span className="font-medium text-white truncate">{previewCard.rarity || 'Desconocida'}</span></p>
              <p className="flex flex-col"><strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-0.5">Idioma</strong> <span className="font-medium text-white truncate">{previewCard.language || 'Desconocido'}</span></p>
              <p className="flex flex-col col-span-2 mt-1 md:mt-2 pt-2 md:pt-3 border-t border-white/10"><strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-0.5">Estado</strong> <span className="font-medium text-white truncate">{previewCard.condition || 'Near Mint'}</span></p>
            </div>
          )}

          <div className="flex mt-auto pt-1 md:pt-6 pb-0 w-full justify-center">
            <div className="w-full max-w-[280px] md:max-w-[320px] album-preview-actions bg-white/5 p-1 md:p-3 rounded-xl border border-white/10">
              {renderCardActions && renderCardActions(previewCard)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
