const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8');

const regex = /<select[\s\S]*?value=\{searchCategory\}[\s\S]*?disabled=\{true\}[\s\S]*?<\/select>/;

if (regex.test(code)) {
    code = code.replace(regex, '');
    fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', code);
    console.log("Successfully removed the TCG dropdown this time.");
} else {
    console.log("Could not find the dropdown.");
}
