// Imagen de TCGplayer en memoria -> webp (grande y miniatura de 400 px). Nada se guarda en disco: el resultado se sube directo a R2.
import sharp from 'sharp';
import { sleep } from './tcgcsv.js';

const USER_AGENT = 'Carpetazo.cl/1.0 (sincronizacion de catalogo)';
const ALLOWED_HOSTS = new Set(['tcgplayer-cdn.tcgplayer.com', 'product-images.tcgplayer.com']);
const MAX_BYTES = 25 * 1024 * 1024;
const THUMB_WIDTH = 400;

// "…/593294_200w.jpg" -> versiones de mayor a menor tamaño
export const imageCandidates = (imageUrl) => {
  const url = String(imageUrl || '');
  const match = url.match(/^(.*)_(\d+)w\.(jpg|jpeg|png)$/i);
  if (!match) return url ? [url] : [];
  const [, base, , ext] = match;
  return [`${base}_in_1000x1000.${ext}`, `${base}_400w.${ext}`, url];
};

export const isAllowedImageUrl = (value) => {
  try { const url = new URL(value); return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname); } catch { return false; }
};

const download = async (url) => {
  if (!isAllowedImageUrl(url)) throw Object.assign(new Error('Dominio de imagen no permitido'), { status: 0, fatal: true });
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': USER_AGENT }, redirect: 'error' });
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
  if ((Number(response.headers.get('content-length')) || 0) > MAX_BYTES) throw Object.assign(new Error('Imagen demasiado grande'), { status: 0, fatal: true });
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_BYTES) throw Object.assign(new Error('Imagen vacía o demasiado grande'), { status: 0, fatal: true });
  return buffer;
};

// Prueba cada versión y devuelve la primera que existe. Si ninguna existe, el producto no tiene imagen (`noImage`): no es un fallo.
export const fetchBestImage = async (imageUrl, { retries = 2 } = {}) => {
  const candidates = imageCandidates(imageUrl);
  if (candidates.length === 0) throw Object.assign(new Error('Sin imagen'), { noImage: true });
  let last;
  let absent = 0;
  for (const url of candidates) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try { return await download(url); } catch (error) {
        last = error;
        if (error.fatal) throw error;
        if (error.status === 404 || error.status === 403) { absent += 1; break; }
        await sleep(800 * 3 ** attempt);
      }
    }
  }
  if (absent === candidates.length) throw Object.assign(new Error('Sin imagen en TCGplayer'), { noImage: true });
  throw last || new Error('No se pudo descargar');
};

export const convertImage = async (buffer, { quality = 78, thumbQuality = 70 } = {}) => {
  const source = sharp(buffer, { failOn: 'error' });
  const meta = await source.metadata();
  if (!meta.width || !meta.height) throw new Error('La imagen no es válida');
  const large = await source.clone().webp({ quality, effort: 4 }).toBuffer();
  const thumb = await source.clone().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: thumbQuality, effort: 4 }).toBuffer();
  return { large, thumb };
};
