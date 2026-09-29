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
const CHECK_HTTP = !process.argv.includes('--skip-http');

const getArgValue = (name) => {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);

  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return '';
};

const HTTP_CONCURRENCY = Math.max(1, Number.parseInt(getArgValue('http-concurrency') || '24', 10) || 24);

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

const getLocalWebp = (imageDir, cardFolderName) => {
  const expected = `${cardFolderName}.webp`;
  if (!fs.existsSync(imageDir)) {
    return { exists: false, fileName: expected, reason: 'No existe carpeta de imagen local' };
  }

  const webpFiles = fs.readdirSync(imageDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.webp'))
    .map((entry) => entry.name);

  if (webpFiles.includes(expected)) return { exists: true, fileName: expected, reason: 'Coincide con carpeta' };
  if (webpFiles.length === 1) return { exists: true, fileName: webpFiles[0], reason: 'Único webp alternativo' };

  return { exists: false, fileName: expected, reason: `${webpFiles.length} archivos webp encontrados`, files: webpFiles };
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

const collectLocalIndex = () => {
  const byProductId = new Map();
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
        if ((!productId)) continue;

        const cardFolderName = path.basename(path.dirname(dataPath));
        const relativeDir = path.relative(dataRoot, path.dirname(path.dirname(dataPath)));
        const relativeDataParts = relativeDir && relativeDir !== '.'
          ? relativeDir.split(path.sep).filter(Boolean)
          : [];
        const imageDir = path.join(imageRoot, ...relativeDataParts, cardFolderName);
        const localImage = getLocalWebp(imageDir, cardFolderName);
        const fixedUrl = localImage.exists
          ? buildPublicUrl({ dbName, relativeDataParts, cardFolderName, fileName: localImage.fileName })
          : null;

        byProductId.set(productId, {
          productId,
          dbName,
          name: json.name || cardFolderName,
          dataPath,
          imageDir,
          localImage,
          fixedUrl
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
    return response.status;
  } catch (error) {
    return `ERR: ${error.message}`;
  }
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
    const parts = parsed.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
    return parts.at(-2) || '';
  } catch (_) {
    return '';
  }
};

const isHttpOk = (status) => status === 200;
const isHttpRateLimited = (status) => status === 429;
const isHttpInconclusive = (status) => (
  status === 429
  || (typeof status === 'string' && status.startsWith('ERR:'))
);
const isHttpBroken = (status) => (
  CHECK_HTTP
  && status !== null
  && !isHttpOk(status)
  && !isHttpInconclusive(status)
);

const mapConcurrent = async (items, concurrency, mapper) => {
  const results = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
};

const main = async () => {
  log.title('🔎 Diagnóstico de URLs de imágenes MYL');
  if (unknownDbs.length) throw new Error(`Carpetas no configuradas: ${unknownDbs.join(', ')}`);
  log.info(`DBs: ${DATABASES.join(', ')}`);
  log.info(`Prueba HTTP: ${CHECK_HTTP ? 'sí' : 'no'}`);
  if (CHECK_HTTP) log.info(`Concurrencia HTTP: ${HTTP_CONCURRENCY}`);

  const { byProductId, warnings } = collectLocalIndex();
  warnings.slice(0, 20).forEach((warning) => log.warn(warning));
  if (warnings.length > 20) log.warn(`+${warnings.length - 20} advertencias adicionales`);

  const products = await prisma.tcgProduct.findMany({
    where: {
      categoryId: CATEGORY_ID,
      productId: { in: [...byProductId.keys()] }
    },
    select: { productId: true, name: true, imageUrl: true }
  });

  const report = {
    checked: products.length,
    ok: 0,
    urlDiffersFromLocal: 0,
    dbUrlBroken: 0,
    dbUrlRateLimited: 0,
    dbUrlInconclusive: 0,
    fixedUrlWorks: 0,
    noLocalImage: 0,
    samples: []
  };

  const analyzed = await mapConcurrent(products, CHECK_HTTP ? HTTP_CONCURRENCY : 1, async (product, i) => {
    const local = byProductId.get(product.productId);
    if (!local?.fixedUrl) {
      return { type: 'noLocalImage' };
    }

    const differs = product.imageUrl !== local.fixedUrl;

    const currentStatus = await headStatus(product.imageUrl);
    const fixedStatus = differs ? await headStatus(local.fixedUrl) : currentStatus;

    const currentBroken = isHttpBroken(currentStatus);
    const currentRateLimited = CHECK_HTTP && isHttpRateLimited(currentStatus);
    const currentInconclusive = CHECK_HTTP && isHttpInconclusive(currentStatus);

    if ((i + 1) % 500 === 0) log.info(`Revisadas: ${i + 1}/${products.length}`);

    return {
      type: 'analyzed',
      differs,
      currentBroken,
      currentRateLimited,
      currentInconclusive,
      fixedWorks: fixedStatus === 200,
      ok: !differs && !currentBroken && !currentInconclusive,
      sample: differs || currentBroken || currentInconclusive
        ? {
        productId: product.productId,
        name: product.name,
        dbName: local.dbName,
        localReason: local.localImage.reason,
        currentStatus,
        fixedStatus,
        currentUrl: product.imageUrl,
        fixedUrl: local.fixedUrl
        }
        : null
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
    if (item.fixedWorks) report.fixedUrlWorks += 1;
    if (item.ok) report.ok += 1;
    if (item.sample && report.samples.length < 50) report.samples.push(item.sample);
  }

  const reportPath = path.join(__dirname, `myl-image-url-diagnosis-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  log.title('📊 Resumen');
  log.info(`Revisé ${report.checked} cartas comparando la base de datos con tus carpetas locales.`);

  if (report.urlDiffersFromLocal === 0 && report.dbUrlBroken === 0 && report.noLocalImage === 0 && report.dbUrlInconclusive === 0) {
    log.ok('No encontré problemas: las URLs de la base coinciden con los archivos locales.');
  } else {
    log.warn(`Encontré ${report.urlDiffersFromLocal} cartas cuya URL guardada en la base no coincide con el archivo .webp real local.`);
    if (CHECK_HTTP) {
      log.warn(`${report.dbUrlBroken} URLs parecen realmente caídas por internet, sin contar límites temporales.`);
      if (report.dbUrlRateLimited) {
        log.warn(`${report.dbUrlRateLimited} pruebas HTTP recibieron 429: el servidor/CDN limitó demasiadas consultas. Eso no confirma que la imagen esté mala.`);
      }
      const otherInconclusive = report.dbUrlInconclusive - report.dbUrlRateLimited;
      if (otherInconclusive > 0) {
        log.warn(`${otherInconclusive} pruebas HTTP fallaron por red/conexión. Eso tampoco confirma URL corrupta.`);
      }
    }
    log.ok(`${report.checked - report.noLocalImage} cartas tienen una imagen local identificada para poder comparar.`);
    if (report.noLocalImage) log.warn(`${report.noLocalImage} cartas no tienen una imagen local clara para proponer corrección.`);
    if (!CHECK_HTTP) log.info('No probé internet porque usaste diagnóstico rápido. Esto es normal y mucho más veloz.');
  }

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
        console.log('  Acción sugerida: marcar "Reparar URLs de imágenes desde archivos locales".');
      }
      if (CHECK_HTTP) {
        if (isHttpRateLimited(sample.currentStatus)) {
          console.log('  Prueba HTTP: respondió 429, o sea el servidor/CDN frenó el diagnóstico por demasiadas consultas. No significa que la URL esté mala.');
        } else if (typeof sample.currentStatus === 'string' && sample.currentStatus.startsWith('ERR:')) {
          console.log(`  Prueba HTTP: no fue concluyente por error de conexión (${sample.currentStatus}).`);
        } else {
          console.log(`  Estado actual: ${sample.currentStatus}. Estado corregido: ${sample.fixedStatus}.`);
        }
      }
    }
  }
};

main()
  .catch((error) => {
    log.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

