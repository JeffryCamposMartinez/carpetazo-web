const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8');

const targetStr = `{searchCategory === '99' && (
                <select value={searchPhysicalProduct} onChange={(e) => setSearchPhysicalProduct(e.target.value)} className="w-full sm:w-1/3 px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] transition-colors">
                  <option value="">Producto (Todos)</option>
                  {availablePhysicalProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}`;

const replaceStr = `{searchCategory === '99' && (
                <select value={searchPhysicalProduct} onChange={(e) => setSearchPhysicalProduct(e.target.value)} disabled={!searchBlock} className="w-full sm:w-1/3 px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed">
                  <option value="">Producto (Todos)</option>
                  {availablePhysicalProducts.filter(p => !searchBlock || p.blockId === parseInt(searchBlock)).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replaceStr);
    fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', code);
    console.log("Updated product dropdown correctly.");
} else {
    console.log("Could not find the dropdown target in FolderPokemon.jsx");
}
