const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (_) {
  // dotenv is optional when the environment is already loaded by the runner.
}

const prisma = new PrismaClient();

const CATEGORY_ID = 99;
const BASE_DIR = (process.env.CARPETAZO_DOWNLOADS ? process.env.CARPETAZO_DOWNLOADS + '\\Mitos_y_Leyendas' : 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Mitos_y_Leyendas');
const DATABASES = ['Imperio_DB', 'Furia_Extendido_DB', 'Primera_Era_DB'];
const DRY_RUN = process.argv.includes('--dry-run');

const colors = {
  reset: '\x1b[0m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m'
};

const log = {
  title: (message) => console.log(`\n${colors.bold}${colors.cyan}${message}${colors.reset}`),
  info: (message) => console.log(`${colors.blue}ℹ${colors.reset} ${message}`),
  ok: (message) => console.log(`${colors.green}✓${colors.reset} ${message}`),
  warn: (message) => console.log(`${colors.yellow}⚠${colors.reset} ${message}`),
  error: (message) => console.log(`${colors.red}✗${colors.reset} ${message}`)
};

const isPresent = (value) => {
  if (value === null || value === undefined) return false;
  return String(value).trim() !== '';
};

const cleanString = (value) => (isPresent(value) ? String(value).trim() : '');

const encodePathPart = (part) => encodeURIComponent(String(part)).replace(/%2F/gi, '%252F');

const buildR2ImageUrl = ({ dbName, relativeDataParts, cardFolderName }) => {
  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  if (!r2PublicUrl) {
    throw new Error('Falta R2_PUBLIC_URL en el entorno. No se puede construir imageUrl.');
  }

  const encodedParts = [
    'Carpetazo.cl',
    'Mitos_y_Leyendas',
    dbName,
    dbName.replace('_DB', '_Images'),
    ...relativeDataParts,
    cardFolderName,
    `${cardFolderName}.webp`
  ].map(encodePathPart);

  return `${r2PublicUrl.replace(/\/$/, '')}/${encodedParts.join('/')}`;
};

const buildExtData = (json) => {
  const entries = [
    { name: 'Type', value: json.type },
    { name: 'Cost', value: String(json.cost || '') },
    { name: 'Fuerza', value: String(json.attack || '') },
    { name: 'Race', value: Array.isArray(json.race) ? json.race[0] : json.race },
    { name: 'Edition', value: json.edition?.name },
    { name: 'Frequency', value: json.frequency },
    { name: 'Number', value: json.collectorCode },
    { name: 'Format', value: json.format },
    { name: 'Slug', value: json.slug },
    { name: 'Effect', value: json.effect || json.habilidad || '' }
  ];

  return entries
    .map((entry) => ({ name: entry.name, value: cleanString(entry.value) }))
    .filter((entry) => isPresent(entry.value));
};

const readJsonFile = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
};

const listDirectories = (dirPath) => {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
};

const findDataJsonFiles = (dirPath) => {
  if (!fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...findDataJsonFiles(entryPath));
    } else if (entry.isFile() && entry.name === 'data.json') {
      files.push(entryPath);
    }
  }

  return files;
};

let nextGroupId = null;
const getNextGroupId = async () => {
  if (nextGroupId !== null) {
    nextGroupId += 1;
    return nextGroupId;
  }

  const lastGroup = await prisma.tcgGroup.findFirst({
    orderBy: { groupId: 'desc' },
    select: { groupId: true }
  });

  nextGroupId = (lastGroup?.groupId || 0) + 1;
  return nextGroupId;
};

const groupCache = new Map();
const getOrCreateGroup = async (editionName) => {
  const normalizedEditionName = cleanString(editionName);
  if (!normalizedEditionName) {
    throw new Error('Nombre de edición vacío.');
  }

  if (groupCache.has(normalizedEditionName)) {
    return groupCache.get(normalizedEditionName);
  }

  let group = await prisma.tcgGroup.findFirst({
    where: {
      categoryId: CATEGORY_ID,
      name: normalizedEditionName
    }
  });

  if (!group) {
    const now = new Date();
    const groupId = await getNextGroupId();

    if (DRY_RUN) {
      group = {
        groupId,
        categoryId: CATEGORY_ID,
        name: normalizedEditionName,
        publishedOn: now,
        modifiedOn: now
      };
      log.info(`[dry-run] Crearía edición "${normalizedEditionName}" con groupId ${groupId}`);
    } else {
      group = await prisma.tcgGroup.create({
        data: {
          groupId,
          categoryId: CATEGORY_ID,
          name: normalizedEditionName,
          publishedOn: now,
          modifiedOn: now
        }
      });
      log.ok(`Edición creada: ${normalizedEditionName} (#${group.groupId})`);
    }
  }

  groupCache.set(normalizedEditionName, group);
  return group;
};

