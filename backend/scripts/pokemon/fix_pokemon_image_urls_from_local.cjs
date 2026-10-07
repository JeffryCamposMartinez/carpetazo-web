const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
} catch (_) {}

const prisma = new PrismaClient();
const CATEGORY_ID = 1;
const BASE_DIR = (process.env.CARPETAZO_DOWNLOADS ? process.env.CARPETAZO_DOWNLOADS + '\\Pokemon' : 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Pokemon');
const ALL_DATABASES = ['Pokemon_DB_EN', 'Pokemon_DB_ES'];
const DRY_RUN = process.argv.includes('--dry-run');

const getArgValue = (name) => {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return '';
};

const requestedDbs = new Set(getArgValue('db').split(',').map(value => value.trim()).filter(Boolean));
const DATABASES = (requestedDbs.size ? ALL_DATABASES.filter(db => requestedDbs.has(db)) : ALL_DATABASES)
  .sort((a, b) => a.localeCompare(b));
const unknownDbs = [...requestedDbs].filter(db => !ALL_DATABASES.includes(db));
const UPDATE_CONCURRENCY = Math.max(1, Number.parseInt(getArgValue('concurrency') || '20', 10) || 20);

const colors = { reset: '\x1b[0m', blue: '\x1b[34m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', bold: '\x1b[1m' };
const log = {
  title: (message) => console.log(`\n${colors.bold}${colors.cyan}${message}${colors.reset}`),
  info: (message) => console.log(`${colors.blue}ℹ${colors.reset} ${message}`),
  ok: (message) => console.log(`${colors.green}✓${colors.reset} ${message}`),
  warn: (message) => console.log(`${colors.yellow}⚠${colors.reset} ${message}`),
  error: (message) => console.log(`${colors.red}✗${colors.reset} ${message}`),
};

const encodePathPart = (part) => encodeURIComponent(String(part)).replace(/%2F/gi, '%252F');
const cleanString = (value) => (value === undefined || value === null ? '' : String(value).trim());

const walkForDataJson = (dirPath, files = [], warnings = []) => {
  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (error) {
    warnings.push(`No pude leer ${dirPath}: ${error.message}`);
    return files;
  }
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) walkForDataJson(entryPath, files, warnings);
    else if (entry.isFile() && entry.name === 'data.json') files.push(entryPath);
  }
  return files;
};

const getOnlyOrExpectedWebp = (imageDir, cardFolderName) => {
  const expected = `${cardFolderName}.webp`;
  let entries = [];
  try {
    entries = fs.readdirSync(imageDir, { withFileTypes: true });
  } catch (_) {
    return { exists: false, fileName: expected, reason: 'carpeta de imagen no existe/no se puede leer' };
  }
  const webpFiles = entries.filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.webp')).map(entry => entry.name);
  if (webpFiles.includes(expected)) return { exists: true, fileName: expected, reason: 'archivo esperado' };
  if (webpFiles.length === 1) return { exists: true, fileName: webpFiles[0], reason: 'único webp alternativo' };
  return { exists: false, fileName: expected, reason: `${webpFiles.length} archivos webp` };
};

const buildPublicUrl = ({ dbName, setFolderName, cardFolderName, fileName }) => {
  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  if (!r2PublicUrl) throw new Error('Falta R2_PUBLIC_URL en backend/.env');
  const parts = ['Carpetazo.cl', 'Pokemon', dbName, 'Images', setFolderName, cardFolderName, fileName].map(encodePathPart);
  return `${r2PublicUrl.replace(/\/$/, '')}/${parts.join('/')}`;
};

const collectRepairs = () => {
  const repairs = [];
  const warnings = [];
  for (const dbName of DATABASES) {
    const dataRoot = path.join(BASE_DIR, dbName, 'Data');
    const imageRoot = path.join(BASE_DIR, dbName, 'Images');
    if (!fs.existsSync(dataRoot)) {
      warnings.push(`No existe Data: ${dataRoot}`);
      continue;
    }
    for (const dataPath of walkForDataJson(dataRoot, [], warnings)) {
      try {
        const json = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const productId = cleanString(json.id);
        if (!productId) continue;
        const cardFolderName = path.basename(path.dirname(dataPath));
        const setFolderName = path.basename(path.dirname(path.dirname(dataPath)));
        const image = getOnlyOrExpectedWebp(path.join(imageRoot, setFolderName, cardFolderName), cardFolderName);
        if (!image.exists) {
          warnings.push(`${dbName}/${setFolderName}/${cardFolderName}: ${image.reason}`);
          continue;
        }
        repairs.push({
          productId,
          dbName,
          name: cleanString(json.name || cardFolderName),
          imageUrl: buildPublicUrl({ dbName, setFolderName, cardFolderName, fileName: image.fileName }),
        });
      } catch (error) {
        warnings.push(`JSON inválido ${dataPath}: ${error.message}`);
      }
    }
  }
  const byId = new Map();
  for (const repair of repairs) byId.set(repair.productId, repair);
  return { repairs: [...byId.values()], warnings };
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
};

const runWithConcurrency = async (items, concurrency, worker) => {
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex++];
      await worker(item);
    }
  }));
};

const main = async () => {
  log.title('🟡 Reparar URLs de imágenes Pokémon desde archivos locales');
  if (unknownDbs.length) throw new Error(`Carpetas no configuradas: ${unknownDbs.join(', ')}`);
  log.info(`DBs: ${DATABASES.join(', ')}`);
  log.info(`Modo: ${DRY_RUN ? 'dry-run, no escribe en DB' : 'actualiza DB'}`);

  const { repairs, warnings } = collectRepairs();
  warnings.slice(0, 30).forEach(warning => log.warn(warning));
  if (warnings.length > 30) log.warn(`+${warnings.length - 30} advertencias adicionales`);
  log.info(`Cartas con imagen local resuelta: ${repairs.length}`);

  const currentProducts = new Map();
  const ids = repairs.map(repair => repair.productId);
  for (const chunk of chunkArray(ids, 1000)) {
    const rows = await prisma.tcgProduct.findMany({
      where: { categoryId: CATEGORY_ID, productId: { in: chunk } },
      select: { productId: true, imageUrl: true, name: true },
    });
    for (const row of rows) currentProducts.set(row.productId, row);
  }

  const pending = repairs.filter(repair => currentProducts.get(repair.productId)?.imageUrl !== repair.imageUrl);
  log.info(`URLs que necesitan corrección: ${pending.length}`);

  let changed = 0;
  if (!DRY_RUN) {
    await runWithConcurrency(pending, UPDATE_CONCURRENCY, async (repair) => {
      await prisma.tcgProduct.update({
        where: { productId: repair.productId },
        data: { imageUrl: repair.imageUrl },
      });
      changed += 1;
      if (changed % 500 === 0 || changed === pending.length) log.ok(`URLs corregidas: ${changed}/${pending.length}`);
    });
  } else {
    changed = pending.length;
  }

  log.title('📊 Resumen');
  log.ok(`Cartas revisadas: ${repairs.length}`);
  log.ok(`URLs ${DRY_RUN ? 'a corregir' : 'corregidas'}: ${changed}`);
  log.ok('Proceso terminado.');
};

main()
  .catch(error => {
    log.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
