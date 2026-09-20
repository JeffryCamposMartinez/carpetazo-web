const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8');

code = code.replace(
  /placeholder="Nombre \(ej\. Pikachu\) o CÃ³digo \(ej\. 15\/165\)"/,
  'placeholder={searchCategory === "99" ? "Nombre de la carta (ej. Oseye)" : "Nombre (ej. Pikachu) o Código"}'
);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', code);
console.log("Updated placeholder in FolderPokemon.jsx");
