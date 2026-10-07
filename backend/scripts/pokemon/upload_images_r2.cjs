const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
} catch (_) {}

const getArgValue = (name) => {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return '';
};

const TCG = getArgValue('tcg') || 'Pokemon';
const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = Math.max(1, Number.parseInt(getArgValue('concurrency') || '12', 10) || 12);

const CONFIG = {
  Pokemon: {
    baseDir: (process.env.CARPETAZO_DOWNLOADS ? process.env.CARPETAZO_DOWNLOADS + '\\Pokemon' : 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Pokemon'),
    allDbs: ['Pokemon_DB_EN', 'Pokemon_DB_ES'],
    imagesDir: 'Images',
    r2Prefix: ['Carpetazo.cl', 'Pokemon'],
  },
  Myl: {
    baseDir: (process.env.CARPETAZO_DOWNLOADS ? process.env.CARPETAZO_DOWNLOADS + '\\Mitos_y_Leyendas' : 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Mitos_y_Leyendas'),
    allDbs: ['Primer_Bloque_DB', 'Imperio_DB', 'Furia_Extendido_DB', 'Primera_Era_DB'],
    imagesDir: (dbName) => dbName.replace('_DB', '_Images'),
    r2Prefix: ['Carpetazo.cl', 'Mitos_y_Leyendas'],
  },
};

const config = CONFIG[TCG];
if (!config) throw new Error(`TCG no soportado: ${TCG}`);

const requestedDbs = new Set(getArgValue('db').split(',').map(value => value.trim()).filter(Boolean));
const DATABASES = requestedDbs.size ? config.allDbs.filter(db => requestedDbs.has(db)) : config.allDbs;
const unknownDbs = [...requestedDbs].filter(db => !config.allDbs.includes(db));

const colors = { reset: '\x1b[0m', blue: '\x1b[34m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', bold: '\x1b[1m' };
const log = {
  title: (message) => console.log(`\n${colors.bold}${colors.cyan}${message}${colors.reset}`),
  info: (message) => console.log(`${colors.blue}ℹ${colors.reset} ${message}`),
  ok: (message) => console.log(`${colors.green}✓${colors.reset} ${message}`),
  warn: (message) => console.log(`${colors.yellow}⚠${colors.reset} ${message}`),
  error: (message) => console.log(`${colors.red}✗${colors.reset} ${message}`),
};

const requiredEnv = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
const missing = requiredEnv.filter(name => !process.env[name]);
if (missing.length) throw new Error(`Faltan variables R2 en backend/.env: ${missing.join(', ')}`);

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const encodeKeyPart = (part) => String(part).replace(/\\/g, '/');
const contentTypeFor = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.webp') return 'image/webp';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
};

const walkImages = (dirPath, files = [], warnings = []) => {
  let entries = [];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (error) {
    warnings.push(`No pude leer ${dirPath}: ${error.message}`);
    return files;
  }
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) walkImages(entryPath, files, warnings);
    else if (entry.isFile() && /\.(webp|png|jpe?g)$/i.test(entry.name)) files.push(entryPath);
  }
  return files;
};

const runWithConcurrency = async (items, concurrency, worker) => {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  }));
};

const main = async () => {
  log.title(`☁️ Subir imágenes ${TCG} a Cloudflare R2`);
  if (unknownDbs.length) throw new Error(`Carpetas no configuradas: ${unknownDbs.join(', ')}`);
  log.info(`DBs: ${DATABASES.join(', ')}`);
  log.info(`Modo: ${DRY_RUN ? 'dry-run, no sube archivos' : 'sube a R2'}`);
  log.info(`Concurrencia: ${CONCURRENCY}`);

  const warnings = [];
  const uploads = [];
  for (const dbName of DATABASES) {
    const imageDirName = typeof config.imagesDir === 'function' ? config.imagesDir(dbName) : config.imagesDir;
    const imageRoot = path.join(config.baseDir, dbName, imageDirName);
    if (!fs.existsSync(imageRoot)) {
      warnings.push(`No existe carpeta de imágenes: ${imageRoot}`);
      continue;
    }
    for (const filePath of walkImages(imageRoot, [], warnings)) {
      const relativeParts = path.relative(imageRoot, filePath).split(path.sep).filter(Boolean);
      const key = [...config.r2Prefix, dbName, imageDirName, ...relativeParts].map(encodeKeyPart).join('/');
      uploads.push({ filePath, key });
    }
  }

  warnings.slice(0, 25).forEach(warning => log.warn(warning));
  if (warnings.length > 25) log.warn(`+${warnings.length - 25} advertencias adicionales`);
  log.info(`Imágenes encontradas: ${uploads.length}`);

  let uploaded = 0;
  await runWithConcurrency(uploads, CONCURRENCY, async ({ filePath, key }) => {
    if (!DRY_RUN) {
      await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: fs.createReadStream(filePath),
        ContentType: contentTypeFor(filePath),
      }));
    }
    uploaded += 1;
    if (uploaded % 500 === 0 || uploaded === uploads.length) log.ok(`Imágenes procesadas: ${uploaded}/${uploads.length}`);
  });

  log.title('📊 Resumen');
  log.ok(`Imágenes ${DRY_RUN ? 'simuladas' : 'subidas'}: ${uploaded}`);
  log.ok('Proceso terminado.');
};

main().catch(error => {
  log.error(error.message);
  process.exitCode = 1;
});
