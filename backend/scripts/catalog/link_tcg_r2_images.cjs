// Vincula las cartas importadas desde TcgplayerUpdate con sus objetos ya subidos a R2.
// Simulación: node scripts/catalog/link_tcg_r2_images.cjs
// Aplicar:    node scripts/catalog/link_tcg_r2_images.cjs --apply
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');

const args = process.argv.slice(2);
const get = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const apply = args.includes('--apply');
const root = get('root', 'C:\\Users\\Jeffry\\Desktop\\TcgplayerUpdate\\Descargas');
const chunkSize = 500;

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const imageExtensions = ['.webp', '.png', '.jpg', '.jpeg'];
const findImage = (imageRoot, relativeDataFile) => {
  const relativeDir = path.dirname(relativeDataFile);
  const cardFolder = path.basename(relativeDir);
  const folder = path.join(imageRoot, relativeDir);
  if (!fs.existsSync(folder)) return null;
  const preferred = imageExtensions.map((ext) => path.join(folder, `${cardFolder}${ext}`)).find(fs.existsSync);
  if (preferred) return preferred;
  return fs.readdirSync(folder, { withFileTypes: true }).find((entry) => entry.isFile() && imageExtensions.includes(path.extname(entry.name).toLowerCase()))
    ? path.join(folder, fs.readdirSync(folder, { withFileTypes: true }).find((entry) => entry.isFile() && imageExtensions.includes(path.extname(entry.name).toLowerCase())).name)
    : null;
};

const scan = () => {
  const links = new Map();
  const missingImages = [];
  if (!fs.existsSync(root)) throw new Error(`No existe la carpeta de descargas: ${root}`);
  for (const gameEntry of fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const gameFolder = gameEntry.name;
    const gameRoot = path.join(root, gameFolder);
    for (const dbEntry of fs.readdirSync(gameRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /_DB$/i.test(entry.name))) {
      const dbName = dbEntry.name;
      const baseName = dbName.replace(/_DB$/i, '');
      const dataRoots = [`${baseName}_Data`].map((name) => path.join(gameRoot, dbName, name)).filter(fs.existsSync);
      const imageRoot = path.join(gameRoot, dbName, `${baseName}_Images`);
      for (const dataRoot of dataRoots) {
        const walk = (dir) => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(file);
            else if (entry.isFile() && entry.name.toLowerCase() === 'data.json') {
              try {
                const card = readJson(file);
                if (card.kind && card.kind !== 'card') return;
                const productId = Number(card.productId);
                if (!Number.isInteger(productId)) return;
                const relativeDataFile = path.relative(dataRoot, file);
                const image = findImage(imageRoot, relativeDataFile);
                if (!image) { missingImages.push({ productId, gameFolder, file }); return; }
                const relativeImage = path.relative(imageRoot, image).replace(/\\/g, '/');
                const key = ['Carpetazo.cl', gameFolder, dbName, `${baseName}_Images`, relativeImage].join('/');
                links.set(productId, { productId, categoryId: Number(card.categoryId), key });
              } catch (_) { /* un JSON roto no debe detener las demás cartas */ }
            }
          }
        };
        walk(dataRoot);
      }
    }
  }
  return { links: [...links.values()], missingImages };
};

const chunks = (items, size) => { const result = []; for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size)); return result; };

(async () => {
  const { links, missingImages } = scan();
  const prisma = new PrismaClient();
  try {
    const ids = links.map((item) => item.productId);
    const existing = ids.length ? await prisma.catalogCard.findMany({ where: { productId: { in: ids } }, select: { productId: true, categoryId: true, imageKey: true } }) : [];
    const byId = new Map(existing.map((row) => [row.productId, row]));
    const updates = links.filter((item) => byId.get(item.productId)?.categoryId === item.categoryId && byId.get(item.productId)?.imageKey !== item.key);
    const wrongGame = links.filter((item) => byId.has(item.productId) && byId.get(item.productId).categoryId !== item.categoryId).length;
    console.log(`Rutas locales con imagen: ${links.length}`);
    console.log(`Cartas encontradas en la base: ${existing.length}`);
    console.log(`Vínculos que cambiarían: ${updates.length}`);
    console.log(`Cartas sin imagen local: ${missingImages.length}`);
    console.log(`IDs con juego distinto: ${wrongGame}`);
    if (!apply) { console.log('SIMULACIÓN: no se modificó la base. Usa --apply para aplicar.'); return; }
    for (const batch of chunks(updates, chunkSize)) {
      await prisma.$transaction(batch.map((item) => prisma.catalogCard.update({ where: { productId: item.productId }, data: { imageKey: item.key, thumbKey: null } })));
      console.log(`APLICADO|${Math.min(updates.indexOf(batch[batch.length - 1]) + 1, updates.length)}|${updates.length}`);
    }
    console.log(`VINCULACIÓN TERMINADA: ${updates.length} cartas actualizadas.`);
  } finally { await prisma.$disconnect(); }
})().catch((error) => { console.error(`ERROR: ${error.message}`); process.exitCode = 1; });
