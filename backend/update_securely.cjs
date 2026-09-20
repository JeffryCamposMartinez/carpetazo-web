const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8');

// 1. Replace title safely
code = code.replace("Buscar en PokÃ©mon TCG", "Buscar en {folderData?.tcg || 'Mitos y Leyendas'}");

// 2. Replace placeholder safely
code = code.replace(
  'placeholder="Nombre (ej. Pikachu) o CÃ³digo (ej. 15/165)"',
  'placeholder={searchCategory === "99" ? "Nombre de la carta (ej. Oseye)" : "Nombre (ej. Pikachu) o Código"}'
);

// 3. Remove the TCG dropdown safely
const dropdownStart = code.indexOf('<select \n                  value={searchCategory}');
const dropdownEndStr = '                </select>';
const dropdownEnd = code.indexOf(dropdownEndStr, dropdownStart);
if (dropdownStart !== -1 && dropdownEnd !== -1) {
  code = code.substring(0, dropdownStart) + code.substring(dropdownEnd + dropdownEndStr.length);
}

// 4. Adjust widths safely
code = code.replace(
  'className="w-full sm:w-1/3 px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] transition-colors"',
  'className="w-full sm:w-1/2 px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] transition-colors"'
);

code = code.replace(
  'className={`relative w-full ${searchCategory === \'99\' ? \'sm:w-1/3\' : \'sm:w-2/3\'}`}',
  'className={`relative w-full ${searchCategory === \'99\' ? \'sm:w-1/2\' : \'sm:w-2/3\'}`}'
);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', code);
console.log("Updated securely.");
