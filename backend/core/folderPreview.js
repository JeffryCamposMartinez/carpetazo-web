// Miniatura para compartir el enlace de una carpeta (WhatsApp, Telegram, etc.): las cartas de su primera página y el logo.
// Solo se usan carpetas públicas y visibles, y cartas visibles con imagen en los dominios permitidos.
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { prisma } from './db.js';
import { isAllowedProxyImageUrl, isUuid } from './validation.js';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
export const PREVIEW_W = 1200;
export const PREVIEW_H = 630;
const PAGE_CARDS = 9; // las cartas de la primera página del catálogo
const MARGIN = 26;
const GAP = 14;
const CARD_RATIO = 0.715; // ancho / alto de una carta
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 6000;
const CACHE_MAX = 300;

const cache = new Map(); // firma -> Buffer JPEG (la más usada va al final)
const pending = new Map(); // firma -> generación en curso (varias visitas iguales comparten una sola)

// Mismo orden que ve la persona en el catálogo: primero el orden que eligió y luego la fecha de creación
export const firstPageCards = (cards) => [...cards]
  .map((card) => ({ ...card, order: Number.isFinite(Number(card.data?.catalogOrder)) ? Number(card.data.catalogOrder) : 100000 }))
  .sort((a, b) => (a.order - b.order) || (new Date(a.createdAt) - new Date(b.createdAt)))
  .filter((card) => card.imageUrl && isAllowedProxyImageUrl(card.imageUrl))
  .slice(0, PAGE_CARDS);

export const downloadImage = async (url) => {
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS), headers: { 'User-Agent': 'Carpetazo-LinkPreview/1.0' } });
    if (!response.ok) return null;
    if (Number(response.headers.get('content-length') || 0) > MAX_IMAGE_BYTES) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length > MAX_IMAGE_BYTES ? null : buffer;
  } catch (_error) {
    return null;
  }
};

// Distribución: una fila si son pocas, dos filas (la segunda centrada) si son más
const layout = (slots) => {
  const rows = slots <= 5 ? 1 : 2;
  const cols = Math.ceil(slots / rows);
  const cellW = (PREVIEW_W - MARGIN * 2 - GAP * (cols - 1)) / cols;
  const cellH = (PREVIEW_H - MARGIN * 2 - GAP * (rows - 1)) / rows;
  const boxH = Math.floor(Math.min(cellH, cellW / CARD_RATIO));
  const boxW = Math.floor(boxH * CARD_RATIO);
  return { rows, cols, boxW, boxH };
};

export const roundedPng = async (input, width, height, radius) => {
  const resized = await sharp(input).rotate().resize({ width, height, fit: 'inside' }).png().toBuffer({ resolveWithObject: true });
  const mask = Buffer.from(`<svg width="${resized.info.width}" height="${resized.info.height}"><rect width="100%" height="100%" rx="${radius}" ry="${radius}"/></svg>`);
  const data = await sharp(resized.data).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return { data, width: resized.info.width, height: resized.info.height };
};

const renderImage = async (cards) => {
  const downloads = await Promise.all(cards.map((card) => downloadImage(card.imageUrl)));
  const buffers = downloads.filter(Boolean);
  const slots = buffers.length + 1; // las cartas y un recuadro con el logo
  const { rows, cols, boxW, boxH } = layout(slots);
  const radius = Math.round(boxW * 0.055);

  // Posición de cada recuadro: filas completas arriba y la última centrada
  const positions = [];
  for (let index = 0; index < slots; index += 1) {
    const row = Math.floor(index / cols);
    const inRow = row === rows - 1 ? slots - cols * (rows - 1) : cols;
    const column = index - row * cols;
    const rowWidth = inRow * boxW + (inRow - 1) * GAP;
    const x = Math.round((PREVIEW_W - rowWidth) / 2 + column * (boxW + GAP));
    const totalH = rows * boxH + (rows - 1) * GAP;
    const y = Math.round((PREVIEW_H - totalH) / 2 + row * (boxH + GAP));
    positions.push({ x, y });
  }

  const layers = [];
  const shadows = [];
  for (let index = 0; index < buffers.length; index += 1) {
    try {
      const card = await roundedPng(buffers[index], boxW, boxH, radius);
      const x = positions[index].x + Math.round((boxW - card.width) / 2);
      const y = positions[index].y + Math.round((boxH - card.height) / 2);
      shadows.push(`<rect x="${x + 2}" y="${y + 6}" width="${card.width}" height="${card.height}" rx="${radius}" fill="#000" fill-opacity="0.45" filter="url(#blur)"/>`);
      layers.push({ input: card.data, left: x, top: y });
    } catch (_error) { /* una imagen dañada no impide la miniatura */ }
  }

  // Recuadro del logo: queda en el último lugar, como una carta más
  const tile = positions[slots - 1];
  const logoWidth = Math.round(Math.min(boxW, PREVIEW_W) * 0.62);
  const logo = await sharp(path.join(ASSETS, 'logo_completo.webp')).resize({ width: logoWidth }).png().toBuffer({ resolveWithObject: true });
  const tileSvg = `<svg width="${boxW}" height="${boxH}"><rect x="1.5" y="1.5" width="${boxW - 3}" height="${boxH - 3}" rx="${radius}" fill="#ffffff" fill-opacity="0.1" stroke="#facc15" stroke-opacity="0.75" stroke-width="3"/></svg>`;
  layers.push({ input: Buffer.from(tileSvg), left: tile.x, top: tile.y });
  layers.push({ input: logo.data, left: tile.x + Math.round((boxW - logo.info.width) / 2), top: tile.y + Math.round((boxH - logo.info.height) / 2) });

  const background = `<svg width="${PREVIEW_W}" height="${PREVIEW_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b4a8f"/><stop offset="1" stop-color="#0b1e3f"/></linearGradient>
      <filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    ${shadows.join('')}
    <rect y="${PREVIEW_H - 8}" width="100%" height="8" fill="#facc15"/>
  </svg>`;
  return sharp(Buffer.from(background)).composite(layers).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
};

