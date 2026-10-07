// Genera frontend/public/riftbound-tags.json: las etiquetas (regiones, razas, campeones, equipo) de todas las cartas de Riftbound en TCGCSV.
// El buscador de "agregar cartas" las usa para el filtro de etiqueta sin cargar todas las ediciones.
// Uso (desde backend/): node scripts/catalog/build_riftbound_tags.cjs
const fs = require('fs');
const path = require('path');

const BASE = 'https://tcgcsv.com/tcgplayer/89';
const get = async (url) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Carpetazo' } });
    if (response.ok) return response.json();
  }
  throw new Error(`No se pudo leer ${url}`);
};

(async () => {
  const groups = (await get(`${BASE}/groups`)).results;
  const tags = new Set();
  for (let i = 0; i < groups.length; i += 6) {
    const lists = await Promise.all(groups.slice(i, i + 6).map((group) => get(`${BASE}/${group.groupId}/products`).then((json) => json.results).catch(() => [])));
    lists.flat().forEach((product) => {
      const value = (product.extendedData || []).find((entry) => entry.name === 'Tag')?.value;
      String(value || '').split(';').map((part) => part.trim()).filter((tag) => tag && tag !== 'None').forEach((tag) => tags.add(tag));
    });
  }
  const output = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'riftbound-tags.json');
  fs.writeFileSync(output, JSON.stringify([...tags].sort((a, b) => a.localeCompare(b))));
  console.log(`${tags.size} etiquetas en ${output}`);
})();
