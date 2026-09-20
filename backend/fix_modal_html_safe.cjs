const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

const modalCode = `
      {/* FULL SCREEN PREVIEW MODAL */}
      {previewCard && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8"
          onClick={() => setPreviewCard(null)}
        >
          <button 
            className="absolute top-4 right-4 md:top-8 md:right-8 text-white hover:text-gray-300 transition-colors z-[10000]"
            onClick={() => setPreviewCard(null)}
          >
            <span translate="no" className="material-symbols-outlined text-4xl md:text-5xl">close</span>
          </button>
          
          <div 
            className="relative flex flex-col md:flex-row items-center gap-6 md:gap-10 max-w-5xl w-full bg-[#1a1a1a] rounded-2xl p-6 md:p-10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] border border-white/10 overflow-y-auto max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
             <div className="w-full md:w-1/2 flex justify-center shrink-0">
               <img 
                  src={previewCard.imageUrl} 
                  alt={previewCard.name} 
                  className="max-h-[50vh] md:max-h-[75vh] w-auto object-contain rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10" 
               />
             </div>
             
             <div className="w-full md:w-1/2 flex flex-col gap-4 text-white">
                <div>
                  <h2 className="text-3xl md:text-5xl font-black mb-2 leading-tight">{previewCard.name}</h2>
                  <p className="text-slate-400 text-lg italic">
                     {previewCard.set} • {previewCard.supertype || 'Pokémon'} • #{(() => {
                        let numStr = (previewCard.number || previewCard.apiId?.split('-')[1] || previewCard.id?.split('-')[1] || '').toString();
                        return numStr.padStart(3, '0');
                     })()}
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-3 my-2">
                   <span className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-black text-xl md:text-2xl shadow-lg">
                      {previewCard.price ? '$' + previewCard.price : 'Sin precio'}
                   </span>
                   <span className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-lg text-white font-medium text-lg flex items-center gap-2">
                      <span translate="no" className="material-symbols-outlined text-xl">inventory_2</span>
                      x{previewCard.stock || 0} Disponibles
                   </span>
                </div>
                
                <div className="text-slate-300 space-y-2 text-base md:text-lg bg-black/30 p-4 rounded-xl border border-white/5">
                   <p className="flex justify-between border-b border-white/10 pb-2"><strong className="text-white">Rareza:</strong> {previewCard.rarity || 'Desconocida'}</p>
                   <p className="flex justify-between border-b border-white/10 pb-2"><strong className="text-white">Idioma:</strong> {previewCard.language || 'Desconocido'}</p>
                   <p className="flex justify-between pb-1"><strong className="text-white">Estado:</strong> {previewCard.condition || 'Near Mint'}</p>
                </div>
                
                <div className="mt-6 w-[80%] md:w-[66%] scale-125 md:scale-150 origin-top-left">
                  {renderCardActions && renderCardActions(previewCard)}
                </div>
             </div>
          </div>
        </div>
      )}
`;

code = code.replace(/\{renderPaginationControls\(true\)\}\s*<\/div>\s*\);\s*\}/, () => "{renderPaginationControls(true)}\n" + modalCode + "\n    </div>\n  );\n}");

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Properly injected the modal HTML!");
