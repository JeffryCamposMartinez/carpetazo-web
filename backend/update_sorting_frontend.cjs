const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', 'utf8');

const target = 'filtered.sort((a, b) => {\n          // 1. Edition Order';
const replacement = `filtered.sort((a, b) => {
          // 0. Physical Product Date Order (Newest first)
          const indexA = availablePhysicalProducts.findIndex(p => p.id === a.physicalProductId);
          const indexB = availablePhysicalProducts.findIndex(p => p.id === b.physicalProductId);
          const orderA = indexA === -1 ? 99999 : indexA;
          const orderB = indexB === -1 ? 99999 : indexB;
          
          if (orderA !== orderB) {
            return orderA - orderB;
          }

          // 1. Edition Order`;

if (code.includes('// 1. Edition Order') && !code.includes('// 0. Physical Product Date Order')) {
  code = code.replace(target, replacement);
  fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx', code);
  console.log("Updated sorting in FolderPokemon.jsx");
} else {
  console.log("Could not find the insertion point or already updated.");
}
