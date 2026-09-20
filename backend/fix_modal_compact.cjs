const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

const replacement = `
      {/* FULL SCREEN PREVIEW MODAL */}
      {previewCard && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 p-2 md:p-8"
          onClick={() => setPreviewCard(null)}
        >
          {/* Custom styles to enlarge the external cart controls without breaking them */}
          <style>{\`
            .modal-actions > div > button.w-full {
              padding-top: 10px !important;
              padding-bottom: 10px !important;
              font-size: 14px !important;
            }
            @media (min-width: 768px) {
              .modal-actions > div > button.w-full {
                padding-top: 12px !important;
                padding-bottom: 12px !important;
                font-size: 16px !important;
              }
            }
            .modal-actions .bg-slate-100 {
              padding: 6px !important;
            }
            .modal-actions .bg-slate-100 span.font-bold {
              font-size: 16px !important;
              padding-left: 12px !important;
              padding-right: 12px !important;
            }
            .modal-actions .bg-slate-100 button {
              width: 28px !important;
              height: 28px !important;
            }
          \`}</style>
          
          <button 
            className="absolute top-2 right-2 md:top-6 md:right-6 w-8 h-8 md:w-10 md:h-10 bg-white/20 hover:bg-white/30 flex items-center justify-center rounded-full text-white transition-colors z-[10000]"
            onClick={() => setPreviewCard(null)}
          >
            <span translate="no" className="material-symbols-outlined text-xl md:text-2xl">close</span>
          </button>
          
          <div 
            className="relative flex flex-col md:flex-row gap-3 md:gap-8 max-w-5xl w-full bg-[#151515] rounded-xl md:rounded-2xl p-3 md:p-8 shadow-2xl border border-white/10 overflow-y-auto max-h-[95vh] md:max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
             {/* Image Section */}
             <div className="w-full md:w-1/2 flex justify-center shrink-0">
               <img 
                  src={previewCard.imageUrl} 
                  alt={previewCard.name} 
                  className="max-h-[30vh] md:max-h-[75vh] w-auto object-contain rounded-lg md:rounded-xl shadow-[0_5px_15px_rgba(0,0,0,0.5)] border border-white/5" 
               />
             </div>
             
             {/* Info Section */}
             <div className="w-full md:w-1/2 flex flex-col justify-between gap-2 md:gap-4 text-white overflow-y-auto">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl md:text-4xl font-black leading-tight">{previewCard.name}</h2>
                  <p className="text-slate-400 text-[11px] md:text-base italic leading-tight">
                     {previewCard.set} • {previewCard.supertype || 'Pokémon'} • #{(() => {
                        let numStr = (previewCard.number || previewCard.apiId?.split('-')[1] || previewCard.id?.split('-')[1] || '').toString();
                        return numStr.padStart(3, '0');
                     })()}
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                   <span className="bg-yellow-400 text-black px-2 py-1 md:px-4 md:py-2 rounded-md font-black text-base md:text-2xl shadow-md leading-none">
                      {previewCard.price ? '$' + previewCard.price : 'Sin precio'}
                   </span>
                   <span className="bg-slate-800 border border-slate-700 px-2 py-1 md:px-4 md:py-2 rounded-md text-white font-medium text-xs md:text-lg flex items-center gap-1 leading-none">
                      <span translate="no" className="material-symbols-outlined text-[14px] md:text-xl">inventory_2</span>
                      x{previewCard.stock || 0}
                   </span>
                </div>
                
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 md:gap-y-2 text-xs md:text-base bg-black/40 p-2 md:p-4 rounded-lg border border-white/5">
                   <p className="flex flex-col"><strong className="text-white/70 text-[10px] md:text-sm uppercase tracking-wider">Rareza</strong> <span className="truncate">{previewCard.rarity || 'Desconocida'}</span></p>
                   <p className="flex flex-col"><strong className="text-white/70 text-[10px] md:text-sm uppercase tracking-wider">Idioma</strong> <span className="truncate">{previewCard.language || 'Desconocido'}</span></p>
                   <p className="flex flex-col col-span-2"><strong className="text-white/70 text-[10px] md:text-sm uppercase tracking-wider">Estado</strong> <span className="truncate">{previewCard.condition || 'Near Mint'}</span></p>
                </div>
                
                {/* Actions (Agregar button) */}
                {renderCardActions && (
                  <div className="mt-1 w-full bg-slate-800/50 p-2 md:p-4 rounded-lg border border-white/5 flex items-center justify-center">
                    <div className="w-full max-w-[280px] md:max-w-[300px] modal-actions">
                      {renderCardActions(previewCard)}
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
`;

code = code.replace(/\{\/\* FULL SCREEN PREVIEW MODAL \*\/\}.*?(?=<\/div>\s*<\/div>\s*\);\s*\})/s, replacement + "\n    ");

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Ultra compacted the modal for mobile");
