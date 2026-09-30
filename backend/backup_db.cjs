// Respaldo lógico de la base de datos: cada tabla a un .json.gz (solo lectura).
// Uso: node backup_db.cjs [carpeta_destino]
// Restaurar es un import manual con Prisma; para respaldos "de verdad" conviene además un pg_dump nocturno en el servidor.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { PrismaClient } = require('@prisma/client');

try {
  require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
} catch (_) {
  // dotenv es opcional si el entorno ya está cargado
}

const prisma = new PrismaClient();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = process.argv[2] || path.join(__dirname, 'backups', stamp);

// Prisma no serializa BigInt/Date por defecto en JSON.stringify
const replacer = (_key, value) => (typeof value === 'bigint' ? Number(value) : value);

const TABLES = [
  ['User', () => prisma.user.findMany()],
  ['Folder', () => prisma.folder.findMany()],
  ['Card', () => prisma.card.findMany()],
  ['Message', () => prisma.message.findMany()],
  ['Order', () => prisma.order.findMany()],
  ['TcgCategory', () => prisma.tcgCategory.findMany()],
  ['TcgBlock', () => prisma.tcgBlock.findMany()],
  ['TcgGroup', () => prisma.tcgGroup.findMany()],
  ['TcgPhysicalProduct', () => prisma.tcgPhysicalProduct.findMany()],
  ['TcgProduct', () => prisma.tcgProduct.findMany()],
  ['TcgProductPhysicalProduct', () => prisma.tcgProductPhysicalProduct.findMany()],
];

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = { createdAt: new Date().toISOString(), tables: {} };
  for (const [name, load] of TABLES) {
    const rows = await load();
    const file = path.join(outDir, `${name}.json.gz`);
    fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(rows, replacer)));
    manifest.tables[name] = { rows: rows.length, bytes: fs.statSync(file).size };
    console.log(`${name}: ${rows.length} filas`);
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('Respaldo en', outDir);
})()
  .catch((err) => { console.error('Error:', err.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