// JPEG de 1200x630 con la firma dada (cambia cuando cambian las cartas o la carpeta). Se guarda en memoria un rato.
export const folderPreviewImage = async (signature, cards) => {
  if (cache.has(signature)) {
    const hit = cache.get(signature);
    cache.delete(signature);
    cache.set(signature, hit);
    return hit;
  }
  if (pending.has(signature)) return pending.get(signature);
  const job = renderImage(cards)
    .then((buffer) => {
      cache.set(signature, buffer);
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
      return buffer;
    })
    .finally(() => pending.delete(signature));
  pending.set(signature, job);
  return job;
};

// Carpeta pública y visible con sus cartas visibles; cualquier otra cosa no existe para quien comparte el enlace
export const loadFolderPreview = async (id) => {
  if (!isUuid(id)) return null;
  const folder = await prisma.folder.findUnique({
    where: { id },
    select: { id: true, name: true, tcg: true, isPublic: true, moderationState: true, updatedAt: true, user: { select: { name: true, username: true } } }
  });
  if (!folder || !folder.isPublic || folder.moderationState !== 'visible') return null;
  const [cards, count] = await Promise.all([
    prisma.card.findMany({ where: { folderId: id, moderationState: 'visible' }, select: { id: true, imageUrl: true, data: true, createdAt: true }, take: 1500 }),
    prisma.card.count({ where: { folderId: id, moderationState: 'visible' } })
  ]);
  const shown = firstPageCards(cards);
  const signature = createHash('sha1').update(JSON.stringify([id, folder.updatedAt, shown.map((card) => [card.id, card.imageUrl])])).digest('hex').slice(0, 16);
  return { folder, count, shown, signature };
};

// Deja lista la miniatura de una carpeta antes de que alguien la pida: armarla desde cero tarda ~2 s y los programas de mensajería no esperan tanto
export const warmFolderPreview = async (id) => {
  const data = await loadFolderPreview(id);
  if (data) await folderPreviewImage(data.signature, data.shown);
};

// Precalentado en segundo plano: al arrancar, las carpetas más visitadas; y cada pocos minutos, las que cambiaron (cartas nuevas o editadas, publicación)
const WARM_EVERY_MS = 2 * 60 * 1000;
const WARM_WINDOW_MS = 5 * 60 * 1000;
const warmMany = async (ids) => {
  for (const id of ids) {
    try { await warmFolderPreview(id); } catch (error) { console.error('Error precalentando la miniatura de una carpeta:', error.message); }
  }
};
export const startPreviewWarmer = () => {
  if (process.env.TEST_AUTH_STUB) return; // las pruebas no descargan imágenes de afuera
  const visibleFolder = { isPublic: true, moderationState: 'visible' };
  setTimeout(async () => {
    try {
      const popular = await prisma.folder.findMany({ where: visibleFolder, orderBy: [{ weeklyVisits: 'desc' }, { totalVisits: 'desc' }], take: 30, select: { id: true } });
      await warmMany(popular.map((folder) => folder.id));
    } catch (error) { console.error('Error en el precalentado inicial de miniaturas:', error.message); }
  }, 20 * 1000).unref();
  setInterval(async () => {
    try {
      const since = new Date(Date.now() - WARM_WINDOW_MS);
      const [cards, folders] = await Promise.all([
        prisma.card.findMany({ where: { OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }], folder: visibleFolder }, distinct: ['folderId'], take: 30, select: { folderId: true } }),
        prisma.folder.findMany({ where: { ...visibleFolder, updatedAt: { gte: since } }, take: 30, select: { id: true } })
      ]);
      await warmMany([...new Set([...cards.map((card) => card.folderId), ...folders.map((folder) => folder.id)])]);
    } catch (error) { console.error('Error precalentando miniaturas de carpetas cambiadas:', error.message); }
  }, WARM_EVERY_MS).unref();
};
