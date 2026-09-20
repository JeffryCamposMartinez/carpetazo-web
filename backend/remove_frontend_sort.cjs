const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8');

const regex = /if\s*\(searchCategory\s*===\s*'99'\)\s*\{\s*filtered\.sort\(\(a,\s*b\)\s*=>\s*\{[\s\S]*?\}\);\s*\}/;

if (regex.test(code)) {
    code = code.replace(regex, '');
    fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', code);
    console.log("Removed hardcoded frontend sorting. Cards will now respect backend sorting.");
} else {
    console.log("Could not find the sort block.");
}
