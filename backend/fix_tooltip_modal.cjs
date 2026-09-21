const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

const targetTooltipPos = `
                let tooltipPosClass = 'left-1/2 -translate-x-1/2';
                if (colIndex === 0) {
                  tooltipPosClass = 'left-[5%] md:left-1/2 md:-translate-x-1/2';
                } else if (colIndex === 2) {
                  tooltipPosClass = 'right-[5%] md:right-auto md:left-1/2 md:-translate-x-1/2';
                }`;

const newTooltipPos = `
                let tooltipPosClass = 'left-1/2 -translate-x-1/2';
                if (colIndex === 0) {
                  tooltipPosClass = 'left-[-10%] md:left-1/2 md:-translate-x-1/2';
                } else if (colIndex === 2) {
                  tooltipPosClass = 'right-[-10%] md:right-auto md:left-1/2 md:-translate-x-1/2';
                }`;

code = code.replace(targetTooltipPos, newTooltipPos);

const targetTooltipHtml = `                          <div className={\`absolute top-[92%] \${tooltipPosClass} w-[130%] min-w-[140px] bg-[#1a1a1a]/95 backdrop-blur-md border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.9)] rounded-lg transition-all duration-300 flex flex-col p-2 z-[110] pointer-events-none \${cardIsActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}\`}>
                            <div className="flex justify-center items-center gap-1.5 mb-1">
                              <h3 className="text-white font-bold text-xs text-center break-words leading-tight">{card.name}</h3>
                              <span className="bg-yellow-400 text-black px-1.5 py-0.5 rounded-sm text-[9px] font-black leading-none whitespace-nowrap shadow-sm">
                                {card.price ? \`$\${card.price}\` : 'N/A'}
                              </span>
                            </div>
                            <p className="text-gray-400 text-[9px] text-center mb-1.5 break-words w-full leading-tight mt-0.5">
                              {card.set} • {card.supertype || 'Pokémon'} • #{(() => {
                                let numStr = (card.number || card.apiId?.split('-')[1] || card.id?.split('-')[1] || '').toString();
                                let totalStr = (card.total || '---').toString();
                                if (/^\\d+$/.test(numStr)) numStr = numStr.padStart(3, '0');
                                if (/^\\d+$/.test(totalStr)) totalStr = totalStr.padStart(3, '0');
                                return \`\${numStr}/\${totalStr}\`;
                              })()}
                            </p>
                            
                            {(card.rarity || card.language) && (
                              <p className="text-gray-400 text-[9px] text-center mb-1.5 italic leading-tight">
                                {[card.rarity, card.language].filter(Boolean).join(' • ')}
                              </p>
                            )}
                            
                            <div className="w-full h-px bg-white/10 my-1"></div>
                            {renderCardActions && (
                              <div className="w-full mt-1 pointer-events-auto">
                                {renderCardActions(card)}
                              </div>
                            )}
                          </div>`;

const newTooltipHtml = `                          <div className={\`absolute top-[95%] \${tooltipPosClass} w-[240%] min-w-[220px] md:min-w-[260px] bg-[#151515]/95 backdrop-blur-md border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.95)] rounded-xl transition-all duration-300 flex flex-col p-3 z-[110] pointer-events-none \${cardIsActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}\`}>
                            
                            {/* Header: Name and Price */}
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-white font-black text-sm md:text-base leading-tight truncate">{card.name}</h3>
                                <p className="text-gray-400 text-[9px] md:text-[10px] leading-tight truncate mt-0.5">
                                  {card.set} • #{(() => {
                                    let numStr = (card.number || card.apiId?.split('-')[1] || card.id?.split('-')[1] || '').toString();
                                    return numStr.padStart(3, '0');
                                  })()}
                                </p>
                              </div>
                              <span className="bg-yellow-400 text-black px-2 py-1 rounded-md text-[11px] md:text-xs font-black shadow-sm shrink-0 leading-none">
                                {card.price ? \`$\${card.price}\` : 'Sin precio'}
                              </span>
                            </div>
                            
                            {/* Stock Badge */}
                            <div className="flex items-center gap-1 bg-slate-800/80 w-fit px-2 py-0.5 rounded text-[10px] md:text-xs text-white font-medium mb-2 border border-slate-700">
                               <span translate="no" className="material-symbols-outlined text-[12px]">inventory_2</span>
                               x{card.stock || 0} Disponibles
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[9px] md:text-[11px] text-gray-300 bg-black/40 p-2.5 rounded-lg border border-white/5 mb-2.5">
                               <p className="flex flex-col"><strong className="text-white/70 uppercase text-[8px] md:text-[9px]">Rareza</strong> <span className="truncate">{card.rarity || 'Desconocida'}</span></p>
                               <p className="flex flex-col"><strong className="text-white/70 uppercase text-[8px] md:text-[9px]">Idioma</strong> <span className="truncate">{card.language || 'Desconocido'}</span></p>
                               <p className="flex flex-col col-span-2"><strong className="text-white/70 uppercase text-[8px] md:text-[9px]">Estado</strong> <span className="truncate">{card.condition || 'Near Mint'}</span></p>
                            </div>
                            
                            {/* Actions Wrapper */}
                            {renderCardActions && (
                              <div className="w-full pointer-events-auto bg-black/20 rounded-lg p-1.5 border border-white/5">
                                {renderCardActions(card)}
                              </div>
                            )}
                          </div>`;

// Regex replacement because exact strings might have line ending mismatches
code = code.replace(/<div className=\{`absolute top-\[92%\].*?\{renderCardActions\(card\)\}\s*<\/div>\s*\)\}\s*<\/div>/s, newTooltipHtml);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Upgraded the tooltip into a mini-modal preview");
