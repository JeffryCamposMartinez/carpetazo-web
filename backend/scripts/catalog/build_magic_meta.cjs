// Genera frontend/public/magic-meta.json con lo que TCGCSV no trae de Magic: colores, identidad de color, valor de maná,
// formatos donde es legal y habilidades clave (datos gratuitos de Scryfall, "Oracle Cards").
// El buscador de "agregar cartas" lo carga una sola vez y no consulta Scryfall en vivo.
// Uso (desde backend/): node scripts/catalog/build_magic_meta.cjs
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const zlib = require('zlib');
const { Readable } = require('stream');

const HEADERS = { 'User-Agent': 'CarpetazoCatalog/1.0 (carpetazo.cl)', Accept: 'application/json' };
const FORMATS = ['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'commander', 'pauper'];

// Misma normalización que usa el navegador (frontend/src/services/tcgcsvMagic.js)
const normalizeName = (name) => String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const getJson = async (url) => {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const bulk = (await getJson('https://api.scryfall.com/bulk-data')).data.find((item) => item.type === 'oracle_cards');
  console.log('Descargando', bulk.jsonl_download_uri);
  const response = await fetch(bulk.jsonl_download_uri, { headers: HEADERS });
  if (!response.ok) throw new Error(`Descarga: ${response.status}`);
  const lines = readline.createInterface({ input: Readable.fromWeb(response.body).pipe(zlib.createGunzip()), crlfDelay: Infinity });

  const cards = [];
  const keywordSet = new Set();
  for await (const line of lines) {
    if (!line.trim()) continue;
    const card = JSON.parse(line);
    (card.keywords || []).forEach((keyword) => keywordSet.add(keyword));
    cards.push(card);
  }
  const keywords = [...keywordSet].sort((a, b) => a.localeCompare(b));
  const keywordIndex = new Map(keywords.map((keyword, index) => [keyword, index]));

  const out = {};
  const score = {};
  const SKIP_LAYOUTS = ['art_series', 'token', 'double_faced_token', 'emblem', 'vanguard', 'planar', 'scheme'];
  for (const card of cards) {
    if (SKIP_LAYOUTS.includes(card.layout)) continue;
    const front = card.card_faces?.[0];
    const colors = (card.colors || front?.colors || []).join('');
    const identity = (card.color_identity || []).join('');
    const legal = FORMATS.map((format) => (['legal', 'restricted'].includes(card.legalities?.[format]) ? '1' : '0')).join('');
    const value = `${colors};${identity};${Number.isFinite(card.cmc) ? card.cmc : 0};${legal};${(card.keywords || []).map((keyword) => keywordIndex.get(keyword)).join(',')}`;
    const key = normalizeName(String(card.name).split(' // ')[0]);
    // Si varias cartas comparten nombre, gana la que se puede jugar en algún formato y no es solo digital
    const points = (legal.includes('1') ? 2 : 0) + (card.digital ? 0 : 1);
    if (score[key] === undefined || points > score[key]) { out[key] = value; score[key] = points; }
  }

  // Tipos de criatura, artefacto, encantamiento, tierra, hechizo y planeswalker para el filtro de subtipo
  const subtypes = new Set();
  for (const catalog of ['creature-types', 'artifact-types', 'enchantment-types', 'land-types', 'spell-types', 'planeswalker-types']) {
    (await getJson(`https://api.scryfall.com/catalog/${catalog}`)).data.forEach((name) => subtypes.add(name));
    await pause(120);
  }

  const output = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'magic-meta.json');
  fs.writeFileSync(output, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), formats: FORMATS, keywords, subtypes: [...subtypes].sort((a, b) => a.localeCompare(b)), cards: out }));
  console.log(`${Object.keys(out).length} cartas, ${keywords.length} habilidades, ${subtypes.size} subtipos -> ${(fs.statSync(output).size / 1e6).toFixed(2)} MB`);
})().catch((error) => { console.error(error); process.exit(1); });
