const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

// 1. Add tcg to props
code = code.replace(
  "emptyMessage, topRightControls }) {",
  "emptyMessage, topRightControls, tcg }) {"
);

// 2. Hide Card Code for MyL
const targetCode = `{previewCard.set} • {previewCard.supertype || 'Pokémon'} • #{(() => {
                            let numStr = (previewCard.number || previewCard.apiId?.split('-')[1] || previewCard.id?.split('-')[1] || '').toString();
                            return numStr.padStart(3, '0');
                        })()}`;
const replaceCode = `{previewCard.set} • {previewCard.supertype || (tcg === 'Mitos y Leyendas' ? 'Carta' : 'Pokémon')} {tcg !== 'Mitos y Leyendas' && \` • #\${(() => {
                            let numStr = (previewCard.number || previewCard.apiId?.split('-')[1] || previewCard.id?.split('-')[1] || '').toString();
                            return numStr.padStart(3, '0');
                        })()}\`}`;
code = code.replace(targetCode, replaceCode);

// 3. Conditional Grid / Ability for MyL
const targetGrid = `<div className="grid grid-cols-2 gap-x-3 gap-y-2 md:gap-y-3 text-xs md:text-base bg-black/40 p-3 md:p-5 rounded-xl border border-white/5 shadow-inner">
                      <p className="flex flex-col"><strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-0.5">Rareza</strong> <span className="font-medium text-white truncate">{previewCard.rarity || 'Desconocida'}</span></p>
                      <p className="flex flex-col"><strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-0.5">Idioma</strong> <span className="font-medium text-white truncate">{previewCard.language || 'Desconocido'}</span></p>
                      <p className="flex flex-col col-span-2 mt-1 md:mt-2 pt-2 md:pt-3 border-t border-white/10"><strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-0.5">Estado</strong> <span className="font-medium text-white truncate">{previewCard.condition || 'Near Mint'}</span></p>
                    </div>`;

const replaceGrid = `{tcg === 'Mitos y Leyendas' ? (
                      <div className="w-full bg-black/40 p-3 md:p-5 rounded-xl border border-white/5 shadow-inner overflow-y-auto max-h-[120px] md:max-h-[200px]">
                        <p className="flex flex-col">
                          <strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-1">Habilidad</strong> 
                          <span className="font-medium text-white text-[11px] md:text-sm leading-relaxed whitespace-pre-wrap">
                            {previewCard.data?.ability || previewCard.ability || previewCard.extData?.ability || previewCard.data?.efecto || previewCard.efecto || previewCard.data?.text || previewCard.text || 'Sin habilidad registrada'}
                          </span>
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 md:gap-y-3 text-xs md:text-base bg-black/40 p-3 md:p-5 rounded-xl border border-white/5 shadow-inner">
                        <p className="flex flex-col"><strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-0.5">Rareza</strong> <span className="font-medium text-white truncate">{previewCard.rarity || 'Desconocida'}</span></p>
                        <p className="flex flex-col"><strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-0.5">Idioma</strong> <span className="font-medium text-white truncate">{previewCard.language || 'Desconocido'}</span></p>
                        <p className="flex flex-col col-span-2 mt-1 md:mt-2 pt-2 md:pt-3 border-t border-white/10"><strong className="text-white/60 text-[10px] md:text-sm uppercase tracking-wider mb-0.5">Estado</strong> <span className="font-medium text-white truncate">{previewCard.condition || 'Near Mint'}</span></p>
                      </div>
                    )}`;

code = code.replace(targetGrid, replaceGrid);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Applied MyL conditional rendering");
