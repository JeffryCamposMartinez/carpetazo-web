const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

// 1. Remove the tooltip HTML entirely from renderPocket
const tooltipRegex = /<div className=\{`absolute top-\[95%\].*?\{renderCardActions\(card\)\}\s*<\/div>\s*\)\}\s*<\/div>/s;
code = code.replace(tooltipRegex, "");

// 2. Add the In-Album Preview Overlay at the end of the binder pages
const inAlbumPreviewCode = `
            {/* IN-ALBUM SPREAD PREVIEW */}
            {previewCard && (
              <div 
                className="absolute rounded-2xl md:rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.95)] z-[1000] flex flex-col md:flex-row overflow-hidden border border-white/10"
                style={{
                  top: isDesktop ? '-20px' : '-8px',
                  bottom: isDesktop ? '-20px' : '-8px',
                  right: isDesktop ? '-28px' : '-10px',
                  left: isDesktop ? 'calc(-100% - 28px)' : '-10px',
                  backgroundColor: '#151515',
                  transform: 'translateZ(100px)'
                }}
                onClick={(e) => { e.stopPropagation(); setPreviewCard(null); }}
              >
                {/* Custom scoped styles for cart controls inside the album preview */}
                <style>{\`
                  .album-preview-actions > div > button.w-full {
                    padding-top: 10px !important;
                    padding-bottom: 10px !important;
                    font-size: 14px !important;
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
                \`}</style>

                {/* Close Button */}
                <button 
                  className="absolute top-2 right-2 md:top-4 md:right-4 w-8 h-8 md:w-10 md:h-10 bg-white/10 hover:bg-white/20 flex items-center justify-center rounded-full text-white transition-colors z-[1010]"
                  onClick={(e) => { e.stopPropagation(); setPreviewCard(null); }}
                >
                  <span translate="no" className="material-symbols-outlined text-xl md:text-2xl">close</span>
                </button>

                {/* Left Side (Image) */}
                <div className="w-full md:w-1/2 h-[45%] md:h-full bg-black/40 flex items-center justify-center p-4 md:p-8 relative" onClick={(e) => e.stopPropagation()}>
                  {/* Spine shadow on desktop right edge of left page */}
                  {isDesktop && <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black/80 to-transparent pointer-events-none z-10" />}
                  <img 
                    src={previewCard.imageUrl} 
                    alt={previewCard.name} 
                    className="max-h-full max-w-full object-contain rounded-xl md:rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.7)] relative z-20"
                  />
                </div>

                {/* Right Side (Info) */}
                <div className="w-full md:w-1/2 h-[55%] md:h-full flex flex-col justify-between p-4 md:p-8 text-white relative bg-[#151515]" onClick={(e) => e.stopPropagation()}>
                  {/* Spine shadow on desktop left edge of right page */}
                  {isDesktop && <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-black/80 to-transparent pointer-events-none z-10" />}
                  
                  <div className="flex flex-col gap-2 md:gap-4 h-full md:pl-6 relative z-20 overflow-y-auto">
                    <div className="flex flex-col gap-1">
                      <h2 className="text-2xl md:text-4xl font-black leading-tight text-white drop-shadow-md">{previewCard.name}</h2>
                      <p className="text-slate-400 text-xs md:text-base italic leading-tight">
                        {previewCard.set} • {previewCard.supertype || 'Pokémon'} • #{(() => {
                            let numStr = (previewCard.number || previewCard.apiId?.split('-')[1] || previewCard.id?.split('-')[1] || '').toString();
                            return numStr.padStart(3, '0');
                        })()}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:gap-4 my-1 md:my-2">
                      <span className="bg-yellow-400 text-black px-3 py-1 md:px-5 md:py-2.5 rounded-lg font-black text-xl md:text-3xl shadow-lg leading-none">
                          {previewCard.price ? '$' + previewCard.price : 'Sin precio'}
                      </span>
                      <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-white font-medium text-xs md:text-lg flex items-center gap-1.5 leading-none shadow-md">
                          <span translate="no" className="material-symbols-outlined text-[16px] md:text-xl">inventory_2</span>
                          x{previewCard.stock || 0} Disponibles
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:gap-y-3 text-xs md:text-base bg-black/40 p-3 md:p-5 rounded-xl border border-white/5 shadow-inner">
                      <p className="flex flex-col"><strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-0.5">Rareza</strong> <span className="font-medium text-white truncate">{previewCard.rarity || 'Desconocida'}</span></p>
                      <p className="flex flex-col"><strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-0.5">Idioma</strong> <span className="font-medium text-white truncate">{previewCard.language || 'Desconocido'}</span></p>
                      <p className="flex flex-col col-span-2 mt-1 md:mt-2 pt-2 md:pt-3 border-t border-white/10"><strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-0.5">Estado</strong> <span className="font-medium text-white truncate">{previewCard.condition || 'Near Mint'}</span></p>
                    </div>

                    <div className="mt-auto pt-4 md:pt-6 w-full flex justify-center">
                      <div className="w-full max-w-[280px] md:max-w-[320px] album-preview-actions bg-white/5 p-2 md:p-3 rounded-xl border border-white/10">
                        {renderCardActions && renderCardActions(previewCard)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
`;

code = code.replace(/\{visiblePages\.map\(\(pageIndex\).*?return \(\s*<div/s, inAlbumPreviewCode + "\n\n            {visiblePages.map((pageIndex) => {\n              const frontGridIndex");

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Implemented the In-Album Spread Preview");
