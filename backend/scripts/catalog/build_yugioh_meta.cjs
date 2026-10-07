// Genera frontend/public/yugioh-meta.json con lo que TCGCSV no trae de Yu-Gi-Oh!: nivel o rango, escala péndulo, rating de Enlace,
// arquetipo y estado en la lista de prohibidas del TCG (datos gratuitos de YGOPRODeck, sin clave).
// El buscador de "agregar cartas" lo carga una sola vez y no consulta YGOPRODeck en vivo.
// Uso (desde backend/): node scripts/catalog/build_yugioh_meta.cjs
const fs = require('fs');
const path = require('path');

const HEADERS = { 'User-Agent': 'CarpetazoCatalog/1.0 (carpetazo.cl)', Accept: 'application/json' };
const BAN = { Forbidden: 1, Limited: 2, 'Semi-Limited': 3 };

// Misma normalización que usa el navegador (frontend/src/services/tcgcsvYugioh.js)
const normalizeName = (name) => String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

(async () => {
  const response = await fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php', { headers: HEADERS });
  if (!response.ok) throw new Error(`YGOPRODeck: ${response.status}`);
  const cards = (await response.json()).data;

  const archetypes = [...new Set(cards.map((card) => card.archetype).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const archetypeIndex = new Map(archetypes.map((name, index) => [name, index]));

  const out = {};
  for (const card of cards) {
    const isLink = /Link/.test(card.type);
    const value = [
      isLink ? '' : (card.level ?? ''),
      card.scale ?? '',
      card.archetype ? archetypeIndex.get(card.archetype) : '',
      BAN[card.banlist_info?.ban_tcg] || 0,
      isLink ? (card.linkval ?? '') : '',
    ].join(';');
    out[normalizeName(card.name)] = value;
  }

  const output = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'yugioh-meta.json');
  fs.writeFileSync(output, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), archetypes, cards: out }));
  console.log(`${Object.keys(out).length} cartas, ${archetypes.length} arquetipos -> ${(fs.statSync(output).size / 1e6).toFixed(2)} MB`);
})().catch((error) => { console.error(error); process.exit(1); });
