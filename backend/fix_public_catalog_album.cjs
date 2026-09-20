const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/PublicCatalog.jsx', 'utf8');

const oldAlbumView = `<AlbumView \n                cards={filteredCards} \n                cart={cart}\n                onAddToCart={addToCart}\n                onRemoveFromCart={decrementCart}\n              />`;

const newAlbumView = `<AlbumView 
              cards={filteredCards} 
              binderColor={folderData?.color || '#2f7336'}
              renderCardActions={(card) => {
                const cartItem = cart.find(i => i.id === card.id);
                const availableStock = card.stock - (cartItem ? cartItem.quantity : 0);
                return (
                  <div className="flex items-center gap-1 w-full mt-2" onClick={(e) => e.stopPropagation()}>
                    {cartItem ? (
                      <div className="flex items-center justify-between w-full bg-slate-100 rounded-md p-1 border border-slate-200">
                        <button 
                          onClick={() => decrementCart(card)}
                          className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <span translate="no" className="material-symbols-outlined text-[16px]">remove</span>
                        </button>
                        <span className="font-bold text-slate-800 text-xs px-2">{cartItem.quantity}</span>
                        <button 
                          onClick={() => addToCart(card)}
                          disabled={availableStock <= 0}
                          className="w-6 h-6 flex items-center justify-center bg-[#2563eb] rounded shadow-sm text-white hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
                        >
                          <span translate="no" className="material-symbols-outlined text-[16px]">add</span>
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => addToCart(card)}
                        disabled={availableStock <= 0}
                        className="w-full flex items-center justify-center gap-1 bg-[#2563eb] hover:bg-[#1d4ed8] text-white py-1.5 rounded-md font-bold transition-all disabled:opacity-50 shadow-sm text-[10px]"
                      >
                        <span translate="no" className="material-symbols-outlined text-[14px]">shopping_cart</span>
                        {availableStock <= 0 ? 'Agotado' : 'Agregar'}
                      </button>
                    )}
                  </div>
                );
              }}
            />`;

code = code.replace(oldAlbumView, newAlbumView);

// Just in case whitespace mismatch
if (!code.includes("renderCardActions")) {
    const rx = /<AlbumView\s+cards=\{filteredCards\}\s+cart=\{cart\}\s+onAddToCart=\{addToCart\}\s+onRemoveFromCart=\{decrementCart\}\s+\/>/g;
    code = code.replace(rx, newAlbumView);
}

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/PublicCatalog.jsx', code);
console.log("Updated PublicCatalog.jsx");
