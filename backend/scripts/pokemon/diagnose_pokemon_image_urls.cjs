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
const CHECK_HTTP = !process.argv.includes('--skip-http');

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
const HTTP_CONCURRENCY = Math.max(1, Number.parseInt(getArgValue('http-concurrency') || '6', 10) || 6);
const HTTP_BATCH_DELAY_MS = Math.max(0, Number.parseInt(getArgValue('http-delay-ms') || '350', 10) || 350);

const colors = { reset: '\x1b[0m', blue: '\x1b[34m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', bold: '\x1b[1m' };
const log = {
  title: (message) => console.log(`\n${colors.bold}${colors.cyan}${message}${colors.reset}`),
  info: (message) => console.log(`${colors.blue}ℹ${colors.reset} ${message}`),
  ok: (message) => console.log(`${colors.green}✓${colors.reset} ${message}`),
  warn: (message) => console.log(`${colors.yellow}⚠${colors.reset} ${message}`),
  error: (message) => console.log(`${colors.red}✗${colors.reset} ${message}`),
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const cleanString = (value) => (value === undefined || value === null ? '' : String(value).trim());
const encodePathPart = (part) => encodeURIComponent(String(part)).replace(/%2F/gi, '%252F');

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

const getLocalWebp = (imageDir, cardFolderName) => {
  const expected = `${cardFolderName}.webp`;
  let entries = [];
  try {
    entries = fs.readdirSync(imageDir, { withFileTypes: true });
  } catch (_) {
    return { exists: false, fileName: expected, reason: 'No existe/no se puede leer carpeta de imagen local' };
  }
  const webpFiles = entries.filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.webp')).map(entry => entry.name);
  if (webpFiles.includes(expected)) return { exists: true, fileName: expected, reason: 'Coincide con carpeta' };
  if (webpFiles.length === 1) return { exists: true, fileName: webpFiles[0], reason: 'Único webp alternativo' };
  return { exists: false, fileName: expected, reason: `${webpFiles.length} archivos webp encontrados`, files: webpFiles };
};

const buildPublicUrl = ({ dbName, setFolderName, cardFolderName, fileName }) => {
  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  if (!r2PublicUrl) throw new Error('Falta R2_PUBLIC_URL en backend/.env');
  const parts = ['Carpetazo.cl', 'Pokemon', dbName, 'Images', setFolderName, cardFolderName, fileName].map(encodePathPart);
  return `${r2PublicUrl.replace(/\/$/, '')}/${parts.join('/')}`;
};

const collectLocalIndex = () => {
  const byProductId = new Map();
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
        const localImage = getLocalWebp(path.join(imageRoot, setFolderName, cardFolderName), cardFolderName);
        byProductId.set(productId, {
          productId,
          dbName,
          name: cleanString(json.name || cardFolderName),
          setFolderName,
          cardFolderName,
          localImage,
          fixedUrl: localImage.exists ? buildPublicUrl({ dbName, setFolderName, cardFolderName, fileName: localImage.fileName }) : null,
        });
      } catch (error) {
        warnings.push(`JSON inválido ${dataPath}: ${error.message}`);
      }
    }
  }
  return { byProductId, warnings };
};

const headStatus = async (url) => {
  if (!url || !CHECK_HTTP) return null;
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (response.status === 429) {
      await sleep(1200);
      const retry = await fetch(url, { method: 'HEAD' });
      return retry.status;
    }
    return response.status;
  } catch (error) {
    return `ERR: ${error.message}`;
  }
};

const isHttpOk = (status) => status === 200;
const isHttpRateLimited = (status) => status === 429;
const isHttpInconclusive = (status) => status === 429 || (typeof status === 'string' && status.startsWith('ERR:'));
const isHttpBroken = (status) => CHECK_HTTP && status !== null && !isHttpOk(status) && !isHttpInconclusive(status);

const mapConcurrentPolite = async (items, concurrency, mapper) => {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
      if (CHECK_HTTP && HTTP_BATCH_DELAY_MS > 0) await sleep(HTTP_BATCH_DELAY_MS);
    }
  }));
  return results;
};

const getFileNameFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.split('/').filter(Boolean).at(-1) || '');
  } catch (_) {
    return '';
  }
};

const getFolderFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part));
    return parts.at(-2) || '';
  } catch (_) {
    return '';
  }
};

