const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8');

code = code.replace(
  /}, \[rawSearchResults, filterType, filterRarity, searchQuery\]\);/,
  "}, [rawSearchResults, filterType, filterRarity, searchQuery, mylType, mylRace, mylCost, searchPhysicalProduct]);"
);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', code);
console.log("Updated dependency array");
