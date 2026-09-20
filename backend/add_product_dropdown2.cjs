const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8');

const regex = /\{searchCategory === '99' && \(\s*<select value=\{searchBlock\}[\s\S]*?<\/select>\s*\)\}/;

if (regex.test(code)) {
    const replacement = `{searchCategory === '99' && (
                <select value={searchBlock} onChange={(e) => { setSearchBlock(e.target.value); setSearchSet(''); }} className="w-full sm:w-1/3 px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] transition-colors">
                  <option value="">Bloque (Todos)</option>
                  <option value="1">Furia Extendido</option>
                  <option value="2">Primer Bloque</option>
                  <option value="3">Primera Era</option>
                </select>
              )}
              {searchCategory === '99' && (
                <select value={searchPhysicalProduct} onChange={(e) => setSearchPhysicalProduct(e.target.value)} className="w-full sm:w-1/3 px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] transition-colors">
                  <option value="">Producto (Todos)</option>
                  {availablePhysicalProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}`;
    code = code.replace(regex, replacement);
    
    // Also replace the width of the next div
    const widthTarget = "className={`relative w-full ${searchCategory === '99' ? 'sm:w-1/2' : 'sm:w-2/3'}`}";
    const widthReplace = "className={`relative w-full ${searchCategory === '99' ? 'sm:w-1/3' : 'sm:w-2/3'}`}";
    code = code.replace(widthTarget, widthReplace);
    
    fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', code);
    console.log("Added Product select successfully via regex.");
} else {
    console.log("Could not find insertion point via regex.");
}
