const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (_) {
  // Environment may already be loaded.
}

const prisma = new PrismaClient();
const CATEGORY_ID = 99;
const BASE_DIR = 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Mitos_y_Leyendas';
const ALL_DATABASES = ['Primer_Bloque_DB', 'Imperio_DB', 'Furia_Extendido_DB', 'Primera_Era_DB'];
const DRY_RUN = process.argv.includes('--dry-run');

const getArgValue = (name) => {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);

  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return '';
};

const selectedDbNames = new Set(
  getArgValue('db')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

const DATABASES = selectedDbNames.size
  ? ALL_DATABASES.filter((dbName) => selectedDbNames.has(dbName))
  : ALL_DATABASES;

const unknownDbs = [...selectedDbNames].filter((dbName) => !ALL_DATABASES.includes(dbName));
const DB_READ_CHUNK_SIZE = 1000;
const DB_UPDATE_CONCURRENCY = Math.max(
  1,
  Number.parseInt(getArgValue('concurrency') || '20', 10) || 20
);

const colors = {
  reset: '\x1b[0m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bold: '\x1b[1m'
};

const log = {
  title: (message) => console.log(`\n${colors.bold}${colors.cyan}${message}${colors.reset}`),
  info: (message) => console.log(`${colors.blue}ℹ${colors.reset} ${message}`),
  ok: (message) => console.log(`${colors.green}✓${colors.reset} ${message}`),
  warn: (message) => console.log(`${colors.yellow}⚠${colors.reset} ${message}`),
  error: (message) => console.log(`${colors.red}✗${colors.reset} ${message}`)
};

const encodePathPart = (part) => encodeURIComponent(String(part)).replace(/%2F/gi, '%252F');

const findDataJsonFiles = (dirPath, files = []) => {
  if (!fs.existsSync(dirPath)) return files;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) findDataJsonFiles(entryPath, files);
    else if (entry.isFile() && entry.name === 'data.json') files.push(entryPath);
  }

  return files;
};

const getOnlyOrExpectedWebp = (imageDir, cardFolderName) => {
  const expected = `${cardFolderName}.webp`;
  if (!fs.existsSync(imageDir)) return { fileName: expected, exists: false, reason: 'imageDir missing' };

  const webpFiles = fs.readdirSync(imageDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.webp'))
    .map((entry) => entry.name);

  if (webpFiles.includes(expected)) return { fileName: expected, exists: true, reason: 'expected' };
  if (webpFiles.length === 1) return { fileName: webpFiles[0], exists: true, reason: 'single alternative' };

  return { fileName: expected, exists: false, reason: `${webpFiles.length} webp files` };
};

const buildPublicUrl = ({ dbName, relativeDataParts, cardFolderName, fileName }) => {
  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  if (!r2PublicUrl) throw new Error('Falta R2_PUBLIC_URL en el entorno.');

  const encodedParts = [
    'Carpetazo.cl',
    'Mitos_y_Leyendas',
    dbName,
    dbName.replace('_DB', '_Images'),
    ...relativeDataParts,
    cardFolderName,
    fileName
  ].map(encodePathPart);

  return `${r2PublicUrl.replace(/\/$/, '')}/${encodedParts.join('/')}`;
};

const collectRepairs = () => {
  const repairs = [];
  const warnings = [];

  for (const dbName of DATABASES) {
    const dataRoot = path.join(BASE_DIR, dbName, dbName.replace('_DB', '_Data'));
    const imageRoot = path.join(BASE_DIR, dbName, dbName.replace('_DB', '_Images'));

    if (!fs.existsSync(dataRoot)) {
      warnings.push(`No existe carpeta de datos: ${dataRoot}`);
      continue;
    }

    for (const dataPath of findDataJsonFiles(dataRoot)) {
      try {
        const json = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const productId = String(json.id);
        if ((!productId)) {
          warnings.push(`ID inválido en ${dataPath}`);
          continue;
        }

        const cardFolderName = path.basename(path.dirname(dataPath));
        const relativeDir = path.relative(dataRoot, path.dirname(path.dirname(dataPath)));
        const relativeDataParts = relativeDir && relativeDir !== '.'
          ? relativeDir.split(path.sep).filter(Boolean)
          : [];
        const imageDir = path.join(imageRoot, ...relativeDataParts, cardFolderName);
        const image = getOnlyOrExpectedWebp(imageDir, cardFolderName);

        if (!image.exists) {
          warnings.push(`${dbName}/${relativeDataParts.join('/')}/${cardFolderName}: ${image.reason}`);
          continue;
        }

        repairs.push({
          productId,
          dbName,
          name: json.name || cardFolderName,
          imageUrl: buildPublicUrl({ dbName, relativeDataParts, cardFolderName, fileName: image.fileName }),
          reason: image.reason
        });
      } catch (error) {
        warnings.push(`JSON inválido ${dataPath}: ${error.message}`);
      }
    }
  }

  return { repairs, warnings };
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const runWithConcurrency = async (items, concurrency, worker) => {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  });

  await Promise.all(workers);
};

