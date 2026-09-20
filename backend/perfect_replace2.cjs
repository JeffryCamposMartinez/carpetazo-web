const fs = require('fs');
const lines = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8').split('\n');

const newLines = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  if (line.includes('Buscar en Pok')) {
    line = '            Buscar en {folderData?.tcg || "Catálogo"}';
  }

  if (line.includes('placeholder="Nombre (ej. Pikachu)')) {
    line = '              placeholder={searchCategory === "99" ? "Nombre de la carta (ej. Oseye)" : "Nombre (ej. Pikachu) o Código"}';
  }

  newLines.push(line);
}

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', newLines.join('\n'));
console.log("Replaced using substring matching.");
