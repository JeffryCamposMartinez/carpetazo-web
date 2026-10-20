// Imágenes para compartir una carta o un vendedor (WhatsApp, Instagram, Telegram…): 1200x630 con la marca, el nombre, el precio y las cifras reales.
// Solo se usan datos públicos: cartas visibles con stock en carpetas públicas y visibles, y vendedores sin cierre de cuenta.
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { prisma } from './db.js';
import { downloadImage, PREVIEW_H, PREVIEW_W } from './folderPreview.js';
import { sameCardMatch } from './listing.js';
import { getReviewSummary } from './publicSeller.js';
import { isVerifiedSeller } from './sellerTrust.js';
import { isAllowedProxyImageUrl, isUuid } from './validation.js';
import { restrictions } from '../moderation/services.js';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const FONT_EXTRA = { file: path.join(ASSETS, 'PlusJakartaSans-ExtraBold.ttf'), family: 'Plus Jakarta Sans ExtraBold' };
const FONT_BOLD = { file: path.join(ASSETS, 'PlusJakartaSans-Bold.ttf'), family: 'Plus Jakarta Sans Bold' };
const TCG_LABELS = { Pokemon: 'Pokémon', 'Mitos y Leyendas': 'Mitos y Leyendas', OnePiece: 'One Piece', Magic: 'Magic', YuGiOh: 'Yu-Gi-Oh!', Riftbound: 'Riftbound', Lorcana: 'Disney Lorcana', Digimon: 'Digimon Card Game' };
const visibleCard = { stock: { gt: 0 }, moderationState: 'visible', folder: { isPublic: true, moderationState: 'visible' } };
const USERNAME = /^[A-Za-z0-9_.-]{3,30}$/;
const CACHE_MAX = 400;
// La foto de perfil de Google viene de un host fijo y conocido
const isAvatarUrl = (value) => {
  try { return typeof value === 'string' && (isAllowedProxyImageUrl(value) || (new URL(value).protocol === 'https:' && new URL(value).hostname === 'lh3.googleusercontent.com')); } catch (_error) { return false; }
};
const clp = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;
const cut = (value, max) => (value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);
const plain = (value, max) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const xml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const cache = new Map();
const pending = new Map();
const cached = async (signature, render) => {
  if (cache.has(signature)) {
    const hit = cache.get(signature);
    cache.delete(signature);
    cache.set(signature, hit);
    return hit;
  }
  if (pending.has(signature)) return pending.get(signature);
  const job = render()
    .then((buffer) => {
      cache.set(signature, buffer);
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
      return buffer;
    })
    .finally(() => pending.delete(signature));
  pending.set(signature, job);
  return job;
};

// Texto con la tipografía de la marca (se carga del archivo: no depende de las fuentes del servidor). Si no cabe, baja de tamaño.
const textLayer = async (text, { font = FONT_EXTRA, color = '#ffffff', sizes = [48], width, maxHeight = 10000 }) => {
  let last = null;
  for (const size of sizes) {
    last = await sharp({ text: { text: `<span foreground="${color}">${xml(text)}</span>`, font: `${font.family} ${size}`, fontfile: font.file, rgba: true, width, wrap: 'word' } }).png().toBuffer({ resolveWithObject: true });
    if (last.info.height <= maxHeight) break;
  }
  return { input: last.data, width: last.info.width, height: last.info.height };
};

const background = (extra = '') => Buffer.from(`<svg width="${PREVIEW_W}" height="${PREVIEW_H}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b4a8f"/><stop offset="1" stop-color="#0b1e3f"/></linearGradient>
  <filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter></defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>${extra}<rect y="${PREVIEW_H - 10}" width="100%" height="10" fill="#facc15"/></svg>`);

const pill = async (label, { bg = '#facc15', color = '#12315f', size = 26 } = {}) => {
  const text = await textLayer(label, { font: FONT_EXTRA, color, sizes: [size], width: 560 });
  const w = text.width + 40;
  const h = text.height + 18;
  const base = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${h / 2}" fill="${bg}"/></svg>`);
  return { base, text, w, h };
};

const logoLayer = async (width) => {
  const logo = await sharp(path.join(ASSETS, 'logo_completo.webp')).resize({ width }).png().toBuffer({ resolveWithObject: true });
  return { input: logo.data, width: logo.info.width, height: logo.info.height };
};

const roundedCard = async (buffer, boxW, boxH, radius) => {
  const resized = await sharp(buffer).rotate().resize({ width: boxW, height: boxH, fit: 'inside' }).png().toBuffer({ resolveWithObject: true });
  const mask = Buffer.from(`<svg width="${resized.info.width}" height="${resized.info.height}"><rect width="100%" height="100%" rx="${radius}" ry="${radius}"/></svg>`);
  return { data: await sharp(resized.data).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer(), width: resized.info.width, height: resized.info.height };
};

