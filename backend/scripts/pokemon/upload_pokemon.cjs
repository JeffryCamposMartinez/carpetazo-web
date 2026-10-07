const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
} catch (_) {}

const prisma = new PrismaClient();
const CATEGORY_ID = 1;
const CATEGORY_NAME = 'Pokemon';
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
  .sort((a, b) => a.localeCompare(b)); // EN before ES, so Spanish overwrites shared TCGdex ids when both are selected.
const unknownDbs = [...requestedDbs].filter(db => !ALL_DATABASES.includes(db));

const colors = {
  reset: '\x1b[0m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
};

const log = {
  title: (message) => console.log(`\n${colors.bold}${colors.cyan}${message}${colors.reset}`),
  info: (message) => console.log(`${colors.blue}ℹ${colors.reset} ${message}`),
  ok: (message) => console.log(`${colors.green}✓${colors.reset} ${message}`),
  warn: (message) => console.log(`${colors.yellow}⚠${colors.reset} ${message}`),
  error: (message) => console.log(`${colors.red}✗${colors.reset} ${message}`),
};

const encodePathPart = (part) => encodeURIComponent(String(part)).replace(/%2F/gi, '%252F');
const cleanString = (value) => (value === undefined || value === null ? '' : String(value).trim());
const cleanName = (value) => cleanString(value)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9 ]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

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
    if (entry.isDirectory()) {
      walkForDataJson(entryPath, files, warnings);
    } else if (entry.isFile() && entry.name === 'data.json') {
      files.push(entryPath);
    }
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

  const webpFiles = entries
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.webp'))
    .map(entry => entry.name);

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

const getNextGroupId = async () => {
  const lastGroup = await prisma.tcgGroup.findFirst({ orderBy: { groupId: 'desc' }, select: { groupId: true } });
  return (lastGroup?.groupId || 0) + 1;
};

const groupCache = new Map();
let nextGroupId = null;

const getOrCreateGroup = async (setName, setId) => {
  const normalizedName = cleanString(setName || setId || 'Sin edición');
  if (groupCache.has(normalizedName)) return groupCache.get(normalizedName);

  let group = await prisma.tcgGroup.findFirst({
    where: { categoryId: CATEGORY_ID, name: normalizedName },
    select: { groupId: true, name: true },
  });

  if (!group) {
    if (nextGroupId === null) nextGroupId = await getNextGroupId();
    const groupId = nextGroupId++;
    if (!DRY_RUN) {
      group = await prisma.tcgGroup.create({
        data: {
          groupId,
          categoryId: CATEGORY_ID,
          name: normalizedName,
          publishedOn: new Date(),
          modifiedOn: new Date(),
        },
        select: { groupId: true, name: true },
      });
    } else {
      group = { groupId, name: normalizedName };
    }
    log.ok(`Grupo creado: ${normalizedName} (#${group.groupId})`);
  }

  groupCache.set(normalizedName, group);
  return group;
};

const ensureCategory = async () => {
  const category = await prisma.tcgCategory.findUnique({ where: { categoryId: CATEGORY_ID } });
  if (category) return;
  if (!DRY_RUN) {
    await prisma.tcgCategory.create({
      data: { categoryId: CATEGORY_ID, name: CATEGORY_NAME, modifiedOn: new Date() },
    });
  }
  log.ok(`Categoría creada: ${CATEGORY_NAME} (#${CATEGORY_ID})`);
};

const collectCards = () => {
  const cards = [];
  const warnings = [];

  for (const dbName of DATABASES) {
    const dataRoot = path.join(BASE_DIR, dbName, 'Data');
    const imageRoot = path.join(BASE_DIR, dbName, 'Images');
    if (!fs.existsSync(dataRoot)) {
      warnings.push(`No existe Data: ${dataRoot}`);
      continue;
    }

    const dataFiles = walkForDataJson(dataRoot, [], warnings);
    log.info(`${dbName}: ${dataFiles.length} data.json encontrados`);

    for (const dataPath of dataFiles) {
      try {
        const json = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const productId = cleanString(json.id);
        if (!productId) {
          warnings.push(`Sin id: ${dataPath}`);
          continue;
        }

        const cardFolderName = path.basename(path.dirname(dataPath));
        const setFolderName = path.basename(path.dirname(path.dirname(dataPath)));
        const setName = cleanString(json.set?.name || setFolderName);
        const localImage = getOnlyOrExpectedWebp(path.join(imageRoot, setFolderName, cardFolderName), cardFolderName);

        cards.push({
          dbName,
          productId,
          groupName: setName,
          setId: cleanString(json.set?.id),
          name: cleanString(json.name || cardFolderName),
          cleanName: cleanName(json.name || cardFolderName),
          imageUrl: localImage.exists
            ? buildPublicUrl({ dbName, setFolderName, cardFolderName, fileName: localImage.fileName })
            : cleanString(json.image),
          extData: {
            ...json,
            _db: dbName,
            _dataFolderProduct: setFolderName,
            _localCardFolder: cardFolderName,
            _localImageFile: localImage.exists ? localImage.fileName : '',
          },
          localImage,
        });

        if (!localImage.exists) warnings.push(`${dbName}/${setFolderName}/${cardFolderName}: ${localImage.reason}`);
      } catch (error) {
        warnings.push(`JSON inválido ${dataPath}: ${error.message}`);
      }
    }
  }

  // Shared EN/ES ids are intentionally de-duplicated by processing order.
  const byId = new Map();
  for (const card of cards) byId.set(card.productId, card);
  return { cards: [...byId.values()], warnings };
};

const main = async () => {
  log.title('🟡 Subir / actualizar Pokémon desde data.json');
  if (unknownDbs.length) throw new Error(`Carpetas no configuradas: ${unknownDbs.join(', ')}`);
  log.info(`DBs: ${DATABASES.join(', ')}`);
  log.info(`Modo: ${DRY_RUN ? 'dry-run, no escribe en DB' : 'actualiza DB'}`);

  await ensureCategory();
  const { cards, warnings } = collectCards();
  warnings.slice(0, 30).forEach(warning => log.warn(warning));
  if (warnings.length > 30) log.warn(`+${warnings.length - 30} advertencias adicionales`);
  log.info(`Cartas únicas a procesar: ${cards.length}`);

  let processed = 0;
  let changed = 0;
  for (const card of cards) {
    const group = await getOrCreateGroup(card.groupName, card.setId);
    processed += 1;
    if (!DRY_RUN) {
      await prisma.tcgProduct.upsert({
        where: { productId: card.productId },
        create: {
          productId: card.productId,
          groupId: group.groupId,
          categoryId: CATEGORY_ID,
          name: card.name,
          cleanName: card.cleanName,
          imageUrl: card.imageUrl,
          extData: card.extData,
        },
        update: {
          groupId: group.groupId,
          categoryId: CATEGORY_ID,
          name: card.name,
          cleanName: card.cleanName,
          imageUrl: card.imageUrl,
          extData: card.extData,
        },
      });
    }
    changed += 1;
    if (processed % 500 === 0 || processed === cards.length) log.ok(`Procesadas: ${processed}/${cards.length}`);
  }

  log.title('📊 Resumen');
  log.ok(`Cartas revisadas: ${processed}`);
  log.ok(`Cartas ${DRY_RUN ? 'simuladas' : 'actualizadas'}: ${changed}`);
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
