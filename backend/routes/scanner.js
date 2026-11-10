// Escáner de cartas: el navegador manda un cuadro de la cámara y el backend lo valida y lo reenvía al motor de reconocimiento (servicio aparte, solo alcanzable desde aquí).
// El motor devuelve candidatas sin verificar: aquí solo se pasan los campos públicos del catálogo.
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { routeLimiter } from '../core/limits.js';
import { badRequest, isAllowedStoredImageUrl } from '../core/validation.js';

const router = express.Router();

const MAX_BYTES = 4_000_000;
const GAMES = new Set([3, 100, 85, 1, 2, 63, 68, 71, 89, 99]); // categorías del catálogo que el motor tiene indexadas
const ENGINE_TIMEOUT_MS = 30000;
const MAX_IN_FLIGHT = 3; // escaneos al motor a la vez; el resto espera su turno en el navegador
let inFlight = 0;

const startsWith = (buffer, bytes) => bytes.every((byte, index) => buffer[index] === byte);
const isImage = (buffer) => buffer.length > 12 && (startsWith(buffer, [0xff, 0xd8, 0xff]) || startsWith(buffer, [0x89, 0x50, 0x4e, 0x47]) || (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && buffer.toString('latin1', 8, 12) === 'WEBP'));

// Recorte del marco en fracciones de la foto: «x,y,ancho,alto», todo entre 0 y 1
const parseCrop = (raw) => {
  if (raw === undefined || raw === '') return '';
  if (typeof raw !== 'string' || raw.length > 80) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value) || value < 0 || value > 1) || parts[2] <= 0 || parts[3] <= 0) return null;
  return parts.map((value) => Math.round(value * 10000) / 10000).join(',');
};

const parseGames = (raw) => {
  if (raw === undefined || raw === '') return '';
  if (typeof raw !== 'string' || raw.length > 60) return null;
  const ids = raw.split(',').map((value) => value.trim()).filter(Boolean).map(Number);
  if (ids.length === 0 || ids.length > GAMES.size || ids.some((id) => !GAMES.has(id))) return null;
  return [...new Set(ids)].join(',');
};

const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');
const number = (value) => (Number.isFinite(value) ? Math.round(value * 10000) / 10000 : null);

// Solo los campos públicos del catálogo (nunca la vista previa ni nada interno del motor)
const publicCandidate = (item) => ({
  name: text(item?.name, 150),
  number: text(item?.number, 30),
  set: text(item?.set, 150),
  rarity: text(item?.rarity, 60),
  lang: text(item?.lang, 30),
  image: isAllowedStoredImageUrl(item?.image) ? item.image : null,
  categoryId: Number.isInteger(item?.category_id) ? item.category_id : null,
  productId: Number.isInteger(item?.product_id) ? item.product_id : null,
  groupId: Number.isInteger(item?.group_id) ? item.group_id : null, // la edición: el sitio abre con ella la ficha exacta de la carta
  score: number(item?.score),
  group: text(item?.group, 150),
});

// Idioma que el motor leyó en la carta (solo Pokémon): inglés, español o japonés; `null` si no hubo certeza
const LANGUAGES = new Set(['en', 'es', 'ja']);
const publicLanguage = (language) => (LANGUAGES.has(language?.code) ? { code: language.code, confidence: number(language.conf) } : { code: null, confidence: 0 });

const publicResult = (data) => {
  if (!data || data.found !== true || !Array.isArray(data.top)) return { found: false };
  return {
    found: true,
    top: data.top.slice(0, 5).map(publicCandidate),
    same: Array.isArray(data.same) ? data.same.slice(0, 20).map(publicCandidate) : [], // otras ediciones de la misma carta
    ocr: { names: Array.isArray(data.ocr?.name) ? data.ocr.name.slice(0, 3).map((name) => text(name, 80)) : [], margin: number(data.ocr?.margin), boost: number(data.ocr?.boost) },
    language: publicLanguage(data.ocr?.language),
  };
};

router.post(
  '/api/scanner/scan',
  routeLimiter(60 * 1000, 90), // abierto a visitantes: el límite por IP y MAX_IN_FLIGHT acotan el uso del motor
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_BYTES }),
  async (req, res) => {
    const base = process.env.VISION_ENGINE_URL || '';
    const key = process.env.VISION_ENGINE_KEY || '';
    if (!base || !key) return res.status(503).json({ success: false, message: 'El reconocimiento no está disponible por ahora.' });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0 || !isImage(req.body)) return badRequest(res, 'Imagen inválida');
    const crop = parseCrop(req.headers['x-crop']);
    const games = parseGames(req.headers['x-games']);
    if (crop === null || games === null) return badRequest(res, 'Datos inválidos');
    if (inFlight >= MAX_IN_FLIGHT) return res.status(429).json({ success: false, message: 'El reconocimiento está ocupado, intenta de nuevo en un momento.' });

    inFlight += 1;
    try {
      const headers = { 'x-service-key': key, 'content-type': 'application/octet-stream' };
      if (crop) headers['x-crop'] = crop;
      if (games) headers['x-games'] = games;
      const response = await fetch(`${base.replace(/\/+$/, '')}/scan`, { method: 'POST', headers, body: req.body, redirect: 'error', signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS) });
      if (!response.ok) {
        console.error('Motor de reconocimiento respondió', response.status);
        return res.status(502).json({ success: false, message: 'No se pudo reconocer la carta. Intenta de nuevo.' });
      }
      res.json({ success: true, ...publicResult(await response.json()) });
    } catch (error) {
      console.error('Error llamando al motor de reconocimiento:', error.message);
      res.status(502).json({ success: false, message: 'No se pudo reconocer la carta. Intenta de nuevo.' });
    } finally {
      inFlight -= 1;
    }
  }
);

// Endereza y centra la carta de una foto (para ofrecerla como imagen de la carta). Sin carta clara devuelve found:false y el navegador usa la foto tal cual.
router.post(
  '/api/scanner/straighten',
  authenticateToken,
  routeLimiter(60 * 1000, 30),
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_BYTES }),
  async (req, res) => {
    const base = process.env.VISION_ENGINE_URL || '';
    const key = process.env.VISION_ENGINE_KEY || '';
    if (!base || !key) return res.status(503).json({ success: false, message: 'El reconocimiento no está disponible por ahora.' });
    if (!Buffer.isBuffer(req.body) || req.body.length === 0 || !isImage(req.body)) return badRequest(res, 'Imagen inválida');
    if (inFlight >= MAX_IN_FLIGHT) return res.status(429).json({ success: false, message: 'El reconocimiento está ocupado, intenta de nuevo en un momento.' });
    inFlight += 1;
    try {
      const response = await fetch(`${base.replace(/\/+$/, '')}/straighten`, { method: 'POST', headers: { 'x-service-key': key, 'content-type': 'application/octet-stream' }, body: req.body, redirect: 'error', signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS) });
      if (!response.ok) return res.status(502).json({ success: false, message: 'No se pudo procesar la foto.' });
      const data = await response.json();
      const valid = data?.found === true && typeof data.image === 'string' && data.image.length < 6_000_000 && /^[A-Za-z0-9+/=]+$/.test(data.image);
      res.json({ success: true, found: valid, ...(valid ? { image: data.image } : {}) });
    } catch (error) {
      console.error('Error enderezando la foto:', error.message);
      res.status(502).json({ success: false, message: 'No se pudo procesar la foto.' });
    } finally {
      inFlight -= 1;
    }
  }
);

export default router;