// ---------- Carta ----------
const renderCard = async (data) => {
  const layers = [];
  let shadow = '';
  const image = data.imageUrl && isAllowedProxyImageUrl(data.imageUrl) ? await downloadImage(data.imageUrl) : null;
  let textLeft = 70;
  if (image) {
    try {
      const card = await roundedCard(image, 400, 540, 22);
      const x = 60 + Math.round((400 - card.width) / 2);
      const y = Math.round((PREVIEW_H - 10 - card.height) / 2);
      shadow = `<rect x="${x + 3}" y="${y + 10}" width="${card.width}" height="${card.height}" rx="22" fill="#000" fill-opacity="0.5" filter="url(#blur)"/>`;
      layers.push({ input: card.data, left: x, top: y });
      textLeft = 540;
    } catch (_error) { /* una imagen dañada no impide la tarjeta */ }
  }
  const textWidth = PREVIEW_W - textLeft - 60;
  const game = await pill(data.game);
  const name = await textLayer(cut(data.name, 70), { sizes: [62, 54, 46, 40], width: textWidth, maxHeight: 190 });
  const detail = data.detail ? await textLayer(cut(data.detail, 70), { font: FONT_BOLD, color: '#bfdbfe', sizes: [30], width: textWidth }) : null;
  const price = data.low ? await textLayer(`Desde ${clp(data.low)}`, { color: '#facc15', sizes: [78, 66, 56], width: textWidth, maxHeight: 100 }) : await textLayer('Mira las ofertas', { color: '#facc15', sizes: [56], width: textWidth });
  const counts = await textLayer(data.counts, { font: FONT_BOLD, color: '#ffffff', sizes: [30], width: textWidth });
  const logo = await logoLayer(150);

  let y = 62;
  layers.push({ input: game.base, left: textLeft, top: y }, { input: game.text.input, left: textLeft + 20, top: y + 9 });
  y += game.h + 22;
  layers.push({ input: name.input, left: textLeft, top: y });
  y += name.height + 8;
  if (detail) { layers.push({ input: detail.input, left: textLeft, top: y }); y += detail.height + 22; } else y += 22;
  layers.push({ input: price.input, left: textLeft, top: Math.min(y, PREVIEW_H - 10 - 240) });
  y = Math.min(y, PREVIEW_H - 10 - 240) + price.height + 8;
  layers.push({ input: counts.input, left: textLeft, top: y });
  layers.push({ input: logo.input, left: PREVIEW_W - 60 - logo.width, top: PREVIEW_H - 10 - 22 - logo.height });
  return sharp(background(shadow)).composite(layers).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
};

export const loadCardPreview = async (id) => {
  if (!isUuid(id)) return null;
  const card = await prisma.card.findFirst({ where: { id, ...visibleCard }, select: { id: true, tcgId: true, name: true, imageUrl: true, data: true, folder: { select: { tcg: true } } } });
  if (!card) return null;
  const offers = await prisma.card.findMany({
    where: { ...visibleCard, ...sameCardMatch(card), folder: { ...visibleCard.folder, tcg: card.folder.tcg } },
    take: 100, select: { price: true, stock: true, folder: { select: { userId: true } } }
  });
  const prices = offers.map((offer) => offer.price).filter((price) => Number.isFinite(price) && price > 0);
  const low = prices.length ? Math.min(...prices) : null;
  const sellers = new Set(offers.map((offer) => offer.folder.userId)).size;
  const set = plain(card.data?.set, 60);
  const rarity = plain(card.data?.rarity, 40);
  const data = {
    name: plain(card.name, 120) || 'Carta', game: TCG_LABELS[card.folder.tcg] || card.folder.tcg, detail: [set, rarity].filter(Boolean).join(' · '),
    low, imageUrl: card.imageUrl,
    counts: `${offers.length} ${offers.length === 1 ? 'oferta' : 'ofertas'} · ${sellers} ${sellers === 1 ? 'vendedor' : 'vendedores'} en Chile`
  };
  const signature = createHash('sha1').update(JSON.stringify(['card', card.id, data])).digest('hex').slice(0, 16);
  return { data, signature };
};

export const cardShareImage = (signature, data) => cached(signature, () => renderCard(data));