const main = async () => {
  log.title('🖼️ Reparar URLs de imágenes MYL desde archivos locales');
  if (unknownDbs.length) throw new Error(`Carpetas no configuradas: ${unknownDbs.join(', ')}`);
  log.info(`DBs: ${DATABASES.join(', ')}`);
  log.info(`Modo: ${DRY_RUN ? 'dry-run, no escribe en DB' : 'actualiza DB'}`);
  log.info(`Concurrencia de actualización: ${DB_UPDATE_CONCURRENCY}`);

  const { repairs, warnings } = collectRepairs();
  warnings.slice(0, 25).forEach((warning) => log.warn(warning));
  if (warnings.length > 25) log.warn(`+${warnings.length - 25} advertencias adicionales`);

  log.info(`Cartas con imagen local resuelta: ${repairs.length}`);

  let changed = 0;
  const samples = [];
  const repairsByProductId = new Map();

  for (const repair of repairs) {
    repairsByProductId.set(repair.productId, repair);
  }

  log.info('Leyendo URLs actuales desde la base de datos en bloques...');
  const currentProducts = new Map();
  const productIds = [...repairsByProductId.keys()];

  for (const chunk of chunkArray(productIds, DB_READ_CHUNK_SIZE)) {
    const rows = await prisma.tcgProduct.findMany({
      where: { categoryId: CATEGORY_ID, productId: { in: chunk } },
      select: { productId: true, name: true, imageUrl: true }
    });

    for (const row of rows) {
      currentProducts.set(row.productId, row);
    }
  }

  const pendingUpdates = [];

  for (const repair of repairs) {
    const current = currentProducts.get(repair.productId);

    if (!current || current.imageUrl === repair.imageUrl) continue;

    if (samples.length < 10) {
      samples.push({ productId: repair.productId, name: repair.name, from: current.imageUrl, to: repair.imageUrl });
    }

    pendingUpdates.push(repair);
  }

  log.info(`URLs que necesitan corrección: ${pendingUpdates.length}`);

  if (!DRY_RUN && pendingUpdates.length) {
    await runWithConcurrency(pendingUpdates, DB_UPDATE_CONCURRENCY, async (repair) => {
      await prisma.tcgProduct.update({
        where: { productId: repair.productId },
        data: { imageUrl: repair.imageUrl }
      });

      changed += 1;
      if (changed % 500 === 0 || changed === pendingUpdates.length) {
        log.ok(`URLs corregidas: ${changed}/${pendingUpdates.length}`);
      }
    });
  } else {
    changed = pendingUpdates.length;
  }

  log.title('📊 Resumen');
  log.ok(`Cartas revisadas: ${repairs.length}`);
  log.ok(`URLs ${DRY_RUN ? 'a corregir' : 'corregidas'}: ${changed}`);
  if (samples.length) console.log(JSON.stringify(samples, null, 2));
};

main()
  .catch((error) => {
    log.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

