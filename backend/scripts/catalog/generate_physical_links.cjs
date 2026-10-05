// Genera una migración SQL que llena TcgProductPhysicalProduct (carta <-> producto físico) para Mitos y Leyendas.
// Fuente: los data.json descargados (campo productName de cada carta) + los productos físicos de la base.
// Uso: node scripts/catalog/generate_physical_links.cjs [carpeta_descargas] [carpeta_migracion]
// Solo lee la base; escribe únicamente el archivo migration.sql indicado.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');

const ROOT = process.argv[2] || (process.env.CARPETAZO_DOWNLOADS ? process.env.CARPETAZO_DOWNLOADS + '/Mitos_y_Leyendas' : 'C:/Users/Jeffry/Desktop/CarpetazoUpdater/Descargas/Mitos_y_Leyendas');
const OUT_DIR = process.argv[3] || path.join(__dirname, '..', '..', 'prisma', 'migrations', '20260930024500_backfill_product_physical_links');
const CATEGORY_ID = 99;

const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sqlText = (s) => `'${String(s).replace(/'/g, "''")}'`;

(async () => {
  // 1) Cartas del disco: id -> nombres de producto según el data.json
  const diskProducts = new Map(); // id -> Set(productName)
  for (const blockDir of fs.readdirSync(ROOT)) {
    const dataRoot = path.join(ROOT, blockDir, blockDir.replace(/_DB$/, '') + '_Data');
    if (!fs.existsSync(dataRoot)) continue;
    for (const edition of fs.readdirSync(dataRoot)) {
      const edPath = path.join(dataRoot, edition);
      if (!fs.statSync(edPath).isDirectory()) continue;
      for (const folder of fs.readdirSync(edPath)) {
        const file = path.join(edPath, folder, 'data.json');
        if (!fs.existsSync(file)) continue;
        const j = read(file);
        if (!j.productName) continue;
        const id = String(j.id);
        if (!diskProducts.has(id)) diskProducts.set(id, new Set());
        diskProducts.get(id).add(j.productName);
      }
    }
  }

  // 2) Base: productos físicos, cuántas cartas tiene cada uno hoy y el enlace actual de cada carta
  const prisma = new PrismaClient();
  const physical = await prisma.tcgPhysicalProduct.findMany({ select: { id: true, name: true, blockId: true } });
  const cards = await prisma.tcgProduct.findMany({ where: { categoryId: CATEGORY_ID }, select: { productId: true, physicalProductId: true, group: { select: { blockId: true } } } });
  const blockOf = new Map(cards.map((c) => [c.productId, c.group?.blockId ?? null]));
  await prisma.$disconnect();

  const cardsPerPhysical = new Map();
  for (const c of cards) if (c.physicalProductId) cardsPerPhysical.set(c.physicalProductId, (cardsPerPhysical.get(c.physicalProductId) || 0) + 1);
  const byNorm = new Map();
  for (const p of physical) { const k = norm(p.name); if (!byNorm.has(k)) byNorm.set(k, []); byNorm.get(k).push(p); }
  const inDb = new Set(cards.map((c) => c.productId));

  // 3) Enlaces: los actuales + los que indica el disco. Si un nombre coincide con productos duplicados,
  //    se prefiere el que ya tiene cartas (el "real"); si ninguno tiene, se usan todos.
  const links = new Set();
  const usedPhysical = new Map();
  const stats = { cartasEnDisco: diskProducts.size, cartasEnBase: cards.length, enlacesActuales: 0, enlacesDelDisco: 0, nombresSinProducto: new Set(), sinProductoEnSuBloque: new Set() };
  for (const c of cards) if (c.physicalProductId) { links.add(`${c.productId}|${c.physicalProductId}`); stats.enlacesActuales++; }
  for (const [id, names] of diskProducts) {
    if (!inDb.has(id)) continue;
    for (const name of names) {
      const candidates = byNorm.get(norm(name));
      if (!candidates) { stats.nombresSinProducto.add(name); continue; }
      // Mismo nombre en varios bloques (p. ej. "Generales"): se respeta el bloque de la carta
      const cardBlock = blockOf.get(id);
      let pool = candidates.filter((p) => p.blockId === cardBlock);
      if (pool.length === 0) {
        if (candidates.length === 1) pool = candidates;
        else { stats.sinProductoEnSuBloque.add(`${name} (bloque ${cardBlock})`); continue; }
      }
      const withCards = pool.filter((p) => (cardsPerPhysical.get(p.id) || 0) > 0);
      for (const p of (withCards.length ? withCards : pool)) { links.add(`${id}|${p.id}`); stats.enlacesDelDisco++; }
    }
  }
  for (const key of links) { const ppid = Number(key.split('|')[1]); usedPhysical.set(ppid, physical.find((p) => p.id === ppid).name); }

  // 4) SQL: se une por id Y por nombre para no enlazar un producto equivocado si los ids difieren en otro entorno
  const pairs = [...links].map((k) => k.split('|')).sort((a, b) => Number(a[0]) - Number(b[0]) || Number(a[1]) - Number(b[1]));
  const ppRows = [...usedPhysical].sort((a, b) => a[0] - b[0]).map(([id, name]) => `(${id}, ${sqlText(name)})`).join(',\n  ');
  const linkRows = pairs.map(([pid, ppid]) => `(${sqlText(pid)}, ${ppid})`);
  const chunks = [];
  for (let i = 0; i < linkRows.length; i += 4000) chunks.push(linkRows.slice(i, i + 4000).join(',\n  '));

  let sql = `-- Enlaces carta <-> producto físico de Mitos y Leyendas, generados desde los data.json (campo productName).\n`;
  sql += `-- Une por id y por nombre del producto: si algo no coincide en este entorno, esa fila se omite en vez de enlazar mal.\n`;
  sql += `-- Es idempotente (ON CONFLICT DO NOTHING) y no modifica ninguna otra tabla.\n\n`;
  sql += `CREATE TEMP TABLE _pp_expected (id INTEGER, name TEXT) ON COMMIT DROP;\nINSERT INTO _pp_expected VALUES\n  ${ppRows};\n\n`;
  chunks.forEach((chunk) => {
    sql += `INSERT INTO "TcgProductPhysicalProduct" ("productId", "physicalProductId")\nSELECT l.pid, l.ppid\nFROM (VALUES\n  ${chunk}\n) AS l(pid, ppid)\nJOIN _pp_expected e ON e.id = l.ppid\nJOIN "TcgPhysicalProduct" pp ON pp.id = e.id AND pp.name = e.name\nJOIN "TcgProduct" pr ON pr."productId" = l.pid\nON CONFLICT DO NOTHING;\n\n`;
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'migration.sql'), sql);
  console.log(JSON.stringify({ ...stats, nombresSinProducto: [...stats.nombresSinProducto], sinProductoEnSuBloque: [...stats.sinProductoEnSuBloque], enlacesTotales: pairs.length, productosFisicosUsados: usedPhysical.size, archivoKB: Math.round(sql.length / 1024) }, null, 1));
})();