// ---------- Vendedor ----------
const renderSeller = async (data) => {
  const layers = [];
  const photo = isAvatarUrl(data.photoURL) ? await downloadImage(data.photoURL) : null;
  const D = 330;
  let textLeft = 70;
  let shadow = '';
  if (photo) {
    try {
      const resized = await sharp(photo).rotate().resize({ width: D, height: D, fit: 'cover' }).png().toBuffer();
      const circle = await sharp(resized).composite([{ input: Buffer.from(`<svg width="${D}" height="${D}"><circle cx="${D / 2}" cy="${D / 2}" r="${D / 2}"/></svg>`), blend: 'dest-in' }]).png().toBuffer();
      const x = 70;
      const y = Math.round((PREVIEW_H - 10 - D) / 2);
      shadow = `<circle cx="${x + D / 2}" cy="${y + D / 2 + 8}" r="${D / 2 + 4}" fill="#000" fill-opacity="0.45" filter="url(#blur)"/><circle cx="${x + D / 2}" cy="${y + D / 2}" r="${D / 2 + 7}" fill="#facc15"/>`;
      layers.push({ input: circle, left: x, top: y });
      textLeft = 70 + D + 60;
    } catch (_error) { /* una foto dañada no impide la tarjeta */ }
  }
  if (!layers.length) { // sin foto (o no se pudo bajar): círculo amarillo con la inicial
    const initial = await textLayer((data.name.match(/[\p{L}\p{N}]/u)?.[0] || 'C').toUpperCase(), { color: '#12315f', sizes: [170], width: D });
    const x = 70;
    const y = Math.round((PREVIEW_H - 10 - D) / 2);
    shadow = `<circle cx="${x + D / 2}" cy="${y + D / 2 + 8}" r="${D / 2 + 4}" fill="#000" fill-opacity="0.45" filter="url(#blur)"/><circle cx="${x + D / 2}" cy="${y + D / 2}" r="${D / 2}" fill="#facc15"/>`;
    layers.push({ input: initial.input, left: x + Math.round((D - initial.width) / 2), top: y + Math.round((D - initial.height) / 2) });
    textLeft = 70 + D + 60;
  }
  const textWidth = PREVIEW_W - textLeft - 60;
  const label = await pill(data.verified ? 'Vendedor verificado' : 'Vendedor en Carpetazo', data.verified ? { bg: '#facc15', color: '#12315f' } : { bg: '#ffffff', color: '#12315f' });
  const name = await textLayer(cut(data.name, 50), { sizes: [70, 60, 50, 42], width: textWidth, maxHeight: 180 });
  const place = await textLayer(cut(data.place, 60), { font: FONT_BOLD, color: '#bfdbfe', sizes: [32], width: textWidth });
  const stats = await textLayer(data.stats, { color: '#facc15', sizes: [44, 38], width: textWidth, maxHeight: 130 });
  const extra = data.rating ? await textLayer(data.rating, { font: FONT_BOLD, color: '#ffffff', sizes: [30], width: textWidth }) : null;
  const logo = await logoLayer(150);

  let y = 70;
  layers.push({ input: label.base, left: textLeft, top: y }, { input: label.text.input, left: textLeft + 20, top: y + 9 });
  y += label.h + 24;
  layers.push({ input: name.input, left: textLeft, top: y });
  y += name.height + 14;
  layers.push({ input: place.input, left: textLeft, top: y });
  y += place.height + 30;
  layers.push({ input: stats.input, left: textLeft, top: y });
  y += stats.height + 10;
  if (extra) layers.push({ input: extra.input, left: textLeft, top: y });
  layers.push({ input: logo.input, left: PREVIEW_W - 60 - logo.width, top: PREVIEW_H - 10 - 22 - logo.height });
  return sharp(background(shadow)).composite(layers).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
};

export const loadSellerPreview = async (username) => {
  if (!USERNAME.test(username || '')) return null;
  const user = await prisma.user.findFirst({
    where: { username, NOT: { role: 'deleted' } },
    select: { id: true, name: true, username: true, photoURL: true, publicComuna: true, phone: true, emailVerified: true, updatedAt: true }
  });
  if (!user || (await restrictions.restrictionsFor(user.id)).has('ban')) return null;
  const [folders, cards, reviews] = await Promise.all([
    prisma.folder.count({ where: { userId: user.id, isPublic: true, moderationState: 'visible' } }),
    prisma.card.count({ where: { ...visibleCard, folder: { ...visibleCard.folder, userId: user.id } } }),
    getReviewSummary(user.id)
  ]);
  if (!folders) return null;
  const data = {
    name: plain(user.name || user.username, 60), photoURL: user.photoURL, verified: isVerifiedSeller(user),
    place: `@${user.username}${user.publicComuna ? ` · ${user.publicComuna}` : ''}`,
    stats: `${cards} ${cards === 1 ? 'carta' : 'cartas'} a la venta`,
    rating: reviews.showAverage ? `${String(reviews.average).replace('.', ',')} de 5 · ${reviews.count} reseñas` : ''
  };
  const signature = createHash('sha1').update(JSON.stringify(['seller', user.id, data])).digest('hex').slice(0, 16);
  return { data, signature };
};

export const sellerShareImage = (signature, data) => cached(signature, () => renderSeller(data));
