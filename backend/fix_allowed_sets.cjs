const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8');

const regex = /const allowedSets = \['Espada Sagrada', 'Helenica', 'Tierras Altas', 'Dominios de RA'\];[\s\S]*?sortedSets = allowedSets\.map\(name => sortedSets\.find\(s => s\.name === name\)\)\.filter\(Boolean\);/;

if (regex.test(code)) {
    const replacement = `const allowedSets = ['Hijos de Daana', 'Espada Sagrada', 'Helénica', 'Dominios de RA', 'Drácula e Inferno'];
              sortedSets = allowedSets.map(name => sortedSets.find(s => s.name === name)).filter(Boolean);`;
    code = code.replace(regex, replacement);
    fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', code);
    console.log("Updated allowedSets in FolderPokemon.jsx");
} else {
    console.log("Could not find allowedSets block.");
}
