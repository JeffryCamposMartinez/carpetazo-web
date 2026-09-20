const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8');

// 1. Replace title
code = code.replace(/Buscar en PokÃ©mon TCG/g, 'Buscar en {folderData?.tcg || "Catálogo"}');

// 2. Remove the select category block
const selectCategoryBlock = `<select 
                  value={searchCategory} 
                  disabled={true}
                  className="w-full sm:w-1/3 px-4 py-3 rounded-lg border border-gray-300 bg-gray-100 text-gray-500 focus:outline-none cursor-not-allowed font-medium"
                >
                  <option value="" disabled>Seleccionar TCG</option>
                  {availableCategories.map(cat => (
                    <option key={cat.categoryId} value={cat.categoryId}>{cat.name}</option>
                  ))}
                </select>`;
                
// It might have CRLF or extra spaces, so I will use a Regex
const regexSelect = /<select[\s\S]*?value=\{searchCategory\}[\s\S]*?disabled=\{true\}[\s\S]*?<\/select>/;
code = code.replace(regexSelect, '');

// 3. Fix widths
// Change sm:w-1/3 to sm:w-1/2 for searchBlock
code = code.replace(
  /<select value=\{searchBlock\} onChange=\{\(e\) => \{ setSearchBlock\(e\.target\.value\); setSearchSet\(''\); \}\} className="w-full sm:w-1\/3/,
  '<select value={searchBlock} onChange={(e) => { setSearchBlock(e.target.value); setSearchSet(\'\'); }} className="w-full sm:w-1/2'
);
// Change sm:w-1/3 for the div wrapping the searchSet dropdown
code = code.replace(
  /className=\{`relative w-full \$\{searchCategory === '99' \? 'sm:w-1\/3' : 'sm:w-2\/3'\}`\}/,
  'className={`relative w-full ${searchCategory === \'99\' ? \'sm:w-1/2\' : \'sm:w-2/3\'}`}'
);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', code);
console.log("Updated FolderPokemon.jsx");
