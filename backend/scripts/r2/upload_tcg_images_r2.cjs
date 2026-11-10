const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
try { require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') }); } catch (_) {}

const arg = (name, fallback = '') => {
  const inline = process.argv.find(a => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const root = arg('root', process.env.CARPETAZO_DOWNLOADS || 'C:\\Users\\Jeffry\\Desktop\\TcgplayerUpdate\\Descargas');
const tcgs = new Set(arg('tcg').split(',').map(x => x.trim()).filter(Boolean));
const dry = process.argv.includes('--dry-run');
const concurrency = Math.max(1, Number(arg('concurrency', '6')) || 6);
const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) throw new Error(`Faltan variables R2 en backend/.env: ${missing.join(', ')}`);
const s3 = new S3Client({ region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
const files = [];
const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.isFile() && /\.(webp|png|jpe?g)$/i.test(e.name)) files.push(p); } };
const imageDir = (dbDir, dbName, tcg) => {
  const preferred = path.join(dbDir, `${dbName.replace(/_DB$/i, '')}_Images`);
  const legacy = path.join(dbDir, 'Images');
  if (fs.existsSync(preferred)) return preferred;
  if (fs.existsSync(legacy)) return legacy;
  const found = fs.readdirSync(dbDir, { withFileTypes: true }).find(e => e.isDirectory() && /_Images$/i.test(e.name));
  return found ? path.join(dbDir, found.name) : null;
};
const main = async () => {
  if (!fs.existsSync(root)) throw new Error(`No existe la carpeta: ${root}`);
  const selected = [...tcgs];
  if (!selected.length) throw new Error('No se seleccionó ningún TCG.');
  for (const tcg of selected) {
    const tcgRoot = path.join(root, tcg);
    if (!fs.existsSync(tcgRoot)) { console.log(`AVISO|No existe TCG: ${tcg}`); continue; }
    for (const db of fs.readdirSync(tcgRoot, { withFileTypes: true }).filter(e => e.isDirectory() && /_DB$/i.test(e.name))) {
      const dbRoot = path.join(tcgRoot, db.name); const imgRoot = imageDir(dbRoot, db.name, tcg);
      if (!imgRoot) { console.log(`AVISO|Sin carpeta de imágenes: ${tcg}/${db.name}`); continue; }
      const before = files.length; walk(imgRoot); for (let i = before; i < files.length; i++) { const filePath = files[i]; files[i] = { filePath, key: ['Carpetazo.cl', tcg, db.name, path.basename(imgRoot), path.relative(imgRoot, filePath).replace(/\\/g, '/')].join('/').split('/').filter(Boolean).join('/') }; }
    }
  }
  console.log(`FOUND|${files.length}`);
  let done = 0, uploaded = 0, skipped = 0, failed = 0, cursor = 0;
  const failures = [];
  const worker = async () => { while (true) {
    const item = files[cursor++]; if (!item) return;
    try {
      let exists = false;
      if (!dry) { try { await s3.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: item.key })); exists = true; } catch (e) { if (e?.$metadata?.httpStatusCode !== 404 && e?.name !== 'NotFound' && e?.Code !== 'NotFound') throw e; } }
      if (exists) skipped++;
      else { if (!dry) await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: item.key, Body: fs.createReadStream(item.filePath), ContentType: item.filePath.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg' })); uploaded++; }
    } catch (e) { failed++; const failure = { filePath: item.filePath, key: item.key, error: e.message, at: new Date().toISOString() }; failures.push(failure); console.log(`FAILED|${item.key}|${e.message}`); }
    done++; if (done % 100 === 0 || done === files.length) console.log(`PROGRESS|${done}|${files.length}|uploaded=${uploaded}|skipped=${skipped}|failed=${failed}`);
  } };
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  const report = path.join(process.cwd(), `r2-upload-failures-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  if (failures.length) fs.writeFileSync(report, JSON.stringify(failures, null, 2), 'utf8');
  console.log(`DONE|${dry ? 'Simulación terminada' : 'Carga terminada'}|processed=${done}|uploaded=${uploaded}|skipped=${skipped}|failed=${failed}${failures.length ? `|report=${report}` : ''}`);
  if (failed) process.exitCode = 2;
};
main().catch(e => { console.error(`ERROR|${e.message}`); process.exitCode = 1; });
