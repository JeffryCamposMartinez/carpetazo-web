// Huella visual de imágenes (dHash de 64 bits): sobrevive a recortes leves, cambios de tamaño y recompresión.
// Una imagen confirmada como infracción deja su huella prohibida; subir una parecida se rechaza.
import sharp from 'sharp';

export const HASH_MAX_DISTANCE = 10; // bits distintos tolerados (de 64): dos imágenes sin relación suelen diferir en unos 32

const bitsFromPixels = (pixels) => {
  let bits = 0n;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      // margen de 3 niveles: las zonas planas no cambian de bit por el ruido de la compresión
      bits = (bits << 1n) | (pixels[y * 9 + x + 1] - pixels[y * 9 + x] > 3 ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, '0');
};

// A partir de una imagen ya abierta con sharp (así el archivo se decodifica una sola vez para varios usos)
export const dHashOf = async (pipeline) => bitsFromPixels(await pipeline.clone().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer());

export const dHash = async (buffer) => dHashOf(sharp(buffer, { limitInputPixels: 80_000_000 }).rotate());

export const hamming = (a, b) => {
  let diff = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (diff > 0n) { count += Number(diff & 1n); diff >>= 1n; }
  return count;
};

const isHash = (value) => typeof value === 'string' && /^[0-9a-f]{16}$/.test(value);

// Lista en memoria de huellas prohibidas (se recarga cada minuto o al cambiar)
export const createHashBank = ({ prisma }) => {
  const BANK_TTL_MS = Number(process.env.HASH_BANK_TTL_MS) || 60 * 1000; // en las pruebas se baja para ver cambios al instante
  let cache = { until: 0, rows: [] };
  const load = async () => {
    if (cache.until > Date.now()) return cache.rows;
    const rows = await prisma.imageHash.findMany({ where: { banned: true }, select: { hash: true } });
    cache = { until: Date.now() + BANK_TTL_MS, rows: rows.map((row) => row.hash) };
    return cache.rows;
  };
  const invalidate = () => { cache = { until: 0, rows: [] }; };

  // Devuelve la distancia si la imagen se parece a una prohibida, o null
  const closestBanned = async (hash) => {
    if (!isHash(hash)) return null;
    let best = null;
    for (const banned of await load()) {
      const distance = hamming(hash, banned);
      if (distance <= HASH_MAX_DISTANCE && (best === null || distance < best)) best = distance;
    }
    return best;
  };

  // Guarda la huella de una imagen subida (para poder prohibirla si luego se confirma una infracción)
  const remember = async ({ url, hash, userId = null, sha256 = null, verdict = null, provider = null }) => {
    if (!url || !isHash(hash)) return;
    await prisma.imageHash.upsert({ where: { url }, create: { url, hash, userId, sha256, verdict, provider }, update: {} });
  };

  // Al confirmar una infracción en una imagen: su huella queda prohibida
  const banByUrl = async (url) => {
    if (typeof url !== 'string' || !url) return 0;
    const result = await prisma.imageHash.updateMany({ where: { url, banned: false }, data: { banned: true, bannedAt: new Date(), userId: null } });
    if (result.count) invalidate();
    return result.count;
  };

  return { closestBanned, remember, banByUrl, invalidate };
};
