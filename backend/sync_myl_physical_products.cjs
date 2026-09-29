const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (_) {
  // Environment may already be loaded.
}

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const PRODUCT_FROM_DATA_FOLDER = process.argv.includes('--product-from-data-folder');
const CATEGORY_ID = 99;
const BASE_DIR = 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Mitos_y_Leyendas';

const DBS = [
  { dbName: 'Furia_Extendido_DB', dataDir: 'Furia_Extendido_Data', blockName: 'Furia Extendido' },
  { dbName: 'Primer_Bloque_DB', dataDir: 'Primer_Bloque_Data', blockName: 'Primer Bloque' },
  { dbName: 'Primera_Era_DB', dataDir: 'Primera_Era_Data', blockName: 'Primera Era' },
  { dbName: 'Imperio_DB', dataDir: 'Imperio_Data', blockName: 'Imperio' },
];

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

const SELECTED_DBS = selectedDbNames.size
  ? DBS.filter((db) => selectedDbNames.has(db.dbName))
  : DBS;

const unknownDbs = [...selectedDbNames].filter((dbName) => !DBS.some((db) => db.dbName === dbName));

const log = {
  title: (message) => console.log(`\n\x1b[1m\x1b[36m${message}\x1b[0m`),
  info: (message) => console.log(`\x1b[34mℹ\x1b[0m ${message}`),
  ok: (message) => console.log(`\x1b[32m✓\x1b[0m ${message}`),
  warn: (message) => console.log(`\x1b[33m⚠\x1b[0m ${message}`),
  error: (message) => console.log(`\x1b[31m✗\x1b[0m ${message}`),
};

const clean = (value) => String(value || '').trim();

const walkDataJson = (dirPath, files = []) => {
  if (!fs.existsSync(dirPath)) return files;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) walkDataJson(entryPath, files);
    else if (entry.isFile() && entry.name === 'data.json') files.push(entryPath);
  }
  return files;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const getProductNameFromDataFolder = (dataRoot, filePath) => {
  const relativeParts = path.relative(dataRoot, filePath).split(path.sep).filter(Boolean);
  return clean(relativeParts[0]);
};

const collectRows = () => {
  const rows = [];
  const warnings = [];

  for (const db of SELECTED_DBS) {
    const dataRoot = path.join(BASE_DIR, db.dbName, db.dataDir);
    if (!fs.existsSync(dataRoot)) {
      warnings.push(`No existe ${dataRoot}`);
      continue;
    }

    for (const filePath of walkDataJson(dataRoot)) {
      try {
        const json = readJson(filePath);
        const productId = String(json.id);
        const productNameFromFolder = getProductNameFromDataFolder(dataRoot, filePath);
        const productName = PRODUCT_FROM_DATA_FOLDER
          ? productNameFromFolder || clean(json.productName) || 'Generales'
          : clean(json.productName) || 'Generales';
        const editionName = clean(json.edition?.name);

        if ((!productId)) {
          warnings.push(`ID inválido en ${filePath}`);
          continue;
        }

        rows.push({
          productId,
          cardName: clean(json.name),
          productName,
          editionName,
          blockName: db.blockName,
          dbName: db.dbName,
        });
      } catch (error) {
        warnings.push(`JSON inválido en ${filePath}: ${error.message}`);
      }
    }
  }

  return { rows, warnings };
};

