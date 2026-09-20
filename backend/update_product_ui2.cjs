const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8');

code = code.replace(
  `setSearchBlock(e.target.value); setSearchSet('');`,
  `setSearchBlock(e.target.value); setSearchSet(''); setSearchPhysicalProduct('');`
);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', code);
console.log("Updated search block onChange");