const collectCards = () => {
  const cards = [];
  const warnings = [];

  for (const dbName of DATABASES) {
    const dataRoot = path.join(BASE_DIR, dbName, dbName.replace('_DB', '_Data'));

    if (!fs.existsSync(dataRoot)) {
      warnings.push(`No existe carpeta de datos: ${dataRoot}`);
      continue;
    }

    for (const dataPath of findDataJsonFiles(dataRoot)) {
      const cardFolderName = path.basename(path.dirname(dataPath));
      const relativeDir = path.relative(dataRoot, path.dirname(path.dirname(dataPath)));
      const relativeDataParts = relativeDir && relativeDir !== '.'
        ? relativeDir.split(path.sep).filter(Boolean)
        : [];

      try {
        const json = readJsonFile(dataPath);
        cards.push({
          dbName,
          editionName: json.edition?.name || relativeDataParts.at(-1) || cardFolderName,
          relativeDataParts,
          cardFolderName,
          dataPath,
          json
        });
      } catch (error) {
        warnings.push(`JSON inválido: ${dataPath} (${error.message})`);
      }
    }
  }

  return { cards, warnings };
};

const upsertCard = async ({ dbName, editionName, relativeDataParts, cardFolderName, json }) => {
  const productId = Number.parseInt(json.id, 10);

  if (!Number.isFinite(productId)) {
    throw new Error(`ID de producto inválido: ${json.id || '(vacío)'}`);
  }

  const cardName = cleanString(json.name);
  if (!cardName) {
    throw new Error(`Carta sin nombre para productId ${productId}`);
  }

  const group = await getOrCreateGroup(editionName);
  const imageUrl = buildR2ImageUrl({ dbName, relativeDataParts, cardFolderName });
  const extData = buildExtData(json);

  const payload = {
    productId,
    groupId: group.groupId,
    categoryId: CATEGORY_ID,
    name: cardName,
    cleanName: cardName.toLowerCase(),
    imageUrl,
    extData
  };

  if (DRY_RUN) {
    return { action: 'dry-run', productId, name: cardName };
  }

  await prisma.tcgProduct.upsert({
    where: { productId },
    create: payload,
    update: {
      groupId: payload.groupId,
      categoryId: payload.categoryId,
      name: payload.name,
      cleanName: payload.cleanName,
      imageUrl: payload.imageUrl,
      extData: payload.extData
    }
  });

  return { action: 'upserted', productId, name: cardName };
};

const main = async () => {
  log.title('🚀 Carga restante de Mitos y Leyendas');
  log.info(`Base local: ${BASE_DIR}`);
  log.info(`DBs: ${DATABASES.join(', ')}`);
  log.info(`Modo: ${DRY_RUN ? 'dry-run, no escribe en DB' : 'upsert real en DB'}`);

  const category = await prisma.tcgCategory.findUnique({
    where: { categoryId: CATEGORY_ID },
    select: { categoryId: true, name: true }
  });

  if (!category) {
    throw new Error(`No existe TcgCategory categoryId=${CATEGORY_ID}. Crea la categoría antes de ejecutar este script.`);
  }

  log.ok(`Categoría encontrada: ${category.name || 'Mitos y Leyendas'} (#${category.categoryId})`);

  const { cards, warnings } = collectCards();
  warnings.forEach((warning) => log.warn(warning));

  if (cards.length === 0) {
    log.warn('No se encontraron cartas para procesar.');
    return;
  }

  log.info(`Cartas encontradas: ${cards.length}`);

  const stats = {
    processed: 0,
    failed: 0
  };

  const byDb = new Map();

  for (const card of cards) {
    try {
      const result = await upsertCard(card);
      stats.processed += 1;
      byDb.set(card.dbName, (byDb.get(card.dbName) || 0) + 1);

      if (stats.processed % 25 === 0 || stats.processed === cards.length) {
        log.info(`Progreso: ${stats.processed}/${cards.length} cartas procesadas...`);
      }

      if (DRY_RUN && stats.processed <= 5) {
        log.info(`[dry-run] ${result.productId} · ${result.name}`);
      }
    } catch (error) {
      stats.failed += 1;
      log.error(`${card.dbName}/${card.editionName}/${card.cardFolderName}: ${error.message}`);
    }
  }

  log.title('📊 Resumen');
  for (const [dbName, count] of byDb.entries()) {
    log.ok(`${dbName}: ${count} cartas`);
  }
  log.ok(`Procesadas: ${stats.processed}`);
  if (stats.failed > 0) log.warn(`Fallidas: ${stats.failed}`);
  else log.ok('Sin errores de carga.');
};

main()
  .catch((error) => {
    log.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