const main = async () => {
  log.title('🔎 Diagnóstico de URLs de imágenes Pokémon');
  if (unknownDbs.length) throw new Error(`Carpetas no configuradas: ${unknownDbs.join(', ')}`);
  log.info(`DBs: ${DATABASES.join(', ')}`);
  log.info(`Prueba HTTP: ${CHECK_HTTP ? 'sí' : 'no'}`);
  if (CHECK_HTTP) log.info(`Concurrencia HTTP: ${HTTP_CONCURRENCY}; pausa por worker: ${HTTP_BATCH_DELAY_MS}ms`);

  const { byProductId, warnings } = collectLocalIndex();
  warnings.slice(0, 25).forEach(warning => log.warn(warning));
  if (warnings.length > 25) log.warn(`+${warnings.length - 25} advertencias adicionales`);

  const products = await prisma.tcgProduct.findMany({
    where: { categoryId: CATEGORY_ID, productId: { in: [...byProductId.keys()] } },
    select: { productId: true, name: true, imageUrl: true },
  });

  const report = {
    checked: products.length,
    urlDiffersFromLocal: 0,
    dbUrlBroken: 0,
    dbUrlRateLimited: 0,
    dbUrlInconclusive: 0,
    noLocalImage: 0,
    samples: [],
  };

  const analyzed = await mapConcurrentPolite(products, CHECK_HTTP ? HTTP_CONCURRENCY : 1, async (product, index) => {
    const local = byProductId.get(product.productId);
    if (!local?.fixedUrl) return { type: 'noLocalImage' };
    const differs = product.imageUrl !== local.fixedUrl;
    const currentStatus = await headStatus(product.imageUrl);
    const fixedStatus = differs ? await headStatus(local.fixedUrl) : currentStatus;
    if ((index + 1) % 500 === 0) log.info(`Revisadas: ${index + 1}/${products.length}`);
    return {
      type: 'analyzed',
      differs,
      currentBroken: isHttpBroken(currentStatus),
      currentRateLimited: CHECK_HTTP && isHttpRateLimited(currentStatus),
      currentInconclusive: CHECK_HTTP && isHttpInconclusive(currentStatus),
      sample: differs || isHttpBroken(currentStatus) || isHttpInconclusive(currentStatus)
        ? {
            productId: product.productId,
            name: product.name,
            dbName: local.dbName,
            currentStatus,
            fixedStatus,
            currentUrl: product.imageUrl,
            fixedUrl: local.fixedUrl,
          }
        : null,
    };
  });

  for (const item of analyzed) {
    if (item?.type === 'noLocalImage') {
      report.noLocalImage += 1;
      continue;
    }
    if (!item || item.type !== 'analyzed') continue;
    if (item.differs) report.urlDiffersFromLocal += 1;
    if (item.currentBroken) report.dbUrlBroken += 1;
    if (item.currentRateLimited) report.dbUrlRateLimited += 1;
    if (item.currentInconclusive) report.dbUrlInconclusive += 1;
    if (item.sample && report.samples.length < 50) report.samples.push(item.sample);
  }

  const reportPath = path.join(__dirname, `pokemon-image-url-diagnosis-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  log.title('📊 Resumen');
  log.info(`Revisé ${report.checked} cartas Pokémon comparando la base de datos con tus carpetas locales.`);
  log.warn(`Encontré ${report.urlDiffersFromLocal} cartas cuya URL de la base no coincide con el .webp local.`);
  if (CHECK_HTTP) {
    log.warn(`${report.dbUrlBroken} URLs parecen realmente caídas por internet, sin contar límites temporales.`);
    if (report.dbUrlRateLimited) log.warn(`${report.dbUrlRateLimited} pruebas HTTP recibieron 429. Eso no confirma URL mala.`);
    const other = report.dbUrlInconclusive - report.dbUrlRateLimited;
    if (other > 0) log.warn(`${other} pruebas HTTP fallaron por red/conexión. Eso tampoco confirma URL corrupta.`);
  } else {
    log.info('No probé internet porque usaste diagnóstico rápido.');
  }
  log.ok(`${report.checked - report.noLocalImage} cartas tienen imagen local clara para comparar.`);
  if (report.noLocalImage) log.warn(`${report.noLocalImage} cartas no tienen imagen local clara.`);
  log.info(`Reporte guardado: ${reportPath}`);

  if (report.samples.length) {
    log.title('🧪 Ejemplos en idioma humano');
    for (const sample of report.samples.slice(0, 10)) {
      const currentFolder = getFolderFromUrl(sample.currentUrl);
      const currentFile = getFileNameFromUrl(sample.currentUrl);
      const fixedFolder = getFolderFromUrl(sample.fixedUrl);
      const fixedFile = getFileNameFromUrl(sample.fixedUrl);
      console.log(`\n- ${sample.name} (#${sample.productId}) en ${sample.dbName}`);
      if (sample.currentUrl === sample.fixedUrl) {
        console.log(`  La URL de la base ya coincide con el archivo local: "${currentFolder}/${currentFile}".`);
      } else {
        console.log(`  Problema: la base apunta a "${currentFolder}/${currentFile}".`);
        console.log(`  Localmente encontré el archivo real como "${fixedFolder}/${fixedFile}".`);
        console.log('  Acción sugerida: usar "Reparar URLs de imágenes desde archivos locales".');
      }
      if (CHECK_HTTP) console.log(`  Estado HTTP actual: ${sample.currentStatus}. Estado URL local: ${sample.fixedStatus}.`);
    }
  }

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
