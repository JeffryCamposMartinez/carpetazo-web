const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

const newModalCode = `
      {/* FULL SCREEN PREVIEW MODAL */}
      {previewCard && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 p-3 md:p-8"
          onClick={() => setPreviewCard(null)}
        >
          {/* Close button */}
          <button 
            className="absolute top-3 right-3 md:top-6 md:right-6 w-10 h-10 bg-white/10 hover:bg-white/20 flex items-center justify-center rounded-full text-white transition-colors z-[10000]"
            onClick={() => setPreviewCard(null)}
          >
            <span translate="no" className="material-symbols-outlined text-2xl">close</span>
          </button>
          
          <div 
            className="relative flex flex-col md:flex-row gap-4 md:gap-8 max-w-5xl w-full bg-[#151515] rounded-2xl p-4 md:p-8 shadow-2xl border border-white/10 overflow-y-auto max-h-[95vh] md:max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
             {/* Image Section */}
             <div className="w-full md:w-1/2 flex justify-center shrink-0">
               <img 
                  src={previewCard.imageUrl} 
                  alt={previewCard.name} 
                  className="max-h-[35vh] md:max-h-[75vh] w-auto object-contain rounded-xl shadow-[0_5px_15px_rgba(0,0,0,0.5)] border border-white/5" 
               />
             </div>
             
             {/* Info Section */}
             <div className="w-full md:w-1/2 flex flex-col gap-3 md:gap-4 text-white overflow-y-auto">
                <div>
                  <h2 className="text-2xl md:text-4xl font-black mb-1 leading-tight">{previewCard.name}</h2>
                  <p className="text-slate-400 text-sm md:text-base italic">
                     {previewCard.set} • {previewCard.supertype || 'Pokémon'} • #{(() => {
                        let numStr = (previewCard.number || previewCard.apiId?.split('-')[1] || previewCard.id?.split('-')[1] || '').toString();
                        return numStr.padStart(3, '0');
                     })()}
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                   <span className="bg-yellow-400 text-black px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-black text-lg md:text-2xl shadow-md">
                      {previewCard.price ? '$' + previewCard.price : 'Sin precio'}
                   </span>
                   <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-white font-medium text-sm md:text-lg flex items-center gap-1.5">
                      <span translate="no" className="material-symbols-outlined text-sm md:text-xl">inventory_2</span>
                      x{previewCard.stock || 0}
                   </span>
                </div>
                
                <div className="text-slate-300 space-y-1 md:space-y-2 text-sm md:text-base bg-black/40 p-3 md:p-4 rounded-xl border border-white/5">
                   <p className="flex justify-between border-b border-white/10 pb-1.5 md:pb-2"><strong className="text-white">Rareza:</strong> <span className="text-right">{previewCard.rarity || 'Desconocida'}</span></p>
                   <p className="flex justify-between border-b border-white/10 pb-1.5 md:pb-2"><strong className="text-white">Idioma:</strong> <span className="text-right">{previewCard.language || 'Desconocido'}</span></p>
                   <p className="flex justify-between"><strong className="text-white">Estado:</strong> <span className="text-right">{previewCard.condition || 'Near Mint'}</span></p>
                </div>
                
                {/* Actions (Agregar button) */}
                {renderCardActions && (
                  <div className="mt-1 md:mt-2 w-full bg-slate-800/50 p-3 md:p-4 rounded-xl border border-white/5 flex items-center justify-center">
                    <div className="w-full max-w-[250px] md:max-w-[300px]">
                      {renderCardActions(previewCard)}
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
`;

code = code.replace(/\{\/\* FULL SCREEN PREVIEW MODAL \*\/\}.*?(?=<\/div>\s*<\/div>\s*\);\s*\})/s, newModalCode + "\n    ");

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Replaced modal HTML with the responsive compact version");
