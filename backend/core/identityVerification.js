// Verificación de identidad: RUT, teléfono, carnet por ambos lados y una foto del rostro. Moderación revisa y decide.
// Las fotos son datos muy sensibles y el bucket de R2 es público: se cifran en el servidor (AES-256-GCM) antes de subirlas, con nombres aleatorios,
// y solo se descifran para el equipo de Moderación a través de una ruta con sesión. Sin IDENTITY_KEY la función queda apagada.
import crypto from 'node:crypto';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { hasR2Config, r2Client } from './r2.js';

export const IDENTITY_PREFIX = 'Carpetazo.cl/Verificaciones/';
export const IDENTITY_KINDS = ['front', 'back', 'selfie'];
export const IDENTITY_KIND_FIELD = { front: 'frontKey', back: 'backKey', selfie: 'selfieKey' };
export const MAX_ATTEMPTS_PER_DAY = 3;
const MIN_SIDE = 500; // una foto más chica no deja leer el carnet
const MAX_SIDE = 1800;
const bucket = () => process.env.R2_BUCKET_NAME;

const secret = () => {
  const key = Buffer.from(process.env.IDENTITY_KEY || '', 'base64');
  return key.length === 32 ? key : null;
};
export const identityConfigured = () => Boolean(secret()) && hasR2Config();

export const encryptBuffer = (plain, key = secret()) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]); // iv (12) + etiqueta (16) + datos
};

export const decryptBuffer = (packed, key = secret()) => {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]);
};

// RUT en el formato 12345678-K (sin puntos); el dígito verificador se valida aparte con isValidRut
export const normalizeRut = (value) => {
  const clean = String(value || '').replace(/[^0-9kK]/g, '').toUpperCase();
  return clean.length >= 2 ? `${clean.slice(0, -1)}-${clean.slice(-1)}` : '';
};

// Una foto de documento: se decodifica (no se confía en el tipo que diga el navegador), se endereza, se reduce y se guarda sin metadatos (ubicación, cámara)
export const prepareDocument = async (buffer) => {
  let meta;
  try { meta = await sharp(buffer, { failOn: 'error' }).metadata(); } catch { throw Object.assign(new Error('No se pudo leer una de las fotos. Sube una imagen JPG, PNG o WebP.'), { status: 400 }); }
  if (!['jpeg', 'png', 'webp'].includes(meta.format)) throw Object.assign(new Error('Las fotos deben ser JPG, PNG o WebP.'), { status: 400 });
  if (Math.min(meta.width || 0, meta.height || 0) < MIN_SIDE && Math.max(meta.width || 0, meta.height || 0) < MIN_SIDE * 1.4) {
    throw Object.assign(new Error('Una de las fotos es muy pequeña: se tiene que leer bien. Acércate o usa la cámara principal.'), { status: 400 });
  }
  return sharp(buffer).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
};

export const storeEncrypted = async (userId, plain) => {
  const key = `${IDENTITY_PREFIX}${userId}/${crypto.randomUUID()}.bin`;
  await r2Client.send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: encryptBuffer(plain), ContentType: 'application/octet-stream', CacheControl: 'private, no-store' }));
  return key;
};

export const readDecrypted = async (key) => {
  if (!String(key).startsWith(IDENTITY_PREFIX)) throw new Error('Ruta no permitida');
  const result = await r2Client.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return decryptBuffer(Buffer.from(await result.Body.transformToByteArray()));
};
