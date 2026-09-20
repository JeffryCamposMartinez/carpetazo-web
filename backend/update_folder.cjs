const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8');

// 1. Add state variables
if (!code.includes('const [availablePhysicalProducts, setAvailablePhysicalProducts] = useState([]);')) {
    code = code.replace("const [availableSets, setAvailableSets] = useState([]);", "const [availableSets, setAvailableSets] = useState([]);\n  const [availablePhysicalProducts, setAvailablePhysicalProducts] = useState([]);\n  const [searchPhysicalProduct, setSearchPhysicalProduct] = useState('');");
}

// 2. Fetch physical products
if (!code.includes("apiFetch('/tcg/physical-products')")) {
    code = code.replace(
        "api.getTcgGroups(searchCategory)",
        "apiFetch('/tcg/physical-products').then(res => { if(res.success) setAvailablePhysicalProducts(res.data); }).catch(console.error);\n      api.getTcgGroups(searchCategory)"
    );
}

// 3. Render physical product select in search UI
const productSelect = `
              {searchCategory === '99' && (
                <div className="relative w-full sm:w-1/3">
                  <select value={searchPhysicalProduct} onChange={(e) => setSearchPhysicalProduct(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] transition-colors">
                    <option value="">Producto Físico (Todos)</option>
                    {availablePhysicalProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
`;

if (!code.includes("Producto Físico (Todos)")) {
    code = code.replace(
        "{searchCategory === '99' && (\n                <select value={searchBlock}",
        productSelect.trim() + "\n              {searchCategory === '99' && (\n                <select value={searchBlock}"
    );
}

// 4. Update handleSearchAPI
if (!code.includes("physicalProductId: searchPhysicalProduct")) {
    code = code.replace(
        "const mylFilters = searchCategory === '99' ? { type: mylType, race: mylRace, cost: mylCost, blockId: searchBlock } : {};",
        "const mylFilters = searchCategory === '99' ? { type: mylType, race: mylRace, cost: mylCost, blockId: searchBlock, physicalProductId: searchPhysicalProduct } : {};"
    );
}

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', code);
console.log("Updated FolderPokemon.jsx");
