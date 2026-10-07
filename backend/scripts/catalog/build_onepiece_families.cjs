// Genera frontend/public/onepiece-families.json: las familias (Subtypes) de todas las cartas de One Piece en TCGCSV.
// El buscador de "agregar cartas" las usa para el filtro de familia sin tener que cargar todas las ediciones.
// Uso (desde backend/): node scripts/catalog/build_onepiece_families.cjs
const fs = require('fs');
const path = require('path');

const BASE = 'https://tcgcsv.com/tcgplayer/68';
const get = async (url) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Carpetazo' } });
    if (response.ok) return response.json();
  }
  throw new Error(`No se pudo leer ${url}`);
};

(async () => {
  const groups = (await get(`${BASE}/groups`)).results;
  const counts = new Map();
  for (let i = 0; i < groups.length; i += 8) {
    const lists = await Promise.all(groups.slice(i, i + 8).map((group) => get(`${BASE}/${group.groupId}/products`).then((json) => json.results).catch(() => [])));
    lists.flat().forEach((product) => {
      const subtypes = (product.extendedData || []).find((entry) => entry.name === 'Subtypes')?.value;
      String(subtypes || '').split(';').map((part) => part.trim()).filter(Boolean).forEach((family) => counts.set(family, (counts.get(family) || 0) + 1));
    });
  }
  const families = [...counts.keys()].sort((a, b) => a.localeCompare(b));
  const output = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'onepiece-families.json');
  fs.writeFileSync(output, JSON.stringify(families));
  console.log(`${families.length} familias en ${output}`);
})();
