const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8');

const regex = /filtered\.sort\(\(a, b\) => \{[\s\S]*?\}\);/g;

if (regex.test(code)) {
    code = code.replace(regex, '');
    fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', code);
    console.log("Removed hardcoded frontend sorting.");
} else {
    console.log("Could not find the sort block.");
}
