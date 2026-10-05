// Almacenamiento de imágenes en Cloudflare R2.
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

const R2_REQUIRED_ENV = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL'
];
const missingR2Config = () => R2_REQUIRED_ENV.filter(key => !process.env[key]);
// En las pruebas automáticas (nunca en producción) se simula R2 para poder probar la subida de imágenes
const R2_TEST_STUB = process.env.TEST_AUTH_STUB === '1' && process.env.R2_TEST_STUB === '1';
export const hasR2Config = () => R2_TEST_STUB || missingR2Config().length === 0;

const getR2KeyFromPublicUrl = (url) => {
  if (!url || !process.env.R2_PUBLIC_URL) return null;

  const publicBaseUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, '') + '/';
  if (!String(url).startsWith(publicBaseUrl)) return null;

  return decodeURIComponent(String(url).slice(publicBaseUrl.length));
};
// Carpeta de R2 de cada usuario (la misma que usa la subida de imágenes)
export const userR2Prefix = (firebaseUid) => 'Carpetazo.cl/Usuarios/' + String(firebaseUid || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_') + '/';
// Solo se borra un archivo de la carpeta del propio usuario: una URL guardada en el perfil puede apuntar al archivo de otra persona
export const deleteR2ObjectByPublicUrl = async (url, ownerFirebaseUid) => {
  const key = getR2KeyFromPublicUrl(url);
  if (!key || !process.env.R2_BUCKET_NAME || !ownerFirebaseUid) return;
  if (!key.startsWith(userR2Prefix(ownerFirebaseUid)) || key.includes('..')) return;
  // Una portada tiene además su copia para celular (<nombre>_m.webp): se borran juntas
  const keys = /\/banner\/[0-9a-f]{32}\.webp$/.test(key) ? [key, key.replace(/\.webp$/, '_m.webp')] : [key];

  try {
    for (const objectKey of keys) {
      await r2Client.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: objectKey
      }));
    }
  } catch (error) {
    console.warn('No se pudo eliminar imagen anterior de R2:', error?.message || error);
  }
};

// Initialize S3 client for Cloudflare R2
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ACCOUNT_ID ? "https://" + process.env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com" : '',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

// Solo en pruebas automáticas: R2 simulado que recuerda qué se subió y qué se borró (no existe en producción)
// La ruta /api/__test/r2-log (routes/users.js) lo expone solo si existe
export const r2TestLog = R2_TEST_STUB ? [] : null;
if (r2TestLog) {
  r2Client.send = async (command) => {
    r2TestLog.push({ op: command.constructor.name === 'PutObjectCommand' ? 'put' : 'delete', key: command.input.Key });
    return {};
  };
}
