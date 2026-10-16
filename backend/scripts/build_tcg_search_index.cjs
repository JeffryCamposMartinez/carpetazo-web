const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const source = process.argv[2] || 'C:/Users/Jeffry/Desktop/TcgplayerUpdate/Descargas';
const output = process.argv[3] || path.join(__dirname, '..', 'data', 'tcg-search-index.json.gz');
const games = fs.readdirSync(source, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('_'));
const cards = [];
function* files(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) yield* files(p); else if (e.name === 'data.json') yield p; } }
for (const game of games) {
  const db = path.join(source, game.name, `${game.name}_DB`);
  const data = path.join(db, `${game.name}_Data`);
  if (!fs.existsSync(data)) continue;
  for (const file of files(data)) {
    try { const c = JSON.parse(fs.readFileSync(file, 'utf8')); if (c.kind && c.kind !== 'card') continue; cards.push({ id: `${c.categoryId}:${c.productId}`, productId: c.productId, categoryId: c.categoryId, game: c.game || game.name, name: c.name, clean: String(c.cleanName || c.name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), number: c.number || null, rarity: c.rarity || null, setName: c.set?.name || null, imageUrl: c.imageUrl || null, url: c.url || null }); } catch (_) { /* reportes se conservan fuera del índice */ }
  }
}
cards.sort((a, b) => a.clean.localeCompare(b.clean) || String(a.id).localeCompare(String(b.id)));
fs.mkdirSync(path.dirname(output), { recursive: true });
const payload = JSON.stringify({ version: new Date().toISOString(), source: path.resolve(source), cards });
fs.writeFileSync(output, zlib.gzipSync(payload, { level: 9 }));
console.log(`Índice TCG generado: ${cards.length} cartas -> ${output}`);
