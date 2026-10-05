// Genera la migración de datos que deja producción igual que la base local tras importar los bloques de Mitos y Leyendas
// con import_tcg_block.cjs: productos físicos por bloque, enlaces carta <-> producto, producto principal y extData cambiado.
// Uso: node scripts/catalog/generate_myl_import_migration.cjs <carpeta_backup_previo> [carpeta_migracion]
// Solo lee la base local y el backup; escribe únicamente el migration.sql indicado.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');

const BACKUP = process.argv[2];
const OUT_DIR = process.argv[3] || path.join(__dirname, '..', '..', 'prisma', 'migrations', '20260930110000_import_myl_blocks');
const CATEGORY_ID = 99;
if (!BACKUP) { console.error('Falta la carpeta del backup previo'); process.exit(1); }

const readBackup = (t) => {
  const parsed = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(BACKUP, `${t}.json.gz`))).toString('utf8'));
  return Array.isArray(parsed) ? parsed : parsed.rows || parsed.data;
};
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

(async () => {
  const prisma = new PrismaClient();
  const blocks = await prisma.tcgBlock.findMany({ where: { categoryId: CATEGORY_ID } });
  const blockName = new Map(blocks.map((b) => [b.id, b.name]));
  const physical = await prisma.tcgPhysicalProduct.findMany({ where: { categoryId: CATEGORY_ID } });
  const ppById = new Map(physical.map((p) => [p.id, p]));
  const cards = await prisma.tcgProduct.findMany({
    where: { categoryId: CATEGORY_ID },
    select: { productId: true, name: true, groupId: true, imageUrl: true, extData: true, physicalProductId: true, physicalLinks: { select: { physicalProductId: true } } },
  });
  const groups = await prisma.tcgGroup.findMany({ where: { categoryId: CATEGORY_ID } });
  await prisma.$disconnect();

  // Diferencias contra el backup (estado de producción antes del cambio)
  const before = new Map(readBackup('TcgProduct').filter((r) => r.categoryId === CATEGORY_ID).map((r) => [String(r.productId), r]));
  const beforeGroups = new Map(readBackup('TcgGroup').map((g) => [g.groupId, g]));
  const stat = { cartasLocal: cards.length, cartasBackup: before.size, cartasNuevas: 0, extDataCambiado: 0, imagenCambiada: 0, nombreCambiado: 0, edicionCambiada: 0, edicionesNuevas: 0, edicionesCambiadas: 0 };
  const extRows = [];
  for (const c of cards) {
    const b = before.get(c.productId);
    if (!b) { stat.cartasNuevas++; continue; }
    if (b.name !== c.name) stat.nombreCambiado++;
    if (b.groupId !== c.groupId) stat.edicionCambiada++;
    if (b.imageUrl !== c.imageUrl) stat.imagenCambiada++;
    if (JSON.stringify(b.extData ?? null) !== JSON.stringify(c.extData ?? null)) { stat.extDataCambiado++; extRows.push([c.productId, c.extData]); }
  }
  for (const g of groups) {
    const b = beforeGroups.get(g.groupId);
    if (!b) stat.edicionesNuevas++;
    else if (b.name !== g.name || b.blockId !== g.blockId) stat.edicionesCambiadas++;
  }
  if (stat.cartasNuevas || stat.nombreCambiado || stat.edicionCambiada || stat.imagenCambiada || stat.edicionesNuevas || stat.edicionesCambiadas) {
    console.error('Hay cambios que esta migración no cubre:', JSON.stringify(stat));
    process.exit(2);
  }

  // Productos físicos y enlaces (por bloque + nombre, nunca por id: los ids pueden diferir entre entornos)
  const ppRows = physical.map((p) => `(${q(blockName.get(p.blockId))}, ${q(p.name)})`);
  const linkRows = [];
  for (const c of cards) {
    for (const l of c.physicalLinks) {
      const p = ppById.get(l.physicalProductId);
      if (!p) continue;
      linkRows.push(`(${q(c.productId)}, ${q(blockName.get(p.blockId))}, ${q(p.name)}, ${p.id === c.physicalProductId})`);
    }
  }

  let sql = `-- Importa los bloques de Mitos y Leyendas (Primer Bloque, Furia Extendido, Primera Era, Imperio) desde los data.json.\n`;
  sql += `-- Productos físicos = nombres de subcarpeta; enlaces carta <-> producto; extData con una entrada por valor (razas, mecánicas).\n`;
  sql += `-- Une siempre por bloque + nombre. No borra cartas ni ediciones; solo elimina productos físicos que quedan sin ninguna carta.\n\n`;
  // La secuencia pudo quedar desfasada si alguna carga insertó ids explícitos
  sql += `SELECT setval(pg_get_serial_sequence('"TcgPhysicalProduct"', 'id'), GREATEST((SELECT COALESCE(MAX("id"), 0) FROM "TcgPhysicalProduct"), 1));\n\n`;
  sql += `CREATE TEMP TABLE _myl_pp (block TEXT, name TEXT) ON COMMIT DROP;\n`;
  for (const part of chunk(ppRows, 500)) sql += `INSERT INTO _myl_pp VALUES\n  ${part.join(',\n  ')};\n`;
  sql += `\nINSERT INTO "TcgPhysicalProduct" ("categoryId", "blockId", "name")\nSELECT ${CATEGORY_ID}, b."id", e.name\nFROM _myl_pp e\nJOIN "TcgBlock" b ON b."categoryId" = ${CATEGORY_ID} AND b."name" = e.block\nWHERE NOT EXISTS (SELECT 1 FROM "TcgPhysicalProduct" pp WHERE pp."categoryId" = ${CATEGORY_ID} AND pp."blockId" = b."id" AND pp."name" = e.name);\n\n`;
  sql += `CREATE TEMP TABLE _myl_link (pid TEXT, block TEXT, name TEXT, main BOOLEAN) ON COMMIT DROP;\n`;
  for (const part of chunk(linkRows, 3000)) sql += `INSERT INTO _myl_link VALUES\n  ${part.join(',\n  ')};\n`;
  sql += `\n-- Los enlaces de estos juegos se reemplazan por los del disco\nDELETE FROM "TcgProductPhysicalProduct" l USING "TcgPhysicalProduct" pp WHERE pp."id" = l."physicalProductId" AND pp."categoryId" = ${CATEGORY_ID};\n\n`;
  sql += `CREATE TEMP TABLE _myl_resolved ON COMMIT DROP AS\nSELECT k.pid, pp."id" AS ppid, k.main\nFROM _myl_link k\nJOIN "TcgBlock" b ON b."categoryId" = ${CATEGORY_ID} AND b."name" = k.block\nJOIN "TcgPhysicalProduct" pp ON pp."categoryId" = ${CATEGORY_ID} AND pp."blockId" = b."id" AND pp."name" = k.name\nJOIN "TcgProduct" pr ON pr."productId" = k.pid;\n\n`;
  sql += `INSERT INTO "TcgProductPhysicalProduct" ("productId", "physicalProductId")\nSELECT pid, ppid FROM _myl_resolved ON CONFLICT DO NOTHING;\n\n`;
  sql += `UPDATE "TcgProduct" pr SET "physicalProductId" = r.ppid FROM _myl_resolved r WHERE r.pid = pr."productId" AND r.main;\n\n`;
  sql += `CREATE TEMP TABLE _myl_ext (pid TEXT, ext JSONB) ON COMMIT DROP;\n`;
  for (const part of chunk(extRows, 300)) sql += `INSERT INTO _myl_ext VALUES\n  ${part.map(([pid, ext]) => `(${q(pid)}, ${q(JSON.stringify(ext))}::jsonb)`).join(',\n  ')};\n`;
  sql += `\nUPDATE "TcgProduct" pr SET "extData" = e.ext FROM _myl_ext e WHERE e.pid = pr."productId";\n\n`;
  sql += `-- Productos físicos de estos juegos que no quedaron con ninguna carta ni son el principal de ninguna\n`;
  sql += `DELETE FROM "TcgPhysicalProduct" pp WHERE pp."categoryId" = ${CATEGORY_ID}\n  AND NOT EXISTS (SELECT 1 FROM "TcgProductPhysicalProduct" l WHERE l."physicalProductId" = pp."id")\n  AND NOT EXISTS (SELECT 1 FROM "TcgProduct" pr WHERE pr."physicalProductId" = pp."id");\n`;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'migration.sql'), sql);
  console.log(JSON.stringify({ ...stat, productosFisicos: ppRows.length, enlaces: linkRows.length, extDataFilas: extRows.length, archivoKB: Math.round(sql.length / 1024) }, null, 1));
})();
