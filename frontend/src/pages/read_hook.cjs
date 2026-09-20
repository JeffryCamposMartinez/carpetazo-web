const fs = require('fs');
const lines = fs.readFileSync('FolderPokemon.jsx', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes("let filtered = rawSearchResults"));
if (idx !== -1) {
    console.log(lines.slice(idx + 35, idx + 80).join('\n'));
}