const main = async () => {
  log.title('🔁 Sincronizar Producto y Edición MYL desde data.json');
  log.info(`Modo: ${DRY_RUN ? 'dry-run, no escribe en DB' : 'actualiza DB'}`);
  log.info(`Producto desde carpeta *_Data: ${PRODUCT_FROM_DATA_FOLDER ? 'sí' : 'no'}`);
  if (unknownDbs.length) throw new Error(`Carpetas no configuradas: ${unknownDbs.join(', ')}`);
  log.info(`Carpetas seleccionadas: ${SELECTED_DBS.map((db) => db.dbName).join(', ')}`);

  const { rows, warnings } = collectRows();
  warnings.slice(0, 20).forEach((warning) => log.warn(warning));
  if (warnings.length > 20) log.warn(`+${warnings.length - 20} advertencias adicionales`);

  if (rows.length === 0) {
    log.warn('No se encontraron data.json para procesar.');
    return;
  }

  const blocks = await prisma.tcgBlock.findMany({
    where: { categoryId: CATEGORY_ID },
    select: { id: true, name: true },
  });
  const blockByName = new Map(blocks.map((block) => [block.name, block]));

  const missingBlocks = [...new Set(rows.map((row) => row.blockName))].filter((name) => !blockByName.has(name));
  if (missingBlocks.length) {
    throw new Error(`Faltan bloques en DB: ${missingBlocks.join(', ')}`);
  }

  const uniqueProducts = new Map();
  for (const row of rows) {
    const block = blockByName.get(row.blockName);
    const key = `${block.id}::${row.productName}`;
    if (!uniqueProducts.has(key)) {
      uniqueProducts.set(key, { name: row.productName, blockId: block.id, blockName: row.blockName });
    }
  }

  log.info(`Cartas leídas: ${rows.length}`);
  log.info(`Productos físicos únicos por bloque: ${uniqueProducts.size}`);

  const physicalByKey = new Map();
  const existingPhysical = await prisma.tcgPhysicalProduct.findMany({
    select: { id: true, name: true, blockId: true },
  });
  for (const product of existingPhysical) {
    physicalByKey.set(`${product.blockId}::${product.name}`, product);
  }

  let createdProducts = 0;
  for (const product of uniqueProducts.values()) {
    const key = `${product.blockId}::${product.name}`;
    if (physicalByKey.has(key)) continue;

    if (DRY_RUN) {
      createdProducts += 1;
      physicalByKey.set(key, { id: `dry-${createdProducts}`, name: product.name, blockId: product.blockId });
      continue;
    }

    const created = await prisma.tcgPhysicalProduct.create({
      data: {
        name: product.name,
        blockId: product.blockId,
      },
      select: { id: true, name: true, blockId: true },
    });
    createdProducts += 1;
    physicalByKey.set(key, created);
  }

  let updatedProducts = 0;
  let missingProducts = 0;
  const samples = [];
  const productIdsByPhysicalId = new Map();

  for (const row of rows) {
    const block = blockByName.get(row.blockName);
    const physical = physicalByKey.get(`${block.id}::${row.productName}`);
    if (!physical) {
      missingProducts += 1;
      continue;
    }

    if (DRY_RUN) {
      if (samples.length < 8) samples.push({ card: row.cardName, block: row.blockName, product: row.productName, physicalProductId: physical.id });
      updatedProducts += 1;
      continue;
    }

    if (!productIdsByPhysicalId.has(physical.id)) productIdsByPhysicalId.set(physical.id, []);
    productIdsByPhysicalId.get(physical.id).push(row.productId);
  }

  if (!DRY_RUN) {
    const batches = [];
    for (const [physicalProductId, productIds] of productIdsByPhysicalId.entries()) {
      for (let i = 0; i < productIds.length; i += 1000) {
        batches.push({ physicalProductId, productIds: productIds.slice(i, i + 1000) });
      }
    }

    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i];
      const result = await prisma.tcgProduct.updateMany({
        where: {
          categoryId: CATEGORY_ID,
          productId: { in: batch.productIds },
        },
        data: {
          physicalProductId: batch.physicalProductId,
        },
      });
      updatedProducts += result.count;

      if ((i + 1) % 10 === 0 || i + 1 === batches.length) {
        log.ok(`Lotes actualizados: ${i + 1}/${batches.length} · cartas: ${updatedProducts}/${rows.length}`);
      }
    }
  }

  log.title('📊 Resumen');
  log.ok(`Productos físicos ${DRY_RUN ? 'a crear' : 'creados'}: ${createdProducts}`);
  log.ok(`Cartas ${DRY_RUN ? 'a asociar' : 'asociadas'}: ${updatedProducts}`);
  if (missingProducts) log.warn(`Cartas sin producto físico resuelto: ${missingProducts}`);
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

