const fs = require('fs');
const code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8');
const match = code.match(/filtered\.sort\(\(a, b\) => \{[\s\S]*?\}\);/g);
console.log(match);
