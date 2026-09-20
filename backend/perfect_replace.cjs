const fs = require('fs');
const lines = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8').split('\n');

const newLines = [];
let inSelect = false;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // 1. Replace title
  if (line.includes('Buscar en PokÃ©mon TCG')) {
    line = line.replace('Buscar en PokÃ©mon TCG', 'Buscar en {folderData?.tcg || "Catálogo"}');
  }

  // 2. Replace placeholder
  if (line.includes('placeholder="Nombre (ej. Pikachu) o CÃ³digo (ej. 15/165)"')) {
    line = line.replace(
      'placeholder="Nombre (ej. Pikachu) o CÃ³digo (ej. 15/165)"',
      'placeholder={searchCategory === "99" ? "Nombre de la carta (ej. Oseye)" : "Nombre (ej. Pikachu) o Código"}'
    );
  }

  // 3. Remove select block
  if (line.includes('<select') && lines[i+1] && lines[i+1].includes('value={searchCategory}') && lines[i+2] && lines[i+2].includes('disabled={true}')) {
    inSelect = true;
  }
  
  if (inSelect) {
    if (line.includes('</select>')) {
      inSelect = false;
    }
    continue; // Skip lines in the select block
  }

  // 4. Adjust widths
  if (line.includes('className="w-full sm:w-1/3 px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] transition-colors"')) {
    line = line.replace('w-full sm:w-1/3', 'w-full sm:w-1/2');
  }
  if (line.includes("className={`relative w-full ${searchCategory === '99' ? 'sm:w-1/3' : 'sm:w-2/3'}`}")) {
    line = line.replace("sm:w-1/3", "sm:w-1/2");
  }

  newLines.push(line);
}

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', newLines.join('\n'));
console.log("Replaced perfectly via line-by-line parsing.");
