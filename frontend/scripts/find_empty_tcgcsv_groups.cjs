// Genera public/empty-groups-tcgcsv.json: ediciones de TCGCSV (Pokémon EN=3, JP=85) sin ninguna carta
// (solo productos sellados). Guarda el modifiedOn de cada grupo: si TCGCSV lo actualiza, la edición
// vuelve a mostrarse en el filtro y se reevalúa la próxima vez que se corra este script.
// Uso: node scripts/find_empty_tcgcsv_groups.cjs
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'empty-groups-tcgcsv.json');
const CATEGORIES = [3, 85];
const CONCURRENCY = 8;

const getJson = async (url) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Carpetazo/1.0 (+https://carpetazo.cl)' } });
      if (res.ok) return await res.json();
    } catch { /* reintenta */ }
    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
  }
  throw new Error(`No se pudo leer ${url}`);
};

const hasCards = (json) => (json.results || []).some(p => (p.extendedData || []).some(e => e.name === 'Number' && e.value));

(async () => {
  const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const result = {};

  for (const cat of CATEGORIES) {
    const groups = (await getJson(`https://tcgcsv.com/tcgplayer/${cat}/groups`)).results || [];
    const prev = previous[cat] || {};
    const empty = {};
    let cursor = 0;

    const worker = async () => {
      while (cursor < groups.length) {
        const g = groups[cursor++];
        if (new Date(g.publishedOn) > new Date()) continue; // futuras: el filtro ya las oculta
        if (prev[g.groupId] && prev[g.groupId] === g.modifiedOn) { empty[g.groupId] = g.modifiedOn; continue; }
        const json = await getJson(`https://tcgcsv.com/tcgplayer/${cat}/${g.groupId}/products`);
        if (!hasCards(json)) empty[g.groupId] = g.modifiedOn;
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    result[cat] = empty;
    console.log(`Categoría ${cat}: ${Object.keys(empty).length} vacías de ${groups.length}`);
  }

  fs.writeFileSync(OUT, JSON.stringify(result));
  console.log('Guardado en', OUT);
})();
