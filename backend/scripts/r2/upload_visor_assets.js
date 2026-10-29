// Sube el paquete del buscador por imagen (modelo, índice, OCR) a R2: node scripts/r2/upload_visor_assets.js <visor-assets.tar.gz>
// El frontend lo baja al construir (frontend/scripts/fetch_visor_assets.mjs). Se vuelve a subir cuando cambia el índice de cartas.
import 'dotenv/config'; // antes de core/r2.js: el cliente de R2 lee las variables al importarse
import fs from 'fs';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '../../core/r2.js';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) { console.error('Uso: node scripts/r2/upload_visor_assets.js <visor-assets.tar.gz>'); process.exit(1); }
const Key = 'Carpetazo.cl/Visor/visor-assets.tar.gz';
await r2Client.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key, Body: fs.readFileSync(file), ContentType: 'application/gzip', CacheControl: 'no-cache' }));
console.log('Subido:', process.env.R2_PUBLIC_URL.replace(/\/$/, '') + '/' + Key);
