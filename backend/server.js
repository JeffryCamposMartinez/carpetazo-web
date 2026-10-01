import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();
// Desarrollo local: EXTRA_ENV_FILE apunta a otro archivo de variables (por ejemplo, credenciales de servicios externos)
if (process.env.EXTRA_ENV_FILE) dotenv.config({ path: process.env.EXTRA_ENV_FILE });
import { initializeApp } from 'firebase-admin/app';
import nodemailer from 'nodemailer';
import { registerModeration } from './moderation.js';
import { createRestrictions, registerSanctions } from './moderationB.js';
import { REPORT_TARGETS, findReason } from './reportReasons.js';
import { registerModerationC } from './moderationC.js';
import { createHashBank } from './perceptual.js';
import { createImageScanner, prepareImage, isTrustedUploader } from './imageScan.js';
import { getAuth } from 'firebase-admin/auth';

const FIREBASE_PROJECT_ID = 'carpetazo-db9d7';

initializeApp({
  projectId: FIREBASE_PROJECT_ID
});

// Middleware to validate Firebase ID Token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <TOKEN>

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token de autenticación requerido' });
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = decodedToken; // Contains user payload (uid, email, etc.)
    req.user.sub = decodedToken.uid; // Ensure 'sub' maps to 'uid' for backwards compatibility
    next();
  } catch (error) {
    console.error('Error al verificar token Firebase:', error.message);
    return res.status(403).json({ success: false, message: 'Token de autenticación inválido o expirado' });
  }
};

import { PrismaClient, Prisma } from '@prisma/client';
const prisma = new PrismaClient();

const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

const isAdminEmail = (email) => Boolean(email && adminEmails.includes(String(email).toLowerCase()));

// Equipo de moderación: 1 = soporte (solo lectura), 2 = moderador, 3 = administrador
const requireStaff = (minLevel) => async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const firebaseAdminClaim = req.user?.admin === true || req.user?.role === 'admin';
    const envAdmin = req.user.email_verified === true && isAdminEmail(req.user.email);
    let level = 0;
    if (firebaseAdminClaim || envAdmin || user?.role === 'admin') level = 3;
    else if (user?.role === 'moderator') level = 2;
    else if (user?.role === 'support') level = 1;
    if (level < minLevel) return res.status(403).json({ success: false, message: 'Acceso restringido' });
    req.staffLevel = level;
    req.dbUser = user;
    next();
  } catch (error) {
    console.error('Error checking staff permissions:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const firebaseAdminClaim = req.user?.admin === true || req.user?.role === 'admin';
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const databaseAdmin = user?.role === 'admin';
    // El correo solo cuenta si Firebase confirma que fue verificado
    const envAdmin = req.user.email_verified === true && isAdminEmail(req.user.email);

    if (!firebaseAdminClaim && !databaseAdmin && !envAdmin) {
      return res.status(403).json({ success: false, message: 'Acceso administrativo requerido' });
    }

    req.dbUser = user;
    next();
  } catch (error) {
    console.error('Error checking admin permissions:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
};
const app = express();
const port = process.env.PORT || 8000;
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
const hasR2Config = () => R2_TEST_STUB || missingR2Config().length === 0;
const getAllowedProxyImageHosts = () => {
  const hosts = new Set([
    'api.carpetazo.cl',
    'carpetazo.cl',
    'www.carpetazo.cl',
    'imagenes.carpetazo.cl',
    'images.pokemontcg.io',
    'api.pokemontcg.io',
    'tcgplayer-cdn.tcgplayer.com',
    'tor.myl.cl',
    'www.myl.cl',
    'myl.cl'
  ]);

  if (process.env.R2_PUBLIC_URL) {
    try {
      hosts.add(new URL(process.env.R2_PUBLIC_URL).hostname.toLowerCase());
    } catch (_error) {
      // La validación de salud ya reporta si la URL pública de R2 está mal configurada.
    }
  }

  return hosts;
};
const isAllowedProxyImageUrl = (rawUrl) => {
  try {
    const url = new URL(String(rawUrl || ''));
    if (url.protocol !== 'https:') return false;
    // Solo hosts conocidos; R2 únicamente el bucket propio (ya incluido en la lista desde R2_PUBLIC_URL)
    return getAllowedProxyImageHosts().has(url.hostname.toLowerCase());
  } catch (_error) {
    return false;
  }
};
// --- Validación de nombres de usuario y URLs guardadas por los usuarios ---
const RESERVED_USERNAMES = new Set([
  'admin', 'api', 'bienvenida', 'dashboard', 'perfil', 'carpeta', 'carpetas', 'c', 'mensajes',
  'cartas', 'vendedores', 'moderacion', 'terminos', 'privacidad', 'legal', 'login', 'logout', 'registro', 'soporte', 'ayuda', 'carpetazo', 'root', 'null', 'undefined'
]);
const normalizeUsername = (value) => String(value || '')
  .toLowerCase()
  .trim()
  .replace(/\s+/g, '_')
  .replace(/[^a-z0-9_]/g, '');
// Devuelve el nombre normalizado o null si no cumple la política
const validUsername = (value) => {
  const username = normalizeUsername(value);
  return /^[a-z0-9_]{3,20}$/.test(username) && !RESERVED_USERNAMES.has(username) ? username : null;
};

// Imágenes guardadas: solo https y hosts conocidos (R2, TCGplayer, avatares de Google)
// Bucket propio de R2 (R2_PUBLIC_URL): cualquiera puede crear un *.r2.dev, así que solo se acepta el nuestro
const ownR2Host = () => {
  try { return new URL(process.env.R2_PUBLIC_URL || '').hostname.toLowerCase(); } catch (_error) { return ''; }
};
const isAllowedStoredImageUrl = (rawUrl) => {
  try {
    const raw = String(rawUrl || '');
    // Estas URLs se insertan en CSS (url(...)): sin espacios, paréntesis, comillas ni barras invertidas
    if (raw.length > 2000 || /[\s()'"\\<>]/.test(raw)) return false;
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return getAllowedProxyImageHosts().has(host) || (host === ownR2Host() && host !== '') || host.endsWith('.googleusercontent.com');
  } catch (_error) {
    return false;
  }
};
// Vacío/null se permite (borra la imagen); cualquier otro valor debe ser una URL permitida
const checkImageField = (value) => value === null || value === '' || isAllowedStoredImageUrl(value);

// Redes sociales: se acepta el usuario (@nombre) o una URL https del dominio de esa red
const SOCIAL_DOMAINS = {
  facebookUrl: ['facebook.com', 'fb.com'],
  instagramUrl: ['instagram.com'],
  youtubeUrl: ['youtube.com', 'youtu.be']
};
const checkSocialField = (field, value) => {
  if (value === null || value === '') return true;
  const text = String(value).trim();
  if (text.length > 200) return false;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) return /^[\w.@/-]+$/.test(text); // usuario o ruta sin esquema
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && SOCIAL_DOMAINS[field].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch (_error) {
    return false;
  }
};

// Validación simple de entradas: tipos y tamaños razonables
const isShortText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const isOptionalText = (value, max) => value === undefined || value === null || (typeof value === 'string' && value.length <= max);
const isValidPrice = (value) => value === undefined || value === null || value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100000000);
const isValidStock = (value) => value === undefined || (Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 100000);
const isSmallObject = (value, maxBytes = 20000) => value === undefined || value === null
  || (typeof value === 'object' && !Array.isArray(value) && JSON.stringify(value).length <= maxBytes);
const badRequest = (res, message) => res.status(400).json({ success: false, message });

const getR2KeyFromPublicUrl = (url) => {
  if (!url || !process.env.R2_PUBLIC_URL) return null;

  const publicBaseUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, '') + '/';
  if (!String(url).startsWith(publicBaseUrl)) return null;

  return decodeURIComponent(String(url).slice(publicBaseUrl.length));
};
const deleteR2ObjectByPublicUrl = async (url) => {
  const key = getR2KeyFromPublicUrl(url);
  if (!key || !process.env.R2_BUCKET_NAME) return;

  try {
    await r2Client.send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key
    }));
  } catch (error) {
    console.warn('No se pudo eliminar imagen anterior de R2:', error?.message || error);
  }
};

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok'
  });
});

app.set('trust proxy', 1);

const rateLimitMax = Number.parseInt(process.env.RATE_LIMIT_MAX || '2000', 10);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.isFinite(rateLimitMax) && rateLimitMax > 0 ? rateLimitMax : 2000,
  skip: (req) => req.method === 'OPTIONS',
  message: 'Demasiadas peticiones desde esta IP, por favor intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: ['https://carpetazo.cl', 'https://www.carpetazo.cl', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use('/api', limiter);

// Límites más estrictos para rutas que escriben o que consumen recursos externos
const routeLimiter = (windowMs, max) => rateLimit({
  windowMs,
  max,
  skip: (req) => req.method === 'OPTIONS',
  message: { success: false, message: 'Demasiadas solicitudes, intenta de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/orders/create', routeLimiter(15 * 60 * 1000, 20));
app.use('/api/proxy-image', routeLimiter(15 * 60 * 1000, 600));
app.use('/api/folders/:id/visit', routeLimiter(15 * 60 * 1000, 120));
app.use('/api/users/username/check', routeLimiter(15 * 60 * 1000, 60));
app.use('/api/users/username/available', routeLimiter(15 * 60 * 1000, 60));
app.use('/api/orders/mine/:id/status', routeLimiter(15 * 60 * 1000, 120));
app.use('/api/folders/me/stats', routeLimiter(15 * 60 * 1000, 600));
app.use('/api/orders/mine/pending', routeLimiter(15 * 60 * 1000, 600));
// Rutas que escriben datos o hacen consultas pesadas
app.get('/api/folders/search', routeLimiter(15 * 60 * 1000, 300));
app.get('/api/sellers', routeLimiter(15 * 60 * 1000, 300));
app.get('/api/home/featured', routeLimiter(15 * 60 * 1000, 300));
app.post('/api/folders', routeLimiter(15 * 60 * 1000, 60));
app.put('/api/folders/:id', routeLimiter(15 * 60 * 1000, 200));
app.put('/api/folders/:id/order', routeLimiter(15 * 60 * 1000, 60));
app.delete('/api/folders/:id', routeLimiter(15 * 60 * 1000, 60));
app.post('/api/folders/:id/cards', routeLimiter(15 * 60 * 1000, 600));
app.put('/api/folders/:id/cards/:cardId', routeLimiter(15 * 60 * 1000, 600));
app.delete('/api/folders/:id/cards/:cardId', routeLimiter(15 * 60 * 1000, 600));
app.delete('/api/cards/:id', routeLimiter(15 * 60 * 1000, 600));
app.post('/api/messages', routeLimiter(15 * 60 * 1000, 300));
app.post('/api/messages/:otherId', routeLimiter(15 * 60 * 1000, 300));
app.post('/api/messages/:otherId/typing', routeLimiter(15 * 60 * 1000, 900));
app.put('/api/messages/:id/read', routeLimiter(15 * 60 * 1000, 600));
app.post('/api/users/sync', routeLimiter(15 * 60 * 1000, 60));
app.put('/api/users/me', routeLimiter(15 * 60 * 1000, 60));
app.delete('/api/users/me', routeLimiter(15 * 60 * 1000, 10));
app.post('/api/users/upload-image', routeLimiter(15 * 60 * 1000, 30));
app.get('/api/tcg/search', routeLimiter(15 * 60 * 1000, 300));
app.post('/api/tcg/products/metadata', routeLimiter(15 * 60 * 1000, 300));
app.get('/api/cards/search', routeLimiter(15 * 60 * 1000, 300));
app.get('/api/wishlist/me', routeLimiter(15 * 60 * 1000, 300));
app.get('/api/wishlist/matches', routeLimiter(15 * 60 * 1000, 120));
app.post('/api/wishlist', routeLimiter(15 * 60 * 1000, 120));
app.put('/api/wishlist/:id', routeLimiter(15 * 60 * 1000, 120));
app.delete('/api/wishlist/:id', routeLimiter(15 * 60 * 1000, 120));
app.get('/api/users/:username/wishlist', routeLimiter(15 * 60 * 1000, 300));
app.post('/api/reviews', routeLimiter(15 * 60 * 1000, 20));
app.get('/api/reviews/pending', routeLimiter(15 * 60 * 1000, 300));
app.post('/api/reviews/:id/report', routeLimiter(15 * 60 * 1000, 10));
app.get('/api/users/:username/reviews', routeLimiter(15 * 60 * 1000, 300));
app.get('/api/tcg/sets', routeLimiter(15 * 60 * 1000, 120));
app.get('/api/tcg/cards', routeLimiter(15 * 60 * 1000, 120));
app.get('/api/folders', routeLimiter(15 * 60 * 1000, 120));
app.use('/api/admin/reviews', routeLimiter(15 * 60 * 1000, 300));
app.get('/api/legal/versions', routeLimiter(15 * 60 * 1000, 300));
app.post('/api/users/me/accept-terms', routeLimiter(15 * 60 * 1000, 30));
app.delete('/api/users/me/unaccepted', routeLimiter(15 * 60 * 1000, 10));
app.post('/api/admin/test-email', routeLimiter(15 * 60 * 1000, 10));
app.post('/api/reports', routeLimiter(15 * 60 * 1000, 80));
app.get('/api/reports/reasons', routeLimiter(15 * 60 * 1000, 200));
app.get('/api/reports/mine', routeLimiter(15 * 60 * 1000, 100));
app.use('/api/admin/reports', routeLimiter(15 * 60 * 1000, 300));
app.use('/api/admin/audit', routeLimiter(15 * 60 * 1000, 120));
app.use('/api/admin/cases', routeLimiter(15 * 60 * 1000, 300));
app.use('/api/admin/sanctions', routeLimiter(15 * 60 * 1000, 200));
app.use('/api/admin/appeals', routeLimiter(15 * 60 * 1000, 200));
app.use('/api/admin/users', routeLimiter(15 * 60 * 1000, 200));
app.use('/api/admin/evidence', routeLimiter(15 * 60 * 1000, 300));
app.post('/api/reports/:id/evidence', routeLimiter(15 * 60 * 1000, 20));
app.post('/api/appeals', routeLimiter(15 * 60 * 1000, 10));
app.get('/api/me/moderation', routeLimiter(15 * 60 * 1000, 100));
app.post('/api/me/cases/:id/response', routeLimiter(15 * 60 * 1000, 10));
app.use('/api/blocks', routeLimiter(15 * 60 * 1000, 100));
app.get('/api/me/orders/:code', routeLimiter(15 * 60 * 1000, 40));
app.get('/api/admin/metrics', routeLimiter(15 * 60 * 1000, 60));
app.use('/api/admin/retention', routeLimiter(15 * 60 * 1000, 30));
app.post('/api/admin/cases/:id/export', routeLimiter(15 * 60 * 1000, 20));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// --- Términos y Condiciones y Política de Privacidad: versiones vigentes y aceptación ---
// Si cambia el texto de alguno, se sube su versión aquí y en frontend/src/legal/versions.js (una prueba las compara).
const LEGAL_CURRENT = { termsVersion: '2026-10-05', privacyVersion: '2026-10-05' };
const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000; // solo una cuenta recién creada puede elegir su usuario al aceptar
const ACCEPTED_CACHE_MS = 5 * 60 * 1000;
const acceptedCache = new Map(); // firebaseUid -> hasta cuándo se da por vigente (solo aceptaciones vigentes)

const latestAcceptance = (userId) => prisma.termsAcceptance.findFirst({ where: { userId }, orderBy: { acceptedAt: 'desc' }, select: { termsVersion: true, privacyVersion: true, isAdult: true, acceptedAt: true } });
const isCurrentAcceptance = (row) => Boolean(row && row.isAdult && row.termsVersion === LEGAL_CURRENT.termsVersion && row.privacyVersion === LEGAL_CURRENT.privacyVersion);

// Estado que se envía al propio usuario: qué versión rige, si ya aceptó y si puede elegir su usuario en este paso
const getLegalStatus = async (user) => {
  const last = await latestAcceptance(user.id);
  return {
    current: LEGAL_CURRENT,
    accepted: isCurrentAcceptance(last),
    acceptedAt: last?.acceptedAt || null,
    canChooseUsername: !last && Date.now() - new Date(user.createdAt).getTime() < NEW_ACCOUNT_WINDOW_MS
  };
};

// Sin aceptación vigente no se puede escribir nada (crear, editar, pedir, escribir...); leer sí, y las rutas de abajo siempre
const TERMS_EXEMPT = [['POST', '/api/users/sync'], ['POST', '/api/users/me/accept-terms'], ['DELETE', '/api/users/me/unaccepted'], ['DELETE', '/api/users/me']];
app.use('/api', async (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
  if (TERMS_EXEMPT.some(([method, route]) => method === req.method && route === path)) return next();
  const token = String(req.headers['authorization'] || '').split(' ')[1];
  if (!token) return next(); // sin sesión: cada ruta decide si lo permite
  try {
    const decoded = await getAuth().verifyIdToken(token);
    if ((acceptedCache.get(decoded.uid) || 0) > Date.now()) return next();
    const user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid }, select: { id: true, role: true } });
    if (!user || user.role === 'deleted') return next();
    if (isCurrentAcceptance(await latestAcceptance(user.id))) {
      acceptedCache.set(decoded.uid, Date.now() + ACCEPTED_CACHE_MS);
      return next();
    }
    return res.status(403).json({ success: false, code: 'terms_required', message: 'Debes aceptar los Términos y Condiciones para continuar' });
  } catch (_error) {
    return next(); // token inválido o error momentáneo: la ruta responde con su propia validación
  }
});
// Sanciones vigentes: una cuenta suspendida no escribe; con restricciones parciales solo se corta lo que corresponde
const restrictions = createRestrictions({ prisma, getAuth });
const hashBank = createHashBank({ prisma });
const imageScanner = createImageScanner({ prisma });
app.use('/api', restrictions.gate);

// Bloqueo entre usuarios: devuelve el motivo si no se puede escribir, o null
const messageBlockReason = async (senderId, receiverId) => {
  const rows = await prisma.userBlock.findMany({ where: { OR: [{ blockerId: receiverId, blockedId: senderId }, { blockerId: senderId, blockedId: receiverId }] }, select: { blockerId: true } });
  if (rows.some((row) => row.blockerId === senderId)) return 'Bloqueaste a esta persona. Desbloquéala para escribirle.';
  if (rows.length) return 'No puedes enviarle mensajes a esta persona.';
  return null;
};

// Proxy con caché hacia TCGCSV (Pokémon inglés y japonés): el navegador no puede llamarlo directo por CORS
const TCGCSV_ALLOWED_PATH = /^\/tcgplayer\/(3|85)\/(groups|\d+\/products)$/;
const TCGCSV_TTL_MS = 30 * 60 * 1000;
const TCGCSV_MAX_ENTRIES = 80;
const tcgcsvCache = new Map();
app.get(/^\/api\/tcgcsv(\/.*)$/, async (req, res) => {
  const tcgcsvPath = req.params[0];
  if (!TCGCSV_ALLOWED_PATH.test(tcgcsvPath)) {
    return res.status(400).json({ success: false, message: 'Ruta no permitida' });
  }

  const sendJson = (body) => {
    res.set('Cache-Control', 'public, max-age=1800');
    return res.type('application/json').send(body);
  };

  const cached = tcgcsvCache.get(tcgcsvPath);
  if (cached && Date.now() - cached.at < TCGCSV_TTL_MS) return sendJson(cached.body);

  try {
    const response = await fetch('https://tcgcsv.com' + tcgcsvPath, {
      headers: { 'User-Agent': 'Carpetazo/1.0 (+https://carpetazo.cl)', 'Accept': 'application/json' }
    });
    if (!response.ok) {
      return res.status(response.status === 404 ? 404 : 502).json({ success: false, message: 'No se pudo obtener el catálogo' });
    }
    const body = await response.text();
    if (tcgcsvCache.size >= TCGCSV_MAX_ENTRIES) tcgcsvCache.delete(tcgcsvCache.keys().next().value);
    tcgcsvCache.set(tcgcsvPath, { at: Date.now(), body });
    return sendJson(body);
  } catch (error) {
    console.error('Error consultando TCGCSV:', error.message);
    return res.status(502).json({ success: false, message: 'No se pudo obtener el catálogo' });
  }
});

app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = String(req.query.url || '').trim();

  if (!imageUrl) {
    return res.status(400).json({ success: false, message: 'URL de imagen requerida' });
  }

  if (!isAllowedProxyImageUrl(imageUrl) || new URL(imageUrl).pathname.startsWith('/api/')) {
    return res.status(400).json({ success: false, message: 'URL de imagen no permitida' });
  }

  try {
    const response = await fetch(imageUrl, {
      redirect: 'error', // una redirección podría apuntar a un host no permitido
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Carpetazo/1.0 (+https://carpetazo.cl)',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: 'No se pudo obtener la imagen' });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    if (!contentType.toLowerCase().startsWith('image/') || contentType.toLowerCase().includes('svg')) {
      return res.status(415).json({ success: false, message: 'El recurso no es una imagen' });
    }

    const MAX_PROXY_IMAGE_BYTES = 10 * 1024 * 1024;
    if (Number(response.headers.get('content-length') || 0) > MAX_PROXY_IMAGE_BYTES) {
      return res.status(413).json({ success: false, message: 'La imagen es demasiado grande' });
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_PROXY_IMAGE_BYTES) {
      return res.status(413).json({ success: false, message: 'La imagen es demasiado grande' });
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    return res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('Error proxying image:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Error obteniendo imagen' });
  }
});


// Sincronizar o crear usuario en la BD al iniciar sesin
app.post('/api/users/sync', authenticateToken, async (req, res) => {
  try {
    const firebaseUid = req.user.sub;
    const email = req.user.email || '';
    if (!isOptionalText(req.body?.displayName, 100) || !isOptionalText(req.body?.username, 60)) return badRequest(res, 'Datos de usuario inválidos');
    
    let user = await prisma.user.findUnique({
      where: { firebaseUid }
    });
    
    // La misma persona con otro identificador de Firebase (cambió de método de ingreso o se recreó su cuenta de acceso):
    // si su correo está verificado y ya existe una cuenta con él, se reenlaza en vez de crear otra o fallar por correo repetido.
    if (!user && email && req.user.email_verified === true) {
      const sameEmail = await prisma.user.findUnique({ where: { email } });
      if (sameEmail && sameEmail.role !== 'deleted') {
        user = await prisma.user.update({ where: { id: sameEmail.id }, data: { firebaseUid } });
        acceptedCache.delete(sameEmail.firebaseUid);
        console.warn('Cuenta reenlazada por correo verificado: se cambió el identificador de Firebase de ' + sameEmail.id);
      }
    }

    if (!user) {
      // Si el usuario derivado del nombre ya está tomado, se agrega un número: un choque de nombres no debe dejar a nadie sin cuenta
      const chosen = validUsername(req.body.username);
      const derived = validUsername(normalizeUsername(req.body.displayName).slice(0, 20)) || `user_${firebaseUid.slice(0, 12).toLowerCase()}`;
      let username = chosen || derived;
      if (!chosen) {
        for (let attempt = 0; attempt < 8 && (await prisma.user.findUnique({ where: { username }, select: { id: true } })); attempt += 1) {
          const suffix = String(Math.floor(10 + Math.random() * 9990));
          username = derived.slice(0, 20 - suffix.length) + suffix;
        }
      }
      user = await prisma.user.create({
        data: { 
          firebaseUid, 
          email,
          name: req.body.displayName || '',
          username,
          photoURL: isAllowedStoredImageUrl(req.body.photoURL) ? req.body.photoURL : null,
          role: req.user.email_verified === true && isAdminEmail(email) ? 'admin' : 'user'
        }
      });
    } else {
      if (user.role === 'deleted') await prisma.termsAcceptance.deleteMany({ where: { userId: user.id } });
      user = await prisma.user.update({
        where: { firebaseUid },
        data: {
          name: req.body.displayName || user.name,
          username: validUsername(req.body.username) || user.username || validUsername(normalizeUsername(user.name).slice(0, 20)) || `user_${firebaseUid.slice(0, 12).toLowerCase()}`,
          photoURL: user.photoURL || (isAllowedStoredImageUrl(req.body.photoURL) ? req.body.photoURL : null),
          ...(user.role === 'deleted' ? { role: 'user', email: email || user.email } : {}),
          ...(req.user.email_verified === true && isAdminEmail(email) && user.role !== 'admin' ? { role: 'admin' } : {})
        }
      });
    }
    
    res.json({ success: true, user, legal: await getLegalStatus(user) });
  } catch (error) {
    if (error.code === 'P2002') {
      // El correo ya existe y no se pudo comprobar que sea de la misma persona (correo sin verificar): mensaje distinto al del usuario repetido
      if (JSON.stringify(error.meta?.target || '').includes('email')) return res.status(409).json({ success: false, error: 'Ya existe una cuenta con este correo. Verifica tu correo o entra con el método con el que te registraste.' });
      return res.status(409).json({ success: false, error: 'Ese nombre de usuario ya está en uso' });
    }
    console.error('Error syncing user:', error);
    res.status(500).json({ success: false, error: 'Failed to sync user' });
  }
});

app.get('/api/admin/me', authenticateToken, requireStaff(1), async (req, res) => {
  res.json({ success: true, isAdmin: req.staffLevel >= 3, isStaff: true, level: req.staffLevel, role: req.staffLevel >= 3 ? 'admin' : req.dbUser?.role, user: req.dbUser ? { username: req.dbUser.username } : null });
});
const isUuid = (value = '') => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const normalizeOrderItems = (items = []) => {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const quantity = Number(item.quantity ?? item.q ?? 1);
    const price = Number(item.price ?? 0);

    return {
      ...item,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      q: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      price: Number.isFinite(price) ? price : 0
    };
  });
};

const formatOrderForUi = (order) => {
  const items = normalizeOrderItems(order.items || []);
  const createdAt = order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt;
  const updatedAt = order.updatedAt instanceof Date ? order.updatedAt.toISOString() : order.updatedAt;

  return {
    ...order,
    code: order.code || order.id,
    items,
    totalAmount: order.total,
    total: order.total,
    createdAt,
    updatedAt,
    processedAt: order.status !== 'pending' ? updatedAt : undefined
  };
};

const generateOrderCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = Array.from({ length: 5 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    const existing = await prisma.order.findUnique({ where: { code } });
    if (!existing) return code;
  }

  return crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
};

// PUT update card in folder
app.put('/api/folders/:id/cards/:cardId', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
    
    if (!user || !folder || folder.userId !== user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    const { price, stock, data } = req.body;
    if (!isValidPrice(price) || !isValidStock(stock) || !isSmallObject(data)) {
      return badRequest(res, 'Datos de carta inválidos');
    }
    const dataToUpdate = {};
    if (price !== undefined) dataToUpdate.price = parseFloat(price);
    if (stock !== undefined) dataToUpdate.stock = parseInt(stock);
    if (data !== undefined) {
      const existingCard = await prisma.card.findFirst({
        where: { id: req.params.cardId, folderId: req.params.id }
      });
      dataToUpdate.data = {
        ...(existingCard?.data && typeof existingCard.data === 'object' ? existingCard.data : {}),
        ...data
      };
    }
    
    const inFolder = await prisma.card.findFirst({ where: { id: req.params.cardId, folderId: req.params.id }, select: { id: true, moderationState: true } });
    if (!inFolder) return res.status(404).json({ success: false, message: 'Carta no encontrada' });
    if (inFolder.moderationState === 'hidden') return res.status(403).json({ success: false, message: 'Esta carta fue ocultada por moderación.' });

    const card = await prisma.card.update({
      where: { id: req.params.cardId, folderId: req.params.id },
      data: dataToUpdate
    });
    
    res.json({ success: true, card });
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// DELETE card from folder
app.delete('/api/folders/:id/cards/:cardId', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
    
    if (!user || !folder || folder.userId !== user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    const removed = await prisma.card.deleteMany({ where: { id: req.params.cardId, folderId: req.params.id } });
    if (removed.count === 0) return res.status(404).json({ success: false, message: 'Carta no encontrada' });
    
    res.json({ success: true, message: 'Card deleted' });
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// PUT update folder
app.put('/api/folders/:id', authenticateToken, async (req, res) => {
  try {
    const { name, color, tcg, isPublic } = req.body;
    
    // Validar propiedad de la carpeta
    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id }
    });
    
    if (!folder) return res.status(404).json({ success: false, message: 'Carpeta no encontrada' });
    
    const owner = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
    if (!owner || folder.userId !== owner.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (name !== undefined && !isShortText(name, 100)) return badRequest(res, 'Nombre de carpeta inválido');
    if (!isOptionalText(color, 40) || !isOptionalText(tcg, 60)) return badRequest(res, 'Datos de carpeta inválidos');
    if (tcg !== undefined && tcg !== folder.tcg) return badRequest(res, 'El juego de una carpeta no se puede cambiar');
    if (isPublic === true && folder.moderationState !== 'visible') return res.status(403).json({ success: false, message: 'Esta carpeta fue ocultada por moderación. Escríbenos a carpetazo.soporte@gmail.com si crees que fue un error.' });
    if (isPublic !== undefined && typeof isPublic !== 'boolean') return badRequest(res, 'Datos de carpeta inválidos');

    // Actualizar
    const data = {};
    if (name !== undefined) data.name = name;
    if (color !== undefined) data.color = color;
    if (tcg !== undefined) data.tcg = tcg;
    if (isPublic !== undefined) data.isPublic = isPublic;

    const updated = await prisma.folder.update({
      where: { id: req.params.id },
      data
    });

    res.json({ success: true, folder: updated });
  } catch (error) {
    console.error('Error al actualizar carpeta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// PUT folder order: guarda el orden del álbum en una sola transacción (ids de sus cartas, en el orden deseado)
app.put('/api/folders/:id/order', authenticateToken, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Carpeta no encontrada' });
    const owner = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true } });
    if (!folder || !owner || folder.userId !== owner.id) return res.status(404).json({ success: false, message: 'Carpeta no encontrada' });

    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 5000 || ids.some((id) => typeof id !== 'string' || !isUuid(id)) || new Set(ids).size !== ids.length) {
      return badRequest(res, 'Orden inválido');
    }
    const cards = await prisma.card.findMany({ where: { folderId: folder.id }, select: { id: true, data: true } });
    const byId = new Map(cards.map((card) => [card.id, card]));
    if (ids.some((id) => !byId.has(id))) return badRequest(res, 'El orden incluye cartas que no son de esta carpeta');

    // Las cartas que no vengan en la lista quedan al final, en su orden actual
    const listed = new Set(ids);
    const rest = cards.filter((card) => !listed.has(card.id)).sort((a, b) => Number(a.data?.catalogOrder ?? 1e9) - Number(b.data?.catalogOrder ?? 1e9)).map((card) => card.id);
    const finalOrder = [...ids, ...rest];
    await prisma.$transaction(finalOrder.map((id, index) => prisma.card.update({
      where: { id },
      data: { data: { ...(byId.get(id).data && typeof byId.get(id).data === 'object' ? byId.get(id).data : {}), catalogOrder: index } }
    })));
    res.json({ success: true, count: finalOrder.length });
  } catch (error) {
    console.error('Error saving folder order:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// POST create short order code

app.post('/api/orders/create', async (req, res) => {
  try {
    const body = req.body || {};
    const rawItems = Array.isArray(body.items || body.orderItems) ? (body.items || body.orderItems) : [];
    const folderId = typeof body.folderId === 'string' ? body.folderId : '';
    // "message": el pedido llega al vendedor como mensaje de Carpetazo; exige un comprador con sesión
    const viaMessage = body.via === 'message';

    if (!rawItems.length || rawItems.length > 100) {
      return res.status(400).json({ success: false, message: 'El pedido no tiene cartas' });
    }
    if (!folderId) {
      return res.status(400).json({ success: false, message: 'Carpeta requerida' });
    }

    // Con sesión, el pedido queda ligado a la cuenta del comprador (así podrá calificar al vendedor); sin sesión sigue siendo anónimo
    let buyer = null;
    const token = String(req.headers['authorization'] || '').split(' ')[1];
    if (token) {
      try {
        const decoded = await getAuth().verifyIdToken(token);
        buyer = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid }, select: { id: true, name: true, username: true } });
      } catch (_error) {
        buyer = null;
      }
    }
    if (viaMessage) {
      if (!token) return res.status(401).json({ success: false, message: 'Inicia sesión para enviar el pedido por mensaje' });
      if (!buyer) return res.status(401).json({ success: false, message: 'Tu sesión venció o tu cuenta aún se está preparando. Intenta de nuevo' });
    }

    const folder = await prisma.folder.findUnique({ where: { id: folderId }, include: { cards: true } });
    if (!folder || !folder.isPublic) {
      return res.status(404).json({ success: false, message: 'Carpeta no encontrada' });
    }

    // Datos del vendedor: tema (para saber si recibe mensajes y si comparte sus datos bancarios) y datos para transferir
    const seller = await prisma.user.findUnique({ where: { id: folder.userId }, select: { name: true, fullName: true, rut: true, bankDetails: true, publicTheme: true } });
    const sellerTheme = seller?.publicTheme && typeof seller.publicTheme === 'object' ? seller.publicTheme : {};
    // Ningún vendedor puede pedirse a sí mismo (por WhatsApp ni por mensaje)
    if (buyer && folder.userId === buyer.id) return res.status(400).json({ success: false, message: 'No puedes enviarte un pedido a ti mismo' });
    if (viaMessage) {
      if (sellerTheme.showMessageButton === 'off') return res.status(400).json({ success: false, message: 'Este vendedor no recibe pedidos por mensaje' });
    }

    // Anti-spam y reserva: los pedidos pendientes recientes de la carpeta reservan su stock y limitan cuántos puede dejar una misma persona.
    // Con cuenta reservan 7 días; sin cuenta solo 24 horas y con un cupo propio, para que pedidos anónimos no bloqueen el stock ni la carpeta.
    const reserveSince = new Date(Date.now() - ORDER_RESERVE_DAYS * 24 * 60 * 60 * 1000);
    const anonSince = Date.now() - ORDER_ANON_RESERVE_HOURS * 60 * 60 * 1000;
    const pendingOrders = (await prisma.order.findMany({ where: { folderId: folder.id, status: 'pending', createdAt: { gt: reserveSince } }, select: { items: true, createdIpHash: true, buyerId: true, createdAt: true } }))
      .filter((pending) => pending.buyerId || pending.createdAt.getTime() > anonSince);
    const anonPending = pendingOrders.filter((pending) => !pending.buyerId).length;
    if (!buyer && anonPending >= ORDER_MAX_ANON_PENDING_PER_FOLDER) {
      return res.status(429).json({ success: false, message: 'Este vendedor tiene muchos pedidos sin cuenta pendientes. Inicia sesión para hacer tu pedido.' });
    }
    if (buyer && pendingOrders.length - anonPending >= ORDER_MAX_PENDING_PER_FOLDER) {
      return res.status(429).json({ success: false, message: 'Este vendedor tiene muchos pedidos pendientes. Intenta más tarde.' });
    }
    const myConnection = hashConnection(req);
    const mine = pendingOrders.filter((pending) => pending.createdIpHash === myConnection || (buyer && pending.buyerId === buyer.id)).length;
    if (mine >= ORDER_MAX_PENDING_PER_BUYER) {
      return res.status(429).json({ success: false, message: 'Ya tienes pedidos pendientes con este vendedor. Espera a que los atienda.' });
    }
    const reserved = new Map();
    pendingOrders.forEach((pending) => normalizeOrderItems(pending.items).forEach((item) => reserved.set(String(item.id), (reserved.get(String(item.id)) || 0) + Number(item.quantity || 1))));
    const asked = new Map();

    // Nombre, precio y vendedor salen de la base de datos; del cliente solo se acepta id y cantidad
    const cardsById = new Map(folder.cards.map((card) => [card.id, card]));
    const items = [];
    const lines = [];
    let total = 0;
    const clp = (value) => '$' + Math.round(value).toLocaleString('es-CL');
    for (const raw of rawItems) {
      const card = cardsById.get(String(raw?.id ?? ''));
      if (!card) {
        return res.status(400).json({ success: false, message: 'El pedido contiene cartas que ya no están disponibles' });
      }
      const requested = Math.floor(Number(raw.quantity ?? raw.q ?? 1));
      const quantity = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 99) : 1;
      const askedTotal = (asked.get(card.id) || 0) + quantity;
      asked.set(card.id, askedTotal);
      const available = Number(card.stock || 0) - (reserved.get(card.id) || 0);
      if (askedTotal > available) {
        return res.status(409).json({ success: false, message: available <= 0 ? `"${card.name}" ya no está disponible` : `Solo quedan ${available} de "${card.name}"` });
      }
      const price = Number.isFinite(card.price) && card.price > 0 ? card.price : 0;
      total += price * quantity;
      items.push({ id: card.id, name: card.name, quantity, q: quantity, price });
      const set = card.data && typeof card.data === 'object' && typeof card.data.set === 'string' && card.data.set !== 'Unknown' ? ` (${card.data.set.slice(0, 60)})` : '';
      lines.push(`• ${quantity}x ${card.name}${set} - ${clp(price * quantity)}`);
    }

    // Datos para transferir: solo si el vendedor lo activó (por defecto no se envían), y solo a quien acaba de crear un pedido, nunca en rutas públicas
    const bank = seller?.bankDetails && typeof seller.bankDetails === 'object' ? seller.bankDetails : {};
    const payment = bank.accountNumber && sellerTheme.shareBankInOrders === 'on'
      ? { holderName: seller.fullName || seller.name || '', rut: seller.rut || '', bank: bank.bank || '', accountType: bank.accountType || '', accountNumber: bank.accountNumber }
      : null;

    const code = await generateOrderCode();
    const orderData = {
      code,
      sellerId: folder.userId,
      buyerName: viaMessage ? String(buyer.name || buyer.username || 'Cliente').slice(0, 80) : 'Cliente por WhatsApp',
      buyerId: buyer ? buyer.id : null,
      createdIpHash: hashConnection(req),
      folderId: folder.id,
      folderName: folder.name || 'Catálogo',
      items,
      total,
      status: 'pending'
    };

    let order;
    if (viaMessage) {
      const text = [
        `¡Hola! Te hice un pedido desde tu carpeta "${folder.name || 'Catálogo'}" en Carpetazo:`,
        '',
        ...lines,
        '',
        `Total: ${clp(total)}`,
        `Código de pedido: ${code}`,
        ...(payment ? ['', 'Datos para transferir:', [payment.holderName, payment.rut, payment.bank, payment.accountType, payment.accountNumber].filter(Boolean).join('\n')] : []),
        '',
        payment ? '¿Tienes disponibilidad?' : '¿Tienes disponibilidad? ¿Me compartes los datos para transferir?'
      ].join('\n');
      // Pedido y mensaje se crean juntos: no puede quedar uno sin el otro
      [order] = await prisma.$transaction([
        prisma.order.create({ data: orderData }),
        prisma.message.create({ data: { senderId: buyer.id, receiverId: folder.userId, content: JSON.stringify({ v: 1, text, imageUrl: null, imageBase64: null }) } })
      ]);
    } else {
      order = await prisma.order.create({ data: orderData });
    }

    res.json({ success: true, code, order: formatOrderForUi(order), payment, viaMessage });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: 'Error interno al crear el pedido' });
  }
});


// --- Reseñas de vendedores ---
// Solo el comprador de un pedido completado puede calificar, una vez por pedido; la reseña no se edita ni se responde.
const REVIEWS_PAGE_SIZE = 10;
const ORDER_RESERVE_DAYS = 7; // un pedido pendiente de un comprador con cuenta reserva su stock hasta por una semana
const ORDER_ANON_RESERVE_HOURS = 24; // uno sin cuenta, solo un día
const ORDER_MAX_PENDING_PER_FOLDER = 50;
const ORDER_MAX_ANON_PENDING_PER_FOLDER = 15;
const ORDER_MAX_PENDING_PER_BUYER = 3;
// Identificador anónimo de la conexión (hash con sal; no se guarda la IP). Define IP_HASH_SALT en el servidor para que no sea reversible.
const hashConnection = (req) => crypto.createHash('sha256').update(`${process.env.IP_HASH_SALT || 'carpetazo'}|${req.ip || ''}`).digest('hex').slice(0, 32);

app.post('/api/reviews', authenticateToken, async (req, res) => {
  try {
    const reviewerId = await currentUserId(req);
    if (!reviewerId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const { orderId, rating, comment } = req.body || {};
    if (typeof orderId !== 'string' || !isUuid(orderId)) return badRequest(res, 'Pedido inválido');
    const stars = Number(rating);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return badRequest(res, 'Elige de 1 a 5 estrellas');
    if (comment !== undefined && comment !== null && (!isOptionalText(comment, 300) || hasControlChars(String(comment).replace(/[\r\n]/g, ' ')))) return badRequest(res, 'Comentario inválido');
    const text = comment ? String(comment).trim() || null : null;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.buyerId !== reviewerId) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    if (order.sellerId === reviewerId) return badRequest(res, 'No puedes calificarte a ti mismo');
    if (order.status !== 'completed') return badRequest(res, 'Solo puedes calificar pedidos completados');

    // Una reseña por pareja comprador-vendedor: un pedido nuevo al mismo vendedor no suma otra
    const alreadyReviewed = await prisma.sellerReview.findFirst({ where: { sellerId: order.sellerId, reviewerId }, select: { id: true } });
    if (alreadyReviewed) return res.status(409).json({ success: false, message: 'Ya calificaste a este vendedor' });
    // Pedido creado y confirmado desde la misma conexión: la reseña se guarda pero no se muestra ni promedia
    const sameConnection = Boolean(order.createdIpHash && order.completedIpHash && order.createdIpHash === order.completedIpHash);

    let review;
    try {
      review = await prisma.sellerReview.create({ data: { sellerId: order.sellerId, reviewerId, orderId: order.id, rating: stars, comment: text, counts: !sameConnection, flag: sameConnection ? 'same_connection' : null } });
    } catch (error) {
      if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Ya calificaste a este vendedor' });
      throw error;
    }
    if (review.comment) moderationHooks.flagText?.('review', review.id, review.comment, 'review', null);
    res.json({ success: true, review: { id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt } });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Compras completadas del usuario que aún no calificó
app.get('/api/reviews/pending', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const orders = await prisma.order.findMany({
      where: { buyerId: userId, status: 'completed' },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: { id: true, code: true, sellerId: true, folderName: true, updatedAt: true }
    });
    if (orders.length === 0) return res.json({ success: true, pending: [] });
    const reviewed = await prisma.sellerReview.findMany({ where: { reviewerId: userId }, select: { orderId: true, sellerId: true } });
    const reviewedOrders = new Set(reviewed.map((row) => row.orderId));
    const reviewedSellers = new Set(reviewed.map((row) => row.sellerId));
    const seenSellers = new Set();
    // Solo se puede calificar una vez a cada vendedor: se ofrece el pedido más reciente de cada uno que aún no calificaste
    const open = orders.filter((order) => {
      if (reviewedOrders.has(order.id) || reviewedSellers.has(order.sellerId) || seenSellers.has(order.sellerId)) return false;
      seenSellers.add(order.sellerId);
      return true;
    });
    const sellers = open.length
      ? await prisma.user.findMany({ where: { id: { in: [...new Set(open.map((order) => order.sellerId))] } }, select: { id: true, name: true, username: true, photoURL: true } })
      : [];
    const sellerById = new Map(sellers.map((seller) => [seller.id, seller]));
    res.json({
      success: true,
      pending: open.map((order) => ({
        orderId: order.id,
        code: order.code,
        folderName: order.folderName,
        completedAt: order.updatedAt,
        seller: { name: sellerById.get(order.sellerId)?.name || null, username: sellerById.get(order.sellerId)?.username || null, photoURL: sellerById.get(order.sellerId)?.photoURL || null }
      }))
    });
  } catch (error) {
    console.error('Error loading pending reviews:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Reportar una reseña: siempre queda para moderación (/moderacion). Deja de contar y de mostrarse cuando la reportan
// REVIEW_HIDE_REPORTS compradores verificados (con al menos una compra completada) distintos del vendedor calificado:
// así ni el vendedor ni cuentas recién creadas pueden ocultar reseñas por su cuenta.
const REVIEW_HIDE_REPORTS = 2;
app.post('/api/reviews/:id/report', authenticateToken, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    const reporterId = await currentUserId(req);
    if (!reporterId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const reason = req.body?.reason;
    if (!isOptionalText(reason, 200) || (typeof reason === 'string' && hasControlChars(reason.replace(/[\r\n]/g, ' ')))) return badRequest(res, 'Motivo inválido');

    // Solo se pueden reportar reseñas visibles; quien la escribió no puede reportarla
    const review = await prisma.sellerReview.findFirst({ where: { id: req.params.id, counts: true }, select: { id: true, reviewerId: true, sellerId: true } });
    if (!review) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    if (review.reviewerId === reporterId) return badRequest(res, 'No puedes reportar tu propia reseña');

    let hidden = false;
    try {
      hidden = await prisma.$transaction(async (tx) => {
        await tx.reviewReport.create({ data: { reviewId: review.id, reporterId, reason: reason ? String(reason).trim() || null : null } });
        const reporters = await tx.reviewReport.findMany({ where: { reviewId: review.id, reporterId: { not: review.sellerId } }, select: { reporterId: true } });
        const verified = reporters.length
          ? await tx.order.groupBy({ by: ['buyerId'], where: { buyerId: { in: reporters.map((row) => row.reporterId) }, status: 'completed' } })
          : [];
        const hide = verified.length >= REVIEW_HIDE_REPORTS;
        await tx.sellerReview.update({ where: { id: review.id }, data: { flag: 'reported', ...(hide ? { counts: false } : {}) } });
        return hide;
      });
    } catch (error) {
      if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Ya reportaste esta reseña' });
      throw error;
    }
    res.json({ success: true, hidden });
  } catch (error) {
    console.error('Error reporting review:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Reseñas públicas de un vendedor: solo calificación, comentario, fecha y nombre/usuario/foto de quien escribió
app.get('/api/users/:username/reviews', async (req, res) => {
  try {
    const username = typeof req.params.username === 'string' ? req.params.username.trim() : '';
    const page = Number.parseInt(req.query.page, 10) || 1;
    if (!username || username.length > 60 || page < 1 || page > 100) return badRequest(res, 'Consulta inválida');
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) return res.status(404).json({ success: false, message: 'Vendedor no encontrado' });
    const [summary, rows] = await Promise.all([
      getReviewSummary(user.id),
      prisma.sellerReview.findMany({
        where: { sellerId: user.id, counts: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * REVIEWS_PAGE_SIZE,
        take: REVIEWS_PAGE_SIZE,
        select: { id: true, rating: true, comment: true, createdAt: true, reviewer: { select: { name: true, username: true, photoURL: true } } }
      })
    ]);
    res.json({
      success: true,
      ...summary,
      page,
      pages: Math.max(1, Math.ceil(summary.count / REVIEWS_PAGE_SIZE)),
      reviews: rows.map((row) => ({ id: row.id, rating: row.rating, comment: row.comment, createdAt: row.createdAt, reviewer: { name: row.reviewer?.name || null, username: row.reviewer?.username || null, photoURL: row.reviewer?.photoURL || null } }))
    });
  } catch (error) {
    console.error('Error loading reviews:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// --- Moderación de reseñas (solo administradores): reportadas, visibles u ocultas, y las de la misma conexión ---
app.get('/api/admin/reviews', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const rows = await prisma.sellerReview.findMany({
      where: { OR: [{ counts: false }, { flag: 'reported' }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, rating: true, comment: true, counts: true, flag: true, createdAt: true,
        seller: { select: { name: true, username: true } },
        reviewer: { select: { name: true, username: true } },
        reports: { orderBy: { createdAt: 'desc' }, select: { reason: true, createdAt: true } }
      }
    });
    res.json({ success: true, reviews: rows });
  } catch (error) {
    console.error('Error loading reviews for moderation:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Aprobar: vuelve a mostrarse y contar; se borran sus reportes
app.post('/api/admin/reviews/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    const review = await prisma.sellerReview.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!review) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    await prisma.$transaction([
      prisma.reviewReport.deleteMany({ where: { reviewId: review.id } }),
      prisma.sellerReview.update({ where: { id: review.id }, data: { counts: true, flag: null } })
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error approving review:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Eliminar: se borra la reseña (y sus reportes); el comprador podrá volver a calificar a ese vendedor
app.delete('/api/admin/reviews/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    const deleted = await prisma.sellerReview.deleteMany({ where: { id: req.params.id } });
    if (deleted.count === 0) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// --- Pedidos del vendedor: solo ve y gestiona los pedidos de sus propias carpetas ---
const getSellerId = async (req) => {
  const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
  return user?.id || null;
};

app.get('/api/orders/mine', authenticateToken, async (req, res) => {
  try {
    const sellerId = await getSellerId(req);
    if (!sellerId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const orders = await prisma.order.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      take: 1000
    });

    // Imagen, edición, número e idioma actuales de cada carta del pedido
    const cardIds = [...new Set(orders.flatMap((order) => normalizeOrderItems(order.items).map((item) => String(item.id || ''))).filter(isUuid))];
    const cards = cardIds.length
      ? await prisma.card.findMany({ where: { id: { in: cardIds } }, select: { id: true, imageUrl: true, stock: true, data: true } })
      : [];
    const cardsById = new Map(cards.map((card) => [card.id, card]));

    res.json({
      success: true,
      orders: orders.map((order) => {
        const formatted = formatOrderForUi(order);
        return {
          ...formatted,
          items: formatted.items.map((item) => {
            const card = cardsById.get(String(item.id || ''));
            const cardData = card?.data && typeof card.data === 'object' ? card.data : {};
            return {
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              imageUrl: card?.imageUrl || null,
              set: cardData.set || '',
              number: cardData.number || '',
              language: cardData.language || '',
              stockNow: card ? card.stock : null
            };
          })
        };
      })
    });
  } catch (error) {
    console.error('Error loading seller orders:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Solicitudes de compra pendientes del vendedor: consulta liviana para la campana de notificaciones
app.get('/api/orders/mine/pending', authenticateToken, async (req, res) => {
  try {
    const sellerId = await getSellerId(req);
    if (!sellerId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const where = { sellerId, status: 'pending' };
    // "since": fecha (ISO) hasta la que el vendedor ya vio sus solicitudes en la campana
    const sinceRaw = typeof req.query.since === 'string' && req.query.since.length <= 40 ? new Date(req.query.since) : null;
    const since = sinceRaw && !Number.isNaN(sinceRaw.getTime()) ? sinceRaw : null;
    const [count, unseen, latest] = await Promise.all([
      prisma.order.count({ where }),
      since ? prisma.order.count({ where: { ...where, createdAt: { gt: since } } }) : null,
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, code: true, folderName: true, total: true, items: true, createdAt: true }
      })
    ]);

    // Con ETag: si nada cambió responde 304 sin cuerpo
    res.set('Cache-Control', 'private, no-cache');
    res.json({
      success: true,
      count,
      unseen: unseen === null ? count : unseen,
      orders: latest.map((order) => ({
        id: order.id,
        code: order.code,
        folderName: order.folderName,
        total: order.total,
        cards: normalizeOrderItems(order.items).reduce((sum, item) => sum + Number(item.quantity || 1), 0),
        createdAt: order.createdAt
      }))
    });
  } catch (error) {
    console.error('Error loading pending orders:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

app.post('/api/orders/mine/:id/status', authenticateToken, async (req, res) => {
  try {
    const status = req.body?.status;
    if (!['completed', 'rejected'].includes(status)) {
      return badRequest(res, 'Estado inválido');
    }

    const sellerId = await getSellerId(req);
    const order = isUuid(req.params.id) ? await prisma.order.findUnique({ where: { id: req.params.id } }) : null;
    if (!order || !sellerId || order.sellerId !== sellerId) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    if (order.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'Este pedido ya fue gestionado' });
    }

    // Completar descuenta el stock de las cartas de la carpeta en la misma transacción.
    // El cambio de estado se reclama primero (solo si sigue pendiente): dos clics simultáneos no descuentan el stock dos veces.
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({ where: { id: order.id, status: 'pending' }, data: { status } });
      if (claimed.count === 0) return null;
      if (status === 'completed') {
        for (const item of normalizeOrderItems(order.items)) {
          const id = String(item.id || '');
          if (!isUuid(id)) continue;
          const card = await tx.card.findFirst({ where: { id, folderId: order.folderId } });
          if (!card) continue;
          await tx.card.update({ where: { id }, data: { stock: Math.max(0, Number(card.stock || 0) - Number(item.quantity || 1)) } });
        }
      }
      return tx.order.update({ where: { id: order.id }, data: { status, ...(status === 'completed' ? { completedIpHash: hashConnection(req) } : {}) } });
    });
    if (!updated) return res.status(409).json({ success: false, message: 'Este pedido ya fue gestionado' });

    res.json({ success: true, order: formatOrderForUi(updated) });
  } catch (error) {
    console.error('Error updating seller order:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// --- POKEMON TCG API PROXY CON CACHÉ ---
const tcgCache = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hora en milisegundos
const TCG_CACHE_MAX = 200; // tope de entradas: consultas distintas no pueden llenar la memoria
const setTcgCache = (key, data) => {
  if (tcgCache.size >= TCG_CACHE_MAX) tcgCache.delete(tcgCache.keys().next().value);
  tcgCache.set(key, { timestamp: Date.now(), data });
};

app.get('/api/tcg/sets', async (req, res) => {
    const cacheKey = 'sets';
    
    if (tcgCache.has(cacheKey)) {
        const cached = tcgCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            return res.json(cached.data);
        }
    }
    
    try {
        const fetchOptions = process.env.POKEMON_TCG_API_KEY ? { headers: { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } } : {};
          const response = await fetch('https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate', fetchOptions);
        if (!response.ok) throw new Error('Error fetching sets');
        const data = await response.json();
        
        setTcgCache(cacheKey, data);
        res.json(data);
    } catch (error) {
        console.error('TCG API Sets Error:', error);
        res.status(500).json({ error: 'Failed to fetch sets' });
    }
});

app.get('/api/tcg/cards', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (query.length > 200) return badRequest(res, 'Búsqueda inválida');
    const cacheKey = `cards_${query}`;
    
    if (tcgCache.has(cacheKey)) {
        const cached = tcgCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            return res.json(cached.data);
        }
    }
    
    try {
        const url = query 
            ? `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}` 
            : 'https://api.pokemontcg.io/v2/cards';
            
        const fetchOptions = process.env.POKEMON_TCG_API_KEY ? { headers: { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } } : {};
          const response = await fetch(url, fetchOptions);
        if (!response.ok) throw new Error('Error fetching cards');
        const data = await response.json();
        
        setTcgCache(cacheKey, data);
        res.json(data);
    } catch (error) {
        console.error('TCG API Cards Error:', error);
        res.status(500).json({ error: 'Failed to fetch cards' });
    }
});


// ==========================================
// NUEVAS RUTAS PRISMA (REEMPLAZO FIRESTORE)
// ==========================================

// --- CARPETAS ---

// Obtener mis carpetas
app.get('/api/folders/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const folders = await prisma.folder.findMany({
      where: { userId: user.id },
      include: { _count: { select: { cards: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, folders });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Visitas de las carpetas del usuario: consulta liviana para el contador en tiempo real del panel
app.get('/api/folders/me/stats', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const folders = await prisma.folder.findMany({
      where: { userId: user.id },
      select: { id: true, weeklyVisits: true, lastVisitWeek: true, totalVisits: true }
    });
    // "no-cache" obliga a revalidar con ETag: sin cambios responde 304 sin cuerpo
    res.set('Cache-Control', 'private, no-cache');
    res.json({ success: true, week: Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7)), folders });
  } catch (error) {
    console.error('Error loading folder stats:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Juegos válidos de una carpeta (así se guardan en Folder.tcg)
const FOLDER_TCGS = ['Pokemon', 'Mitos y Leyendas', 'Magic', 'YuGiOh', 'OnePiece'];

// Crear carpeta
app.post('/api/folders', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const { name, description, isPublic, tcg, color } = req.body;
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (!isShortText(name, 100) || !isOptionalText(description, 1000) || !isOptionalText(tcg, 60) || !isOptionalText(color, 40)
      || (tcg !== undefined && tcg !== null && !FOLDER_TCGS.includes(tcg))
      || (isPublic !== undefined && typeof isPublic !== 'boolean')) {
      return badRequest(res, 'Datos de carpeta inválidos');
    }
    
    const folder = await prisma.folder.create({
      data: {
        name,
        description,
        isPublic: isPublic !== undefined ? isPublic : false,
        userId: user.id,
        tcg: tcg || 'Pokemon',
        color: color || 'red'
      }
    });
    res.json({ success: true, folder });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Obtener detalles de una carpeta (y sus cartas)
// --- Vistas públicas: nunca se devuelve la entidad de la base de datos ---
// Cualquier campo que no esté en estas listas NO sale por las rutas públicas (correo, RUT, banco, rol, firebaseUid…).
const optionalAuth = async (req, _res, next) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (token) {
    try {
      req.user = await getAuth().verifyIdToken(token);
      req.user.sub = req.user.uid;
    } catch (_error) {
      // token inválido o vencido: se trata como visitante anónimo
    }
  }
  next();
};

const PUBLIC_SELLER_SELECT = {
  id: true,
  username: true,
  name: true,
  fullName: true,
  photoURL: true,
  bio: true,
  bannerBase64: true,
  wallpaperBase64: true,
  bannerDominantColor: true,
  bannerComplementaryColor: true,
  publicTheme: true,
  facebookUrl: true,
  instagramUrl: true,
  youtubeUrl: true,
  phone: true,
  addresses: true,
  createdAt: true,
  firebaseUid: true // solo para calcular isOwner; el serializador lo elimina
};

// Promedio y cantidad de reseñas de un vendedor
const REVIEW_MIN_FOR_AVERAGE = 3; // con menos reseñas no se muestra promedio: una o dos falsas no inflan la nota
const getReviewSummary = async (userId) => {
  const aggregate = await prisma.sellerReview.aggregate({ where: { sellerId: userId, counts: true }, _avg: { rating: true }, _count: { _all: true } });
  const count = aggregate._count._all;
  const showAverage = count >= REVIEW_MIN_FOR_AVERAGE && aggregate._avg.rating !== null;
  return { average: showAverage ? Math.round(aggregate._avg.rating * 10) / 10 : null, count, showAverage };
};

const toPublicSeller = (user, viewerUid = null, reviewSummary = null) => {
  if (!user) return null;
  const theme = user.publicTheme && typeof user.publicTheme === 'object' ? user.publicTheme : {};
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    fullName: user.fullName,
    photoURL: user.photoURL,
    bio: user.bio,
    bannerBase64: user.bannerBase64,
    wallpaperBase64: user.wallpaperBase64,
    bannerDominantColor: user.bannerDominantColor,
    bannerComplementaryColor: user.bannerComplementaryColor,
    publicTheme: user.publicTheme,
    facebookUrl: user.facebookUrl,
    instagramUrl: user.instagramUrl,
    youtubeUrl: user.youtubeUrl,
    // El teléfono solo sale si el vendedor dejó activo el botón de WhatsApp
    phone: theme.showWhatsApp !== 'off' ? user.phone : null,
    // Solo ciudad/región: calle, número y referencias son privados
    addresses: Array.isArray(user.addresses)
      ? user.addresses.map((a) => ({ name: a?.name || '', comuna: a?.comuna || '', region: a?.region || '', isDefault: Boolean(a?.isDefault) }))
      : [],
    createdAt: user.createdAt,
    isOwner: Boolean(viewerUid && user.firebaseUid && user.firebaseUid === viewerUid),
    reviewSummary: reviewSummary || { average: null, count: 0, showAverage: false }
  };
};

// --- Listados públicos paginados (carpetas, vendedores y destacados de Inicio): se filtran y ordenan en la base ---
const FOLDERS_PAGE_SIZE = 40;
const SELLERS_PAGE_SIZE = 24;
const currentWeekNumber = () => Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
// Texto de búsqueda seguro para ILIKE (se escapan \, % y _)
const likePattern = (text) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;
// Un juego puede estar guardado con otro nombre en las carpetas (Pokemon / Pokémon, YuGiOh / Yu-Gi-Oh!, OnePiece / One Piece)
const tcgVariants = (name) => {
  const stored = CARD_SEARCH_TCG_ALIASES[name];
  const shown = Object.entries(CARD_SEARCH_TCG_ALIASES).find(([, value]) => value === name)?.[0];
  return [...new Set([name, stored, shown].filter(Boolean))];
};
const validListText = (...texts) => texts.every((text) => text.length <= 80 && !/[\u0000-\u001f]/.test(text));

// Carpetas públicas con dueño y cantidad de cartas, en el orden de los ids recibidos
const loadPublicFolders = async (ids) => {
  if (ids.length === 0) return [];
  const week = currentWeekNumber();
  const rows = await prisma.folder.findMany({
    where: { id: { in: ids }, isPublic: true },
    select: {
      id: true, name: true, tcg: true, color: true, createdAt: true, totalVisits: true, weeklyVisits: true, lastVisitWeek: true,
      user: { select: { name: true, username: true, photoURL: true } },
      _count: { select: { cards: true } }
    }
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.filter((id) => byId.has(id)).map((id) => {
    const row = byId.get(id);
    return { ...row, validWeeklyVisits: row.lastVisitWeek === week ? row.weeklyVisits : 0, validTotalVisits: row.totalVisits };
  });
};

const folderFilterSql = ({ like, tcgs }) => Prisma.sql`f."isPublic" = true
  ${like ? Prisma.sql`AND (f."name" ILIKE ${like} OR u."name" ILIKE ${like} OR u."username" ILIKE ${like})` : Prisma.empty}
  ${tcgs ? Prisma.sql`AND f."tcg" = ANY(${tcgs})` : Prisma.empty}`;
const folderOrderSql = (sort) => {
  if (sort === 'name') return Prisma.sql`LOWER(f."name") ASC, f."createdAt" DESC`;
  if (sort === 'total') return Prisma.sql`f."totalVisits" DESC, f."createdAt" DESC`;
  return Prisma.sql`(CASE WHEN f."lastVisitWeek" = ${currentWeekNumber()} THEN f."weeklyVisits" ELSE 0 END) DESC, f."totalVisits" DESC, f."createdAt" DESC`;
};

app.get('/api/folders/search', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const tcgRaw = typeof req.query.tcg === 'string' ? req.query.tcg.trim() : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'weekly';
    const page = Number.parseInt(req.query.page, 10) || 1;
    if (!validListText(q, tcgRaw) || !['weekly', 'total', 'name'].includes(sort) || page < 1 || page > 1000) return badRequest(res, 'Búsqueda inválida');

    const filter = folderFilterSql({ like: q ? likePattern(q) : null, tcgs: tcgRaw ? tcgVariants(tcgRaw) : null });
    const [idRows, totalRows, tcgRows] = await Promise.all([
      prisma.$queryRaw`SELECT f."id" FROM "Folder" f JOIN "User" u ON u."id" = f."userId" WHERE ${filter} ORDER BY ${folderOrderSql(sort)} LIMIT ${FOLDERS_PAGE_SIZE} OFFSET ${(page - 1) * FOLDERS_PAGE_SIZE}`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM "Folder" f JOIN "User" u ON u."id" = f."userId" WHERE ${filter}`,
      prisma.$queryRaw`SELECT f."tcg", COUNT(*)::int AS n FROM "Folder" f WHERE f."isPublic" = true GROUP BY f."tcg"`
    ]);
    const total = totalRows[0]?.n || 0;
    res.json({
      success: true,
      folders: await loadPublicFolders(idRows.map((row) => row.id)),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / FOLDERS_PAGE_SIZE)),
      counts: tcgRows.map((row) => ({ tcg: row.tcg, count: row.n }))
    });
  } catch (error) {
    console.error('Error searching folders:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Vendedores = dueños de carpetas públicas, con sus cifras sumadas
const querySellers = ({ like, sort, limit, offset }) => {
  const filter = Prisma.sql`1 = 1 ${like ? Prisma.sql`AND (u."name" ILIKE ${like} OR u."username" ILIKE ${like})` : Prisma.empty}`;
  const order = sort === 'name' ? Prisma.sql`LOWER(u."name") ASC` : sort === 'cards' ? Prisma.sql`cards DESC, visits DESC` : Prisma.sql`visits DESC, cards DESC`;
  return Promise.all([
    prisma.$queryRaw`
      SELECT u."name", u."username", u."photoURL",
             COUNT(f."id")::int AS folders,
             COALESCE(SUM(c.cnt), 0)::int AS cards,
             COALESCE(SUM(f."totalVisits"), 0)::int AS visits,
             ARRAY_AGG(DISTINCT f."tcg") AS tcgs
      FROM "User" u
      JOIN "Folder" f ON f."userId" = u."id" AND f."isPublic" = true
      LEFT JOIN (SELECT "folderId", COUNT(*) AS cnt FROM "Card" GROUP BY "folderId") c ON c."folderId" = f."id"
      WHERE ${filter}
      GROUP BY u."id"
      ORDER BY ${order}
      LIMIT ${limit} OFFSET ${offset}`,
    prisma.$queryRaw`SELECT COUNT(DISTINCT u."id")::int AS n FROM "User" u JOIN "Folder" f ON f."userId" = u."id" AND f."isPublic" = true WHERE ${filter}`
  ]);
};

app.get('/api/sellers', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'visits';
    const page = Number.parseInt(req.query.page, 10) || 1;
    if (!validListText(q) || !['visits', 'cards', 'name'].includes(sort) || page < 1 || page > 1000) return badRequest(res, 'Búsqueda inválida');
    const [rows, totalRows] = await querySellers({ like: q ? likePattern(q) : null, sort, limit: SELLERS_PAGE_SIZE, offset: (page - 1) * SELLERS_PAGE_SIZE });
    const total = totalRows[0]?.n || 0;
    res.json({ success: true, sellers: rows, total, page, pages: Math.max(1, Math.ceil(total / SELLERS_PAGE_SIZE)) });
  } catch (error) {
    console.error('Error loading sellers:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Todo lo que muestra la portada: cifras, carpetas por juego, más visitadas, nuevas y mejores vendedores
app.get('/api/home/featured', async (_req, res) => {
  try {
    const filter = folderFilterSql({ like: null, tcgs: null });
    const [visitedIds, newestIds, tcgRows, statRows, sellerResult] = await Promise.all([
      prisma.$queryRaw`SELECT f."id" FROM "Folder" f JOIN "User" u ON u."id" = f."userId" WHERE ${filter} ORDER BY ${folderOrderSql('weekly')} LIMIT 5`,
      prisma.$queryRaw`SELECT f."id" FROM "Folder" f JOIN "User" u ON u."id" = f."userId" WHERE ${filter} ORDER BY f."createdAt" DESC LIMIT 5`,
      prisma.$queryRaw`SELECT f."tcg", COUNT(*)::int AS n FROM "Folder" f WHERE f."isPublic" = true GROUP BY f."tcg"`,
      prisma.$queryRaw`SELECT COUNT(DISTINCT f."id")::int AS folders, COUNT(DISTINCT f."userId")::int AS sellers, (SELECT COUNT(*) FROM "Card" c JOIN "Folder" f2 ON f2."id" = c."folderId" AND f2."isPublic" = true)::int AS cards FROM "Folder" f WHERE f."isPublic" = true`,
      querySellers({ like: null, sort: 'visits', limit: 5, offset: 0 })
    ]);
    const stats = statRows[0] || { folders: 0, sellers: 0, cards: 0 };
    res.json({
      success: true,
      stats: { folders: stats.folders, sellers: stats.sellers, cards: stats.cards },
      counts: tcgRows.map((row) => ({ tcg: row.tcg, count: row.n })),
      visited: await loadPublicFolders(visitedIds.map((row) => row.id)),
      newest: await loadPublicFolders(newestIds.map((row) => row.id)),
      topSellers: sellerResult[0]
    });
  } catch (error) {
    console.error('Error loading featured:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

app.get('/api/folders/:id', optionalAuth, async (req, res) => {
  try {
    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id },
      include: {
        cards: {
          where: { moderationState: { in: ['visible', 'image_hidden'] } },
          orderBy: { createdAt: 'asc' }
        },
        user: { select: PUBLIC_SELLER_SELECT }
      }
    });
    // Una carpeta privada no existe para nadie más que su dueño (mismo 404 que una carpeta inexistente)
    const isFolderOwner = Boolean(req.user?.sub && folder?.user?.firebaseUid && folder.user.firebaseUid === req.user.sub);
    if (!folder || (!folder.isPublic && !isFolderOwner)) return res.status(404).json({ success: false, message: 'Folder not found' });
    // El estado de moderación solo lo ve el dueño; para los demás no se serializa
    const { moderationState: _folderState, ...publicFolder } = folder;
    const cards = isFolderOwner ? folder.cards : folder.cards.map(({ moderationState: _cardState, ...card }) => card);
    res.json({ success: true, folder: { ...(isFolderOwner ? folder : publicFolder), cards, user: toPublicSeller(folder.user, req.user?.sub, await getReviewSummary(folder.user.id)) } });
  } catch (error) {
    console.error('Error fetching folder:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

  // Registrar visita a carpeta
  const recentVisits = new Map();
  app.post('/api/folders/:id/visit', async (req, res) => {
    try {
      const folderId = req.params.id;
      const currentWeek = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));

      // Una visita por IP y carpeta cada 30 minutos (evita inflar el contador)
      const visitKey = `${req.ip}|${folderId}`;
      const now = Date.now();
      if ((recentVisits.get(visitKey) || 0) > now - 30 * 60 * 1000) return res.json({ success: true });
      recentVisits.set(visitKey, now);
      if (recentVisits.size > 5000) {
        for (const [key, time] of recentVisits) if (time < now - 30 * 60 * 1000) recentVisits.delete(key);
      }
      
      // Solo cuentan las visitas a carpetas públicas
      const folder = await prisma.folder.findUnique({ where: { id: folderId }, select: { isPublic: true, lastVisitWeek: true } });
      if (!folder || !folder.isPublic) return res.status(404).json({ success: false });

      if (folder.lastVisitWeek !== currentWeek) {
        await prisma.folder.update({
          where: { id: folderId },
          data: { weeklyVisits: 1, lastVisitWeek: currentWeek, totalVisits: { increment: 1 } }
        });
      } else {
        await prisma.folder.update({
          where: { id: folderId },
          data: { weeklyVisits: { increment: 1 }, totalVisits: { increment: 1 } }
        });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error registering visit:', error);
      res.status(500).json({ success: false });
    }
  });

  // Borrar carpeta
app.delete('/api/folders/:id', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
    
    if (!user || !folder || folder.userId !== user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    await prisma.folder.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Folder deleted' });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// --- CARTAS DE CARPETAS ---

// Agregar carta a una carpeta
app.post('/api/folders/:id/cards', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
    
    if (!user || !folder || folder.userId !== user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    const { tcgId, name, imageUrl, price, stock, data } = req.body;
    if (!isShortText(String(tcgId ?? ''), 100) || !isShortText(name, 300) || !isValidPrice(price) || !isValidStock(stock) || !isSmallObject(data)) {
      return badRequest(res, 'Datos de carta inválidos');
    }
    if (imageUrl && !isAllowedStoredImageUrl(imageUrl)) {
      return res.status(400).json({ success: false, error: 'URL de imagen no permitida' });
    }
      
      const card = await prisma.card.create({
        data: {
          tcgId,
          name,
          imageUrl,
          price: parseFloat(price) || null,
          stock: stock !== undefined ? parseInt(stock) : 1,
          data: data || null,
          folderId: folder.id
        }
      });
    res.json({ success: true, card });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Borrar carta de una carpeta
app.delete('/api/cards/:id', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const card = await prisma.card.findUnique({ 
      where: { id: req.params.id },
      include: { folder: true }
    });
    
    if (!user || !card || card.folder.userId !== user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    await prisma.card.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Card deleted' });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});


// --- RUTAS PÚBLICAS Y MENSAJES ---

// Obtener todas las carpetas pblicas
// Cartas subidas más recientemente en carpetas públicas (portada)
app.get('/api/cards/recent', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
    const cards = await prisma.card.findMany({
      where: { stock: { gt: 0 }, imageUrl: { not: null }, moderationState: 'visible', folder: { isPublic: true } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        imageUrl: true,
        price: true,
        stock: true,
        createdAt: true,
        data: true,
        folder: {
          select: {
            id: true,
            name: true,
            tcg: true,
            user: { select: { name: true, username: true, photoURL: true } }
          }
        }
      }
    });

    // Solo campos públicos: el JSON `data` de la carta puede traer más cosas
    res.json({
      success: true,
      cards: cards.map(({ data, ...card }) => ({
        ...card,
        language: data && typeof data === 'object' ? data.language || null : null,
        set: data && typeof data === 'object' ? data.set || null : null
      }))
    });
  } catch (error) {
    console.error('Error loading recent cards:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// --- Lista de cartas deseadas ---
const WISHLIST_MAX_ITEMS = 200;
const WISHLIST_PAGE_SIZE = 24;
const WISHLIST_GAMES = ['Pokémon', 'Mitos y Leyendas', 'One Piece', 'Magic', 'Yu-Gi-Oh!', 'Riftbound'];
const WISHLIST_GAME_BY_CATEGORY = { 1: 'Pokémon', 99: 'Mitos y Leyendas' };
const WISHLIST_OWN_SELECT = { id: true, categoryId: true, productId: true, name: true, game: true, detail: true, imageUrl: true, quantity: true, maxPrice: true, priceVisible: true, note: true, createdAt: true };
const hasControlChars = (text) => /[\u0000-\u001f]/.test(text);

const currentUserId = async (req) => {
  const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
  return user?.id || null;
};

// Juego: solo los de la lista del sitio ("Pokemon" sin tilde se acepta). null = sin juego; undefined = inválido
const normalizeWishlistGame = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const GAME_ALIASES = { Pokemon: 'Pokémon', YuGiOh: 'Yu-Gi-Oh!', OnePiece: 'One Piece' }; // nombres con que se guardan las carpetas
  const game = GAME_ALIASES[value.trim()] || value.trim();
  return WISHLIST_GAMES.includes(game) ? game : undefined;
};

// Cantidad, precio máximo, visibilidad del precio y nota: se validan igual al crear y al editar
const parseWishlistFields = (body) => {
  const out = {};
  if (body.quantity !== undefined) {
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return { error: 'Cantidad inválida' };
    out.quantity = quantity;
  }
  if (body.maxPrice !== undefined) {
    if (body.maxPrice === null || body.maxPrice === '') out.maxPrice = null;
    else if (!isValidPrice(body.maxPrice)) return { error: 'Precio inválido' };
    else out.maxPrice = Number(body.maxPrice);
  }
  if (body.priceVisible !== undefined) {
    if (typeof body.priceVisible !== 'boolean') return { error: 'Dato inválido' };
    out.priceVisible = body.priceVisible;
  }
  if (body.note !== undefined) {
    if (body.note !== null && (!isOptionalText(body.note, 140) || hasControlChars(String(body.note).replace(/[\r\n]/g, ' ')))) return { error: 'Nota inválida' };
    out.note = body.note ? String(body.note).trim() || null : null;
  }
  return { data: out };
};

app.get('/api/wishlist/me', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const items = await prisma.wishlistItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: WISHLIST_MAX_ITEMS, select: WISHLIST_OWN_SELECT });
    res.json({ success: true, items, limit: WISHLIST_MAX_ITEMS });
  } catch (error) {
    console.error('Error loading wishlist:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Cartas de la lista que hoy tienen otros vendedores (catálogos públicos, con stock y dentro del precio máximo)
const WISHLIST_MATCH_TCG = { 1: 'Pokemon', 99: 'Mitos y Leyendas' };
const WISHLIST_MATCHES_PER_ITEM = 5;
app.get('/api/wishlist/matches', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const items = await prisma.wishlistItem.findMany({ where: { userId, productId: { not: null } }, take: WISHLIST_MAX_ITEMS, select: { id: true, categoryId: true, productId: true, maxPrice: true } });
    // tcgId de la carta = id del producto (las del catálogo de Pokémon se guardan como `tcgcsv:<cat>:<id>`)
    const wanted = items.map((item) => ({ ...item, tcgId: String(item.productId).replace(/^tcgcsv:\d+:/, ''), tcg: WISHLIST_MATCH_TCG[item.categoryId] })).filter((item) => item.tcg && /^\d{1,12}$/.test(item.tcgId));
    if (wanted.length === 0) return res.json({ success: true, matches: {} });

    const cards = await prisma.card.findMany({
      where: { stock: { gt: 0 }, price: { not: null }, moderationState: 'visible', tcgId: { in: [...new Set(wanted.map((item) => item.tcgId))] }, folder: { isPublic: true, userId: { not: userId } } },
      orderBy: { price: 'asc' },
      take: 2000,
      select: { id: true, tcgId: true, price: true, stock: true, folder: { select: { id: true, name: true, tcg: true, user: { select: { name: true, username: true, photoURL: true } } } } },
    });
    const matches = {};
    wanted.forEach((item) => {
      const found = cards.filter((card) => card.tcgId === item.tcgId && card.folder.tcg === item.tcg && (item.maxPrice == null || card.price <= item.maxPrice));
      if (found.length === 0) return;
      matches[item.id] = {
        count: found.length,
        offers: found.slice(0, WISHLIST_MATCHES_PER_ITEM).map((card) => ({
          cardId: card.id, price: card.price, stock: card.stock,
          folder: { id: card.folder.id, name: card.folder.name },
          seller: { name: card.folder.user.name, username: card.folder.user.username, photoURL: card.folder.user.photoURL },
        })),
      };
    });
    res.json({ success: true, matches });
  } catch (error) {
    console.error('Error loading wishlist matches:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

app.post('/api/wishlist', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const { productId, name, imageUrl, external } = req.body || {};
    const parsed = parseWishlistFields(req.body || {});
    if (parsed.error) return badRequest(res, parsed.error);
    if (productId !== undefined && productId !== null && (typeof productId !== 'string' || productId.length > 40 || hasControlChars(productId))) return badRequest(res, 'Carta inválida');
    const game = normalizeWishlistGame(req.body?.game);
    if (game === undefined) return badRequest(res, 'Juego inválido');
    const rawDetail = req.body?.detail;
    if (rawDetail !== undefined && rawDetail !== null && (!isOptionalText(rawDetail, 100) || hasControlChars(String(rawDetail)))) return badRequest(res, 'Detalle inválido');
    const detail = rawDetail ? String(rawDetail).trim() || null : null;

    // Carta del catálogo propio (Mitos y Leyendas, Pokémon del catálogo): nombre, imagen, juego y edición salen de la base
    const catalog = productId
      ? await prisma.tcgProduct.findUnique({ where: { productId }, select: { productId: true, name: true, imageUrl: true, categoryId: true, group: { select: { name: true } } } })
      : null;
    let identity;
    if (catalog) {
      identity = { productId: catalog.productId, categoryId: catalog.categoryId, name: catalog.name, game: WISHLIST_GAME_BY_CATEGORY[catalog.categoryId] || game, detail: catalog.group?.name || detail, imageUrl: catalog.imageUrl || null };
    } else if (external !== undefined) {
      // Pokémon de TCGCSV (inglés 3, japonés 85): el catálogo no está en la base, el identificador se valida por forma
      const externalCategory = Number(external?.categoryId);
      const externalId = typeof external?.productId === 'string' || typeof external?.productId === 'number' ? String(external.productId) : '';
      if (![3, 85].includes(externalCategory) || !/^\d{1,12}$/.test(externalId)) return badRequest(res, 'Carta inválida');
      if (!isShortText(name, 100) || hasControlChars(name)) return badRequest(res, 'Carta inválida');
      identity = { productId: `tcgcsv:${externalCategory}:${externalId}`, categoryId: 1, name: name.trim(), game: 'Pokémon', detail, imageUrl: imageUrl && isAllowedStoredImageUrl(imageUrl) ? imageUrl : null };
    } else {
      if (!isShortText(name, 100) || hasControlChars(name)) return badRequest(res, 'Escribe el nombre de la carta');
      identity = { productId: null, categoryId: null, name: name.trim(), game, detail, imageUrl: imageUrl && isAllowedStoredImageUrl(imageUrl) ? imageUrl : null };
    }

    const item = await prisma.$transaction(async (tx) => {
      const existing = identity.productId
        ? await tx.wishlistItem.findUnique({ where: { userId_productId: { userId, productId: identity.productId } } })
        : await tx.wishlistItem.findFirst({ where: { userId, productId: null, detail: identity.detail, name: { equals: identity.name, mode: 'insensitive' } } });
      if (existing) {
        // La misma carta no se duplica: se suma a la cantidad que ya buscaba
        const quantity = Math.min(99, existing.quantity + (parsed.data.quantity ?? 1));
        return tx.wishlistItem.update({ where: { id: existing.id }, data: { ...parsed.data, quantity }, select: WISHLIST_OWN_SELECT });
      }
      if ((await tx.wishlistItem.count({ where: { userId } })) >= WISHLIST_MAX_ITEMS) return null;
      return tx.wishlistItem.create({ data: { userId, ...identity, ...parsed.data }, select: WISHLIST_OWN_SELECT });
    });
    if (!item) return badRequest(res, `Tu lista ya tiene ${WISHLIST_MAX_ITEMS} cartas. Quita alguna para agregar más.`);
    res.json({ success: true, item });
  } catch (error) {
    console.error('Error adding wishlist item:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

app.put('/api/wishlist/:id', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const parsed = parseWishlistFields(req.body || {});
    if (parsed.error) return badRequest(res, parsed.error);
    const owned = await prisma.wishlistItem.findFirst({ where: { id: req.params.id, userId }, select: { id: true } });
    if (!owned) return res.status(404).json({ success: false, message: 'Carta no encontrada' });
    const item = await prisma.wishlistItem.update({ where: { id: owned.id }, data: parsed.data, select: WISHLIST_OWN_SELECT });
    res.json({ success: true, item });
  } catch (error) {
    console.error('Error updating wishlist item:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

app.delete('/api/wishlist/:id', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const removed = await prisma.wishlistItem.deleteMany({ where: { id: req.params.id, userId } });
    if (removed.count === 0) return res.status(404).json({ success: false, message: 'Carta no encontrada' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting wishlist item:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Lista pública de un jugador: solo si no la ocultó, y sin ningún dato privado
app.get('/api/users/:username/wishlist', async (req, res) => {
  try {
    const username = typeof req.params.username === 'string' ? req.params.username.trim() : '';
    const page = Number.parseInt(req.query.page, 10) || 1;
    if (!username || username.length > 60 || page < 1 || page > 100) return badRequest(res, 'Consulta inválida');
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true, publicTheme: true } });
    if (!user) return res.status(404).json({ success: false, message: 'Vendedor no encontrado' });
    const theme = user.publicTheme && typeof user.publicTheme === 'object' ? user.publicTheme : {};
    if (theme.showWishlist === 'off') return res.json({ success: true, hidden: true, total: 0, page: 1, pages: 1, items: [] });

    const [total, rows] = await prisma.$transaction([
      prisma.wishlistItem.count({ where: { userId: user.id, moderationState: 'visible' } }),
      prisma.wishlistItem.findMany({
        where: { userId: user.id, moderationState: 'visible' },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * WISHLIST_PAGE_SIZE,
        take: WISHLIST_PAGE_SIZE,
        select: WISHLIST_OWN_SELECT,
      }),
    ]);
    res.json({
      success: true,
      hidden: false,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / WISHLIST_PAGE_SIZE)),
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        imageUrl: row.imageUrl,
        quantity: row.quantity,
        note: row.note,
        maxPrice: row.priceVisible ? row.maxPrice : null,
        tcg: row.game || WISHLIST_GAME_BY_CATEGORY[row.categoryId] || null,
        detail: row.detail,
      })),
    });
  } catch (error) {
    console.error('Error loading public wishlist:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Búsqueda pública de cartas a la venta (solo carpetas públicas y con stock)
const CARD_SEARCH_PAGE_SIZE = 24;
// Las carpetas guardan el juego como Pokemon / YuGiOh / OnePiece; el sitio lo muestra como Pokémon / Yu-Gi-Oh! / One Piece
const CARD_SEARCH_TCG_ALIASES = { 'Pokémon': 'Pokemon', 'Yu-Gi-Oh!': 'YuGiOh', 'One Piece': 'OnePiece' };
const CARD_SEARCH_SORTS = {
  recent: [{ createdAt: 'desc' }],
  price_asc: [{ price: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
  price_desc: [{ price: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
};
app.get('/api/cards/search', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const tcgRaw = typeof req.query.tcg === 'string' ? req.query.tcg.trim() : '';
    const tcg = CARD_SEARCH_TCG_ALIASES[tcgRaw] || tcgRaw;
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'recent';
    const page = Number.parseInt(req.query.page, 10) || 1;
    if (q.length > 80 || tcg.length > 60 || /[\u0000-\u001f]/.test(q + tcg) || !Object.hasOwn(CARD_SEARCH_SORTS, sort) || page < 1 || page > 1000) {
      return badRequest(res, 'Búsqueda inválida');
    }

    const where = {
      stock: { gt: 0 },
      moderationState: 'visible',
      folder: { isPublic: true, ...(tcg ? { tcg } : {}) },
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    };
    const [total, cards] = await prisma.$transaction([
      prisma.card.count({ where }),
      prisma.card.findMany({
        where,
        orderBy: CARD_SEARCH_SORTS[sort],
        skip: (page - 1) * CARD_SEARCH_PAGE_SIZE,
        take: CARD_SEARCH_PAGE_SIZE,
        select: {
          id: true,
          name: true,
          tcgId: true,
          imageUrl: true,
          price: true,
          stock: true,
          data: true,
          folder: { select: { id: true, name: true, tcg: true, user: { select: { name: true, username: true, photoURL: true } } } },
        },
      }),
    ]);

    // Solo campos públicos: el JSON `data` de la carta puede traer más cosas
    res.json({
      success: true,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / CARD_SEARCH_PAGE_SIZE)),
      cards: cards.map(({ data, ...card }) => ({
        ...card,
        language: data && typeof data === 'object' ? data.language || null : null,
        set: data && typeof data === 'object' ? data.set || null : null,
      })),
    });
  } catch (error) {
    console.error('Error searching cards:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

app.get('/api/folders', async (req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      where: { isPublic: true },
      include: { user: { select: { name: true, username: true, photoURL: true } }, _count: { select: { cards: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, folders });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Enviar un mensaje
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const sender = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const { receiverId, content } = req.body;
    
    if (!receiverId || !content) return res.status(400).json({ success: false, message: 'Missing fields' });
    if (typeof receiverId !== 'string' || !isAllowedMessageContent(content)) return badRequest(res, 'Mensaje inválido');
    if (!sender) return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    if (receiverId === sender.id || receiverId === sender.firebaseUid || receiverId === sender.username) {
      return res.status(400).json({ success: false, message: 'No puedes enviarte mensajes a ti mismo.' });
    }
    
    const receiver = await resolveUserByAnyId(receiverId);
    if (!receiver) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (receiver.id === sender.id) return res.status(400).json({ success: false, message: 'No puedes enviarte mensajes a ti mismo.' });
    const blockedReason = await messageBlockReason(sender.id, receiver.id);
    if (blockedReason) return res.status(403).json({ success: false, code: 'blocked', message: blockedReason });

    const message = await prisma.message.create({
      data: {
        senderId: sender.id,
        receiverId: receiver.id,
        content
      }
    });
    flagMessageText(message, receiver.id);
    res.json({ success: true, message });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Marcar mensaje como ledo
app.put('/api/messages/:id/read', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    
    if (!user || !message || message.receiverId !== user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    await prisma.message.update({
      where: { id: req.params.id },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});


// Contenido de un mensaje: texto plano o {v, text, imageUrl, imageBase64}. La imagen solo de hosts permitidos
// (una URL cualquiera dejaría a quien envía ver la IP de quien lee) o una imagen embebida en base64.
const isAllowedMessageContent = (content) => {
  if (!isShortText(content, 1500000)) return false;
  let body;
  try { body = JSON.parse(content); } catch (_error) { return true; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return true;
  if (body.imageUrl && !isAllowedStoredImageUrl(body.imageUrl)) return false;
  if (body.imageBase64 && !/^data:image[/](png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(String(body.imageBase64))) return false;
  return body.text === undefined || body.text === null || typeof body.text === 'string';
};

const resolveUserByAnyId = async (identifier) => {
  const value = String(identifier || '').trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const where = [{ firebaseUid: value }, { username: value }];
  if (isUuid) where.push({ id: value });
  return prisma.user.findFirst({ where: { OR: where } });
};

const typingPresence = new Map();
const TYPING_TTL_MS = 4500;

const typingKey = (senderId, receiverId) => `${senderId}:${receiverId}`;

app.post('/api/messages/:otherId/typing', authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    if (!currentUser) return res.status(401).json({ success: false });

    const otherUser = await resolveUserByAnyId(req.params.otherId);
    if (!otherUser) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (otherUser.id === currentUser.id) return res.json({ success: true });

    const key = typingKey(currentUser.id, otherUser.id);
    if (req.body?.isTyping) {
      typingPresence.set(key, Date.now() + TYPING_TTL_MS);
    } else {
      typingPresence.delete(key);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating typing status:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

app.get('/api/messages/:otherId/typing', authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    if (!currentUser) return res.status(401).json({ success: false });

    const otherUser = await resolveUserByAnyId(req.params.otherId);
    if (!otherUser) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const key = typingKey(otherUser.id, currentUser.id);
    const expiresAt = typingPresence.get(key) || 0;
    const isTyping = expiresAt > Date.now();
    if (!isTyping) typingPresence.delete(key);
    res.json({ success: true, isTyping });
  } catch (error) {
    console.error('Error fetching typing status:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// GET messages between current user and another
app.get('/api/messages/:otherId', authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    if (!currentUser) return res.status(401).json({ success: false });

    const otherUser = await resolveUserByAnyId(req.params.otherId);
    if (!otherUser) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const otherId = otherUser.id;
    
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUser.id, receiverId: otherId },
          { senderId: otherId, receiverId: currentUser.id }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });
    
    // Un mensaje ocultado por moderación no se muestra a quien lo recibió (el autor sigue viendo el suyo)
    const shown = messages.map(({ moderationState, ...message }) => (moderationState === 'hidden' && message.senderId !== currentUser.id
      ? { ...message, content: HIDDEN_MESSAGE_TEXT, hidden: true }
      : message));
    res.json({ success: true, messages: shown });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// POST new message
app.post('/api/messages/:otherId', authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    if (!currentUser) return res.status(401).json({ success: false });

    const otherUser = await resolveUserByAnyId(req.params.otherId);
    if (!otherUser) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const otherId = otherUser.id;
    const { content } = req.body;
    
    if (!content) return res.status(400).json({ success: false });
    if (!isAllowedMessageContent(content)) return badRequest(res, 'Mensaje inválido');
    if (otherId === currentUser.id) {
      return res.status(400).json({ success: false, message: 'No puedes enviarte mensajes a ti mismo.' });
    }
    const blockedReason = await messageBlockReason(currentUser.id, otherId);
    if (blockedReason) return res.status(403).json({ success: false, code: 'blocked', message: blockedReason });

    const message = await prisma.message.create({
      data: {
        senderId: currentUser.id,
        receiverId: otherId,
        content
      }
    });
    flagMessageText(message, otherId);
    
    res.json({
      success: true,
      message,
      otherUser: {
        id: otherUser.id,
        name: otherUser.name,
        username: otherUser.username,
        photoURL: otherUser.photoURL
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

const HIDDEN_MESSAGE_TEXT = 'Mensaje oculto por moderación';

// Los mensajes se guardan como JSON { v: 1, text }: se revisa solo el texto, buscando cobros por adelantado o enlaces sospechosos
const flagMessageText = (message, receiverId) => {
  let text = message.content;
  try {
    const parsed = JSON.parse(message.content);
    if (parsed && typeof parsed === 'object' && parsed.v === 1) text = parsed.text || '';
  } catch (_error) {
    // texto plano
  }
  if (typeof text === 'string' && text) moderationHooks.flagText?.('message', message.id, text, 'message', receiverId);
};

// GET user chats: último mensaje con cada persona y no leídos, resueltos en la base (sin traer todo el historial)
app.get('/api/chats', authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    if (!currentUser) return res.status(401).json({ success: false });

    const [lastMessages, unreadRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT * FROM (
          SELECT DISTINCT ON (m.partner) m."id", m."senderId", m."receiverId", m."content", m."moderationState", m."isRead", m."createdAt"
          FROM (
            SELECT *, CASE WHEN "senderId" = ${currentUser.id} THEN "receiverId" ELSE "senderId" END AS partner
            FROM "Message"
            WHERE "senderId" = ${currentUser.id} OR "receiverId" = ${currentUser.id}
          ) m
          WHERE m.partner <> ${currentUser.id}
          ORDER BY m.partner, m."createdAt" DESC
        ) last
        ORDER BY "createdAt" DESC`,
      prisma.message.groupBy({ by: ['senderId'], where: { receiverId: currentUser.id, isRead: false, senderId: { not: currentUser.id } }, _count: { _all: true } })
    ]);

    const unreadCounts = new Map(unreadRows.map((row) => [row.senderId, row._count._all]));
    const totalUnread = [...unreadCounts.values()].reduce((total, count) => total + count, 0);
    const partnerIds = lastMessages.map((msg) => (msg.senderId === currentUser.id ? msg.receiverId : msg.senderId));
    const users = partnerIds.length
      ? await prisma.user.findMany({ where: { id: { in: partnerIds } }, select: { id: true, name: true, username: true, photoURL: true } })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    const enrichedChats = lastMessages.map((msg) => {
      const partnerId = msg.senderId === currentUser.id ? msg.receiverId : msg.senderId;
      const partner = usersById.get(partnerId) || {};
      const { moderationState, ...chatMessage } = msg;
      const hiddenForMe = moderationState === 'hidden' && msg.senderId !== currentUser.id;
      return { ...chatMessage, ...(hiddenForMe ? { content: HIDDEN_MESSAGE_TEXT, hidden: true } : {}), unreadCount: unreadCounts.get(partnerId) || 0, partner, otherUser: partner };
    });

    res.json({ success: true, chats: enrichedChats, totalUnread });
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});


// User profile management
// --- Correos ---
// Se envían por SMTP (Gmail con contraseña de aplicación: SMTP_USER y SMTP_PASS en el servidor).
// Regla: SOLO se escribe a cuentas activas que tengan aceptada la versión vigente de los Términos y la Política.
// En las pruebas (MAIL_TEST_OUTBOX=1, sin credenciales) los correos no salen: quedan en memoria.
const mailTransport = process.env.SMTP_USER && process.env.SMTP_PASS
  ? nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  })
  : process.env.MAIL_TEST_OUTBOX === '1' ? nodemailer.createTransport({ jsonTransport: true }) : null;
const MAIL_FROM = `"Carpetazo" <${process.env.SMTP_USER || 'pruebas@carpetazo.test'}>`;

const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Devuelve { sent, reason }. Nunca lanza: un correo que no sale no debe romper la acción del usuario.
const sendUserEmail = async (userId, { subject, text, html }) => {
  try {
    if (!mailTransport) return { sent: false, reason: 'not_configured' };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
    if (!user || user.role === 'deleted' || !user.email || user.email.endsWith('@deleted.invalid')) return { sent: false, reason: 'no_recipient' };
    if (!isCurrentAcceptance(await latestAcceptance(user.id))) return { sent: false, reason: 'terms_not_accepted' };
    await mailTransport.sendMail({ from: MAIL_FROM, to: user.email, subject, text, html });
    return { sent: true };
  } catch (error) {
    console.error('Error sending email:', error.message);
    return { sent: false, reason: 'send_failed' };
  }
};

const moderationHooks = {};
const moderation = registerModeration(app, { prisma, authenticateToken, requireStaff, hooks: moderationHooks, badRequest, isUuid, currentUserId, hashConnection, sendUserEmail, escapeHtml, reviewHideReports: REVIEW_HIDE_REPORTS });
registerModerationC(app, { prisma, authenticateToken, requireStaff, hooks: moderationHooks, moderation, badRequest, isUuid, currentUserId, escapeHtml, hashBank, imageScanner });
registerSanctions(app, { prisma, authenticateToken, requireStaff, hooks: moderationHooks, restrictions, moderation, badRequest, isUuid, currentUserId, sendUserEmail, escapeHtml, targetLabel: (type) => REPORT_TARGETS[type]?.label || 'contenido', reasonLabel: (type, code) => findReason(type, code)?.label || 'Otro motivo' });

// Prueba del envío (solo administradores). Sin "username" se envía a sí mismo; con "username", a esa cuenta,
// que igual debe tener los términos aceptados. El contenido es fijo: no se puede usar para escribir mensajes libres.
app.post('/api/admin/test-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const username = req.body?.username;
    if (username !== undefined && (typeof username !== 'string' || !validUsername(username))) return badRequest(res, 'Usuario inválido');
    const target = username
      ? await prisma.user.findUnique({ where: { username: validUsername(username) }, select: { id: true, name: true } })
      : await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true, name: true } });
    if (!target) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const name = target.name || 'Hola';
    const result = await sendUserEmail(target.id, {
      subject: 'Correo de prueba de Carpetazo',
      text: `${name}:\n\nEste es un correo de prueba de Carpetazo.cl. Si lo recibiste, el envío de avisos funciona.\n\nEquipo Carpetazo\nhttps://carpetazo.cl`,
      html: `<p>${escapeHtml(name)}:</p><p>Este es un correo de prueba de <b>Carpetazo.cl</b>. Si lo recibiste, el envío de avisos funciona.</p><p>Equipo Carpetazo<br><a href="https://carpetazo.cl">carpetazo.cl</a></p>`
    });
    res.json({ success: true, sent: result.sent, reason: result.reason || null });
  } catch (error) {
    console.error('Error in test email:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

app.get('/api/legal/versions', (_req, res) => {
  res.json({ success: true, ...LEGAL_CURRENT });
});

// Aceptar los textos vigentes: exige declarar 18 años o más y la versión exacta que se mostró
app.post('/api/users/me/accept-terms', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true, username: true, createdAt: true, role: true } });
    if (!user || user.role === 'deleted') return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const body = req.body || {};
    if (body.adult !== true) return badRequest(res, 'Debes confirmar que tienes 18 años o más');
    if (body.termsVersion !== LEGAL_CURRENT.termsVersion || body.privacyVersion !== LEGAL_CURRENT.privacyVersion) {
      return res.status(409).json({ success: false, code: 'terms_version_changed', message: 'Los textos se actualizaron. Recarga la página para verlos.' });
    }
    let newUsername = null;
    if (body.username !== undefined && body.username !== null) {
      const status = await getLegalStatus(user);
      if (!status.canChooseUsername) return badRequest(res, 'No puedes cambiar el usuario en este paso');
      newUsername = validUsername(body.username);
      if (!newUsername) return badRequest(res, 'El usuario debe tener entre 3 y 20 caracteres: letras, números o _.');
    }
    // Usuario nuevo y aceptación juntos: no puede quedar uno sin el otro
    await prisma.$transaction([
      ...(newUsername && newUsername !== user.username ? [prisma.user.update({ where: { id: user.id }, data: { username: newUsername } })] : []),
      prisma.termsAcceptance.create({ data: { userId: user.id, termsVersion: LEGAL_CURRENT.termsVersion, privacyVersion: LEGAL_CURRENT.privacyVersion, isAdult: true, connectionHash: hashConnection(req) } })
    ]);
    acceptedCache.set(req.user.sub, Date.now() + ACCEPTED_CACHE_MS);
    res.json({ success: true, legal: await getLegalStatus(user) });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Ese usuario ya está en uso' });
    console.error('Error accepting terms:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// "Salir" en la pantalla de aceptación: una cuenta recién creada, sin aceptar y sin actividad, se borra por completo.
// Cualquier otra cuenta se deja intacta (solo cierra sesión en el cliente).
app.delete('/api/users/me/unaccepted', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true, createdAt: true, role: true } });
    if (!user || user.role === 'deleted') return res.json({ success: true, deleted: false });
    const [acceptances, folders, wishlist, messages, orders] = await Promise.all([
      prisma.termsAcceptance.count({ where: { userId: user.id } }),
      prisma.folder.count({ where: { userId: user.id } }),
      prisma.wishlistItem.count({ where: { userId: user.id } }),
      prisma.message.count({ where: { OR: [{ senderId: user.id }, { receiverId: user.id }] } }),
      prisma.order.count({ where: { OR: [{ sellerId: user.id }, { buyerId: user.id }] } })
    ]);
    const brandNew = Date.now() - new Date(user.createdAt).getTime() < NEW_ACCOUNT_WINDOW_MS;
    if (acceptances > 0 || !brandNew || folders + wishlist + messages + orders > 0) return res.json({ success: true, deleted: false });
    await prisma.user.delete({ where: { id: user.id } });
    acceptedCache.delete(req.user.sub);
    res.json({ success: true, deleted: true });
  } catch (error) {
    console.error('Error declining terms:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user.sub }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user, legal: await getLegalStatus(user) });
  } catch (error) {
    console.error('Error fetching my profile:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) {
      return cb(new Error('Sube una imagen válida.'));
    }
    cb(null, true);
  }
}); // 10MB

// Initialize S3 client for Cloudflare R2
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ACCOUNT_ID ? "https://" + process.env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com" : '',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

// Solo en pruebas automáticas: R2 simulado que recuerda qué se subió y qué se borró (no existe en producción)
if (R2_TEST_STUB) {
  const r2Log = [];
  r2Client.send = async (command) => {
    r2Log.push({ op: command.constructor.name === 'PutObjectCommand' ? 'put' : 'delete', key: command.input.Key });
    return {};
  };
  app.get('/api/__test/r2-log', (_req, res) => res.json({ log: r2Log }));
}

app.post('/api/users/upload-image', authenticateToken, (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'La imagen debe pesar menos de 10 MB.' });
    }

    return res.status(400).json({ success: false, message: error.message === 'Sube una imagen válida.' ? error.message : 'No se pudo leer la imagen.' });
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se envió ninguna imagen.' });
    }

    const type = req.body.type; // 'avatar', 'banner', 'wallpaper', 'message' or 'card'
    if (!['avatar', 'banner', 'wallpaper', 'message', 'card'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Tipo de imagen inválido.' });
    }

    const isBanner = type === 'banner';
    const isWallpaper = type === 'wallpaper';
    const isMessageImage = type === 'message';
    const isCardImage = type === 'card';
    // Las imágenes del chat son privadas entre dos personas: nunca se envían a servicios externos
    const scanKind = isCardImage ? 'card' : 'profile';
    const shouldScan = !isMessageImage && imageScanner.enabled;
    const blockedMessage = 'Esta imagen no cumple las normas de Carpetazo.';

    if (!hasR2Config()) {
      return res.status(503).json({
        success: false,
        message: 'El servidor no tiene configurado R2 para guardar imágenes permanentes.',
        missingConfig: true
      });
    }

    // 1) Se decodifica una sola vez: de ahí salen la huella visual, el sha256 y la copia reducida que se escanea
    let prepared;
    try {
      prepared = await prepareImage(req.file.buffer);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.scanCode === 'format' ? 'Sube una imagen JPG, PNG, WebP o GIF.' : 'No se pudo leer la imagen.' });
    }

    // 2) Huella visual: una imagen parecida a otra ya prohibida por moderación se rechaza (gratis, sin gastar cuota)
    if (prepared.hash && (await hashBank.closestBanned(prepared.hash)) !== null) {
      prisma.moderationAudit.create({ data: { actorId: null, action: 'phash.blocked', targetType: 'user', targetId: String(req.user.sub || ''), note: 'Subida rechazada: imagen parecida a una prohibida' } }).catch(() => {});
      return res.status(400).json({ success: false, message: blockedMessage });
    }

    const uploader = await prisma.user.findUnique({
      where: { firebaseUid: req.user.sub },
      select: { id: true, createdAt: true, photoURL: true, bannerBase64: true, wallpaperBase64: true }
    });
    if (!uploader && !isMessageImage && !isCardImage) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    // 3) Veredicto ya conocido para este archivo exacto: no se vuelve a pagar un escaneo (ni por un reintento desde el móvil)
    let cachedScan = null;
    if (shouldScan) {
      const cached = await imageScanner.cachedVerdict(prepared.sha256);
      if (cached) {
        imageScanner.logEvent({ provider: 'cache', kind: scanKind, verdict: cached.verdict, fallback: false, ms: 0 });
        if (cached.verdict === 'block') return res.status(400).json({ success: false, message: blockedMessage });
        cachedScan = { verdict: 'clear', provider: cached.provider || null };
      }
    }

    // 4) Se procesa y sube a R2 mientras se escanea: la espera del escaneo queda oculta detrás de la subida.
    //    El nombre es aleatorio y la base no lo referencia hasta tener veredicto; si se rechaza, se borra.
    const objectName = crypto.randomBytes(16).toString('hex');
    const safeUid = String(req.user.sub || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = "Carpetazo.cl/Usuarios/" + safeUid + "/" + type + "/" + objectName + ".webp";
    const publicUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, '') + "/" + filename;
    const forcedVerdict = process.env.TEST_AUTH_STUB === '1' ? String(req.headers['x-test-scan'] || '') || null : null;

    const storeProcessed = (async () => {
      const processedBuffer = await sharp(req.file.buffer).webp({ quality: 100 }).toBuffer();
      let dominantColor = null;
      let complementaryColor = null;
      if (isBanner) {
        const { dominant } = await sharp(processedBuffer).stats();
        dominantColor = "rgb(" + dominant.r + ", " + dominant.g + ", " + dominant.b + ")";
        complementaryColor = "rgb(" + (255 - dominant.r) + ", " + (255 - dominant.g) + ", " + (255 - dominant.b) + ")";
      }
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filename,
        Body: processedBuffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable'
      }));
      return { dominantColor, complementaryColor };
    })();
    const scanning = cachedScan
      ? Promise.resolve(cachedScan)
      : shouldScan
        ? imageScanner.scan(prepared.scanJpeg, { kind: scanKind, force: forcedVerdict })
        : Promise.resolve({ verdict: 'unscanned', provider: null });
    const [stored, scanned] = await Promise.allSettled([storeProcessed, scanning]);
    if (stored.status === 'rejected') throw stored.reason;
    const { dominantColor, complementaryColor } = stored.value;
    const scan = scanned.status === 'fulfilled' ? scanned.value : { verdict: 'unavailable', provider: null };

    // Desde aquí el archivo ya está en R2: si no se publica, se borra para no dejarlo huérfano
    let published = false;
    try {
      if (scan.verdict === 'block') {
        // Se recuerda el archivo rechazado: reintentarlo no gasta cuota
        hashBank.remember({ url: 'blocked:' + prepared.sha256, hash: prepared.hash, sha256: prepared.sha256, verdict: 'block', provider: scan.provider }).catch(() => {});
        prisma.moderationAudit.create({ data: { actorId: null, action: 'scan.blocked', targetType: 'user', targetId: String(req.user.sub || ''), note: 'Subida rechazada por el escaneo automático (' + (scan.provider || 'sin proveedor') + ')' } }).catch(() => {});
        await deleteR2ObjectByPublicUrl(publicUrl);
        return res.status(400).json({ success: false, message: blockedMessage });
      }

      // Sin servicio disponible: una cuenta con buen historial publica; una nueva o con antecedentes queda pendiente de revisión
      let hold = false;
      if (scan.verdict === 'unavailable') {
        if (!(await isTrustedUploader(prisma, uploader))) {
          if (isCardImage) {
            await deleteR2ObjectByPublicUrl(publicUrl);
            return res.status(503).json({ success: false, message: 'No pudimos revisar tu imagen en este momento. Intenta de nuevo en unos minutos.' });
          }
          hold = true;
        }
      }

      const updateData = isBanner
        ? { bannerBase64: publicUrl, bannerDominantColor: dominantColor, bannerComplementaryColor: complementaryColor }
        : isWallpaper
          ? { wallpaperBase64: publicUrl }
          : { photoURL: publicUrl };

      if (!isMessageImage && !isCardImage) {
        await prisma.user.update({
          where: { firebaseUid: req.user.sub },
          data: updateData
        });
      }
      published = true;

      const storedVerdict = hold ? 'pending' : scan.verdict === 'unavailable' ? 'unscanned' : scan.verdict;
      hashBank.remember({ url: publicUrl, hash: prepared.hash, userId: uploader?.id || null, sha256: prepared.sha256, verdict: storedVerdict, provider: scan.provider }).catch(() => {});

      if (!isMessageImage && !isCardImage) {
        if (hold) await moderationHooks.holdImage({ userId: uploader.id, type, url: publicUrl, reasonCode: 'auto.image_pending', hide: true });
        else if (scan.verdict === 'review') await moderationHooks.holdImage({ userId: uploader.id, type, url: publicUrl, reasonCode: 'auto.image_review', hide: false });
      }

      const previousImageUrl = isBanner
        ? uploader?.bannerBase64
        : isWallpaper
          ? uploader?.wallpaperBase64
          : uploader?.photoURL;

      if (!isMessageImage && !isCardImage && previousImageUrl && previousImageUrl !== publicUrl) {
        await deleteR2ObjectByPublicUrl(previousImageUrl);
      }

      res.json({ success: true, url: publicUrl, dominantColor, complementaryColor, ...(hold ? { pending: true } : {}) });
    } catch (error) {
      if (!published) await deleteR2ObjectByPublicUrl(publicUrl);
      throw error;
    }
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, message: 'Error procesando o subiendo la imagen' });
  }
});

const sanitizeProfileAddresses = (addresses = []) => {
  if (!Array.isArray(addresses)) return [];

  const cleaned = addresses
    .slice(0, 10)
    .map((address = {}, index) => ({
      id: String(address.id || `address-${Date.now()}-${index}`).slice(0, 80),
      name: String(address.name || '').trim().slice(0, 80),
      region: String(address.region || '').trim().slice(0, 80),
      comuna: String(address.comuna || '').trim().slice(0, 80),
      street: String(address.street || '').trim().slice(0, 120),
      number: String(address.number || '').trim().slice(0, 30),
      floor: String(address.floor || '').trim().slice(0, 30),
      depto: String(address.depto || '').trim().slice(0, 30),
      reference: String(address.reference || '').trim().slice(0, 180),
      isDefault: Boolean(address.isDefault)
    }))
    .filter(address => address.region && address.comuna && address.street && address.number);

  const defaultIndex = cleaned.findIndex(address => address.isDefault);
  const effectiveDefaultIndex = defaultIndex >= 0 ? defaultIndex : 0;

  return cleaned.map((address, index) => ({
    ...address,
    isDefault: index === effectiveDefaultIndex
  }));
};

app.put('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const firebaseUid = req.user.sub;
    const allowedFields = [
      'name',
      'fullName',
      'username',
      'photoURL',
      'bannerBase64',
      'bannerDominantColor',
      'bannerComplementaryColor',
      'wallpaperBase64',
      'bio',
      'phone',
      'rut',
      'facebookUrl',
      'instagramUrl',
      'youtubeUrl',
      'publicTheme',
      'addresses',
      'bankDetails'
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field) && req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // Textos libres del perfil: tipo y largo acotados (el nombre no puede quedar vacío)
    const PROFILE_TEXT_LIMITS = { name: 100, fullName: 150, bio: 600, phone: 30, rut: 20, bannerDominantColor: 40, bannerComplementaryColor: 40 };
    for (const [field, max] of Object.entries(PROFILE_TEXT_LIMITS)) {
      if (updateData[field] === undefined) continue;
      const valid = field === 'name' ? isShortText(updateData[field], max) : isOptionalText(updateData[field], max);
      if (!valid || (typeof updateData[field] === 'string' && hasControlChars(updateData[field].replace(/[\r\n]/g, ' ')))) {
        return res.status(400).json({ success: false, error: 'Datos de perfil inválidos' });
      }
    }
    if (updateData.username !== undefined) {
      const username = validUsername(updateData.username);
      // Nombres antiguos que no cumplen la política se conservan mientras no se cambien
      const current = username ? null : await prisma.user.findUnique({ where: { firebaseUid }, select: { username: true } });
      if (!username && current?.username !== normalizeUsername(updateData.username)) {
        return res.status(400).json({ success: false, error: 'El usuario debe tener entre 3 y 20 caracteres: letras, números o _.' });
      }
      updateData.username = username || current.username;
    }

    // Una imagen nueva debe ser de un host permitido; la que ya estaba guardada se acepta tal cual (datos anteriores a la regla)
    const storedImages = await prisma.user.findUnique({ where: { firebaseUid }, select: { id: true, photoURL: true, bannerBase64: true, wallpaperBase64: true, moderationHidden: true } });
    for (const field of ['photoURL', 'bannerBase64', 'wallpaperBase64']) {
      if (updateData[field] !== undefined && updateData[field] !== storedImages?.[field] && !checkImageField(updateData[field])) {
        return res.status(400).json({ success: false, error: 'URL de imagen no permitida' });
      }
    }
    // Contenido retirado por moderación: no se puede volver a subir el mismo; una imagen o texto nuevo limpia el aviso
    const hiddenParts = storedImages?.moderationHidden || [];
    if (hiddenParts.length) {
      const moderated = { photo: ['profile_image', ['photoURL'], ['photoURL']], banner: ['profile_banner', ['bannerBase64'], ['bannerBase64']], wallpaper: ['profile_wallpaper', ['wallpaperBase64'], ['wallpaperBase64']], text: ['profile_text', ['name', 'bio', 'facebookUrl', 'instagramUrl', 'youtubeUrl'], ['bio', 'facebookUrl', 'instagramUrl', 'youtubeUrl']] };
      let remaining = [...hiddenParts];
      for (const part of hiddenParts) {
        const [reportType, guarded, clearing] = moderated[part] || [];
        if (!reportType) continue;
        const retired = await prisma.report.findMany({ where: { targetOwnerId: storedImages.id, targetType: reportType, status: { in: ['open', 'actioned'] } }, select: { snapshot: true } });
        for (const field of guarded) {
          const incoming = updateData[field];
          if (!incoming) continue;
          if (retired.some((row) => (row.snapshot?.value ?? row.snapshot?.[field]) === incoming)) {
            return res.status(403).json({ success: false, error: 'Este contenido fue retirado por moderación y no se puede volver a publicar' });
          }
        }
        if (clearing.some((field) => updateData[field])) remaining = remaining.filter((item) => item !== part);
      }
      if (remaining.length !== hiddenParts.length) updateData.moderationHidden = remaining;
    }
    for (const field of Object.keys(SOCIAL_DOMAINS)) {
      if (updateData[field] !== undefined && !checkSocialField(field, updateData[field])) {
        return res.status(400).json({ success: false, error: 'Enlace de red social no válido' });
      }
    }

    if (updateData.publicTheme !== undefined) {
      if (!updateData.publicTheme || typeof updateData.publicTheme !== 'object' || Array.isArray(updateData.publicTheme)) {
        return res.status(400).json({ success: false, error: 'Invalid public theme' });
      }

      const allowedThemeFields = [
        'id',
        'name',
        'primary',
        'secondary',
        'accent',
        'surface',
        'card',
        'text',
        'font',
        'cardStyle',
        'backgroundStyle',
        'sideBackgroundStyle',
        'avatarFrame',
        'profileLayout',
        'profileEffect',
        'showcaseStyle',
        'profileDistribution',
        'showWhatsApp',
        'showInstagram',
        'showFacebook',
        'showMessageButton',
        'showYoutube',
        'showWishlist',
        'shareBankInOrders'
      ];
      updateData.publicTheme = Object.fromEntries(
        Object.entries(updateData.publicTheme)
          .filter(([key, value]) => allowedThemeFields.includes(key) && typeof value === 'string')
          .map(([key, value]) => [key, value.slice(0, 40)])
      );
    }

    if (updateData.addresses !== undefined) {
      updateData.addresses = sanitizeProfileAddresses(updateData.addresses);
    }

    if (updateData.bankDetails !== undefined) {
      updateData.bankDetails = updateData.bankDetails && typeof updateData.bankDetails === 'object' && !Array.isArray(updateData.bankDetails)
        ? {
            bank: String(updateData.bankDetails.bank || '').trim().slice(0, 80),
            accountType: String(updateData.bankDetails.accountType || '').trim().slice(0, 80),
            accountNumber: String(updateData.bankDetails.accountNumber || '').trim().slice(0, 80)
          }
        : {};
    }

    const user = await prisma.user.update({
      where: { firebaseUid },
      data: updateData
    });

    if (updateData.bio) moderationHooks.flagText?.('profile_text', user.id, updateData.bio, 'bio', null);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating profile:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Username already in use' });
    }
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

app.delete('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const firebaseUid = req.user.sub;
    const current = await prisma.user.findUnique({ where: { firebaseUid }, select: { id: true, photoURL: true, bannerBase64: true, wallpaperBase64: true } });
    if (!current) return res.status(404).json({ success: false, error: 'User not found' });

    // Se borran los datos personales; quedan las filas anonimizadas (pedidos, reseñas y conversaciones de otras personas las referencian)
    const tag = `${Date.now()}_${firebaseUid.slice(0, 8)}`;
    const deletedMessage = JSON.stringify({ v: 1, text: 'Mensaje eliminado', imageUrl: null, imageBase64: null });
    await prisma.$transaction([
      prisma.user.update({
        where: { id: current.id },
        data: {
          role: 'deleted',
          email: `deleted_${tag}@deleted.invalid`,
          username: `deleted_${tag}`,
          name: 'Usuario Eliminado',
          fullName: null,
          photoURL: null,
          bannerBase64: null,
          wallpaperBase64: null,
          bannerDominantColor: null,
          bannerComplementaryColor: null,
          bio: null,
          phone: null,
          rut: null,
          facebookUrl: null,
          instagramUrl: null,
          youtubeUrl: null,
          publicTheme: Prisma.DbNull,
          addresses: Prisma.DbNull,
          bankDetails: Prisma.DbNull
        }
      }),
      prisma.folder.updateMany({ where: { userId: current.id }, data: { isPublic: false } }),
      prisma.wishlistItem.deleteMany({ where: { userId: current.id } }),
      prisma.message.updateMany({ where: { senderId: current.id }, data: { content: deletedMessage } }),
      prisma.order.updateMany({ where: { buyerId: current.id }, data: { buyerId: null, buyerName: 'Comprador eliminado' } })
    ]);

    // Las imágenes propias se borran de R2 (si falla no detiene la eliminación)
    await Promise.all([current.photoURL, current.bannerBase64, current.wallpaperBase64].filter(Boolean).map((url) => deleteR2ObjectByPublicUrl(url)));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ success: false, error: 'Failed to delete account' });
  }
});

app.get('/api/users/username/check', authenticateToken, async (req, res) => {
  try {
    const username = validUsername(req.query.username);

    if (!username) {
      return res.status(400).json({
        success: false,
        available: false,
        message: 'El usuario debe tener entre 3 y 20 caracteres: letras, números o _.'
      });
    }

    const currentUser = await prisma.user.findUnique({
      where: { firebaseUid: req.user.sub },
      select: { id: true, username: true }
    });

    if (!currentUser) {
      return res.status(404).json({ success: false, available: false, message: 'User not found' });
    }

    if (currentUser.username === username) {
      return res.json({ success: true, available: true });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });

    res.json({ success: true, available: !existingUser });
  } catch (error) {
    console.error('Error checking username:', error);
    res.status(500).json({ success: false, available: false, message: 'Error interno' });
  }
});

// Disponibilidad de un usuario antes de registrarse (sin sesión). Solo dice si está libre: los usuarios ya son públicos (/<usuario>)
app.get('/api/users/username/available', async (req, res) => {
  try {
    const username = validUsername(req.query.username);
    if (!username) {
      return res.status(400).json({ success: false, available: false, message: 'El usuario debe tener entre 3 y 20 caracteres: letras, números o _.' });
    }
    const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    res.json({ success: true, available: !existing });
  } catch (error) {
    console.error('Error checking username availability:', error);
    res.status(500).json({ success: false, available: false, message: 'Error interno' });
  }
});

app.get('/api/users/:username', optionalAuth, async (req, res) => {
  try {
    const identifier = String(req.params.username || '').trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
    const publicUserLookup = [
      { username: identifier },
      { firebaseUid: identifier }
    ];

    if (isUuid) {
      publicUserLookup.push({ id: identifier });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: publicUserLookup,
        NOT: { role: 'deleted' }
      },
      select: {
        ...PUBLIC_SELLER_SELECT,
        folders: {
          where: { isPublic: true },
          include: {
            _count: { select: { cards: true } },
            user: { select: { name: true, username: true, photoURL: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    // Una cuenta cerrada por moderación deja de tener perfil público
    if (!user || (await restrictions.restrictionsFor(user.id)).has('ban')) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { folders, ...seller } = user;
    res.json({ success: true, user: { ...toPublicSeller(seller, req.user?.sub, await getReviewSummary(seller.id)), folders } });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});
// --- TCGCSV LOCAL DB ---
// Identificadores de las rutas del catálogo: solo enteros positivos (groupId también admite "otros")
app.param('categoryId', (req, res, next, value) => (/^\d{1,9}$/.test(value) ? next() : badRequest(res, 'Juego inválido')));
app.param('groupId', (req, res, next, value) => (/^\d{1,9}$/.test(value) || value === 'otros' ? next() : badRequest(res, 'Edición inválida')));

app.get('/api/tcg/categories', async (req, res) => {
  try {
    const categories = await prisma.tcgCategory.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

app.get('/api/tcg/:categoryId/groups', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const groups = await prisma.tcgGroup.findMany({
      where: { categoryId: parseInt(categoryId) },
      orderBy: { publishedOn: 'desc' }
    });
    res.json({ success: true, data: groups });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

app.get('/api/tcg/:categoryId/filter-options', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    if (!Number.isFinite(categoryId)) {
      return res.status(400).json({ success: false, message: 'Invalid category id' });
    }

    const products = await prisma.tcgProduct.findMany({
      where: { categoryId },
      select: { extData: true },
    });

    const types = new Set();
    const races = new Set();
    const costs = new Set();
    const rarities = new Set();

    const addValue = (target, rawValue) => {
      if (rawValue === undefined || rawValue === null) return;
      String(rawValue)
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
        .forEach(value => target.add(value));
    };

    products.forEach((product) => {
      const extData = Array.isArray(product.extData) ? product.extData : [];
      extData.forEach((item) => {
        if (!item || !item.name) return;
        const name = String(item.name).toLowerCase();
        if (name === 'type') addValue(types, item.value);
        if (name === 'race') addValue(races, item.value);
        if (name === 'cost') {
          const cost = Number(item.value);
          if (Number.isFinite(cost) && cost >= 0 && cost <= 10) addValue(costs, String(cost));
        }
        if (name === 'frequency' || name === 'rarity' || name === 'card number / rarity') addValue(rarities, item.value);
      });
    });

    const sortText = (a, b) => a.localeCompare(b, 'es');
    const sortNumberText = (a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
      return sortText(a, b);
    };

    res.json({
      success: true,
      data: {
        types: [...types].sort(sortText),
        races: [...races].sort(sortText),
        costs: [...costs].sort(sortNumberText),
        rarities: [...rarities].sort(sortText),
      },
    });
  } catch (error) {
    console.error('Error fetching TCG filter options:', error);
    res.status(500).json({ success: false, message: 'Error fetching filter options' });
  }
});

app.post('/api/tcg/products/metadata', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length > 500) return badRequest(res, 'Demasiadas cartas');
    const productIds = [...new Set(ids.map(id => String(id)).filter(id => Boolean(id)))];

    if (productIds.length === 0) {
      return res.json({ success: true, data: {} });
    }

    const products = await prisma.tcgProduct.findMany({
      where: { productId: { in: productIds } },
      select: {
        productId: true,
        extData: true,
        group: { select: { name: true, groupId: true } },
      },
    });

    const getExtValue = (extData, fieldName) => {
      if (!Array.isArray(extData)) return '';
      const item = extData.find(entry => String(entry?.name || '').toLowerCase() === fieldName.toLowerCase());
      return item?.value || '';
    };

    const data = {};
    products.forEach((product) => {
      data[String(product.productId)] = {
        set: product.group?.name || '',
        groupId: product.group?.groupId || null,
        type: getExtValue(product.extData, 'Type'),
        race: getExtValue(product.extData, 'Race'),
        cost: getExtValue(product.extData, 'Cost'),
        effect: getExtValue(product.extData, 'Effect'),
        rarity: getExtValue(product.extData, 'Frequency') || getExtValue(product.extData, 'Rarity') || getExtValue(product.extData, 'Card Number / Rarity'),
        number: getExtValue(product.extData, 'Number'),
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching product metadata:', error);
    res.status(500).json({ success: false, message: 'Error fetching product metadata' });
  }
});

// Una carta puede pertenecer a varios productos físicos: se filtra por la tabla de enlaces y se devuelven todos sus ids
const physicalLinkFilter = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) ? { physicalLinks: { some: { physicalProductId: id } } } : null;
};
const withPhysicalIds = (rows) => rows.map(({ physicalLinks, ...row }) => ({
  ...row,
  physicalProductIds: (physicalLinks || []).map((link) => link.physicalProductId)
}));

app.get('/api/tcg/:categoryId/:groupId/products', async (req, res) => {
  try {
    const { categoryId, groupId } = req.params;
    const { mylType, mylRace, mylFrequency, mylCost, physicalProductId } = req.query;

    let whereClause = { categoryId: parseInt(categoryId) };
    if (physicalProductId) {
      const linkFilter = physicalLinkFilter(physicalProductId);
      if (!linkFilter) return res.status(400).json({ success: false, message: 'Producto inválido' });
      Object.assign(whereClause, linkFilter);
    }
    if (groupId === 'otros') {
      const groups = await prisma.tcgGroup.findMany({ where: { categoryId: parseInt(categoryId) }, select: { groupId: true } });
      const groupIds = groups.map(g => g.groupId);
      whereClause.groupId = { notIn: groupIds };
    } else {
      whereClause.groupId = parseInt(groupId);
    }

    let andConditions = [];
    if (mylType) andConditions.push({ extData: { array_contains: [{ name: 'Type', value: mylType }] } });
    if (mylRace) andConditions.push({ extData: { array_contains: [{ name: 'Race', value: mylRace }] } });
    if (mylFrequency) andConditions.push({ extData: { array_contains: [{ name: 'Frequency', value: mylFrequency }] } });
    if (mylCost !== undefined && mylCost !== '') andConditions.push({ extData: { array_contains: [{ name: 'Cost', value: mylCost.toString() }] } });

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    const products = await prisma.tcgProduct.findMany({
      where: whereClause,
      include: { physicalLinks: { select: { physicalProductId: true } } },
      orderBy: [
        { physicalProductId: 'asc' },
        { name: 'asc' }
      ]
    });
    res.json({ success: true, data: withPhysicalIds(products) });
  } catch (error) {
    console.error('Error loading TCG products:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});


// --- Image Cache Proxy ---

app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/images/myl', express.static(path.join(__dirname, 'data/images/myl')));




app.get('/api/tcg/physical-products', async (req, res) => {
  try {
    // Opcional: ?categoryId=<juego> para pedir solo los productos de un juego
    const categoryId = Number.parseInt(req.query.categoryId, 10);
    if (req.query.categoryId !== undefined && !Number.isInteger(categoryId)) {
      return res.status(400).json({ success: false, message: 'Juego inválido' });
    }
    // Solo productos con al menos una carta enlazada: los vacíos harían que el filtro no muestre resultados
    const products = await prisma.tcgPhysicalProduct.findMany({
      where: { productLinks: { some: {} }, ...(Number.isInteger(categoryId) ? { categoryId } : {}) },
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error loading physical products:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

app.get('/api/tcg/blocks', async (req, res) => {
  try {
    const { categoryId } = req.query;
    const whereClause = categoryId ? { categoryId: parseInt(categoryId) } : {};
    const blocks = await prisma.tcgBlock.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: blocks });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

app.get('/api/tcg/search', async (req, res) => {
  try {
    const { q, categoryId, groupId, blockId, mylType, mylRace, mylFrequency, mylCost, physicalProductId } = req.query;
    const textParams = [q, mylType, mylRace, mylFrequency, mylCost, physicalProductId, groupId];
    if (textParams.some((value) => value !== undefined && (typeof value !== 'string' || value.length > 80))
      || [categoryId, blockId].some((value) => value !== undefined && !/^\d{1,9}$/.test(String(value)))) {
      return badRequest(res, 'Búsqueda inválida');
    }

    let whereClause = {};
    if (q) {
      const cleanQ = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "");
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { cleanName: { contains: cleanQ, mode: 'insensitive' } }
      ];
    }
    if (categoryId) whereClause.categoryId = parseInt(categoryId);
    if (physicalProductId) {
      const linkFilter = physicalLinkFilter(physicalProductId);
      if (!linkFilter) return res.status(400).json({ success: false, message: 'Producto inválido' });
      Object.assign(whereClause, linkFilter);
    }

    if (groupId) {
      if (groupId === 'otros') {
        const groups = await prisma.tcgGroup.findMany({ where: { categoryId: parseInt(categoryId) }, select: { groupId: true } });
        const groupIds = groups.map(g => g.groupId);
        whereClause.groupId = { notIn: groupIds };
      } else {
        whereClause.groupId = parseInt(groupId);
      }
    } else if (blockId) {
      const groups = await prisma.tcgGroup.findMany({ where: { blockId: parseInt(blockId) }, select: { groupId: true } });
      const groupIds = groups.map(g => g.groupId);
      if (groupIds.length > 0) {
        whereClause.groupId = { in: groupIds };
      } else {
        whereClause.groupId = -1; // No groups found for this block, return empty
      }
    }

    // Mitos y Leyendas Filters
    let andConditions = [];
    if (mylType) andConditions.push({ extData: { array_contains: [{ name: 'Type', value: mylType }] } });
    if (mylRace) andConditions.push({ extData: { array_contains: [{ name: 'Race', value: mylRace }] } });
    if (mylFrequency) andConditions.push({ extData: { array_contains: [{ name: 'Frequency', value: mylFrequency }] } });
    if (mylCost !== undefined && mylCost !== '') andConditions.push({ extData: { array_contains: [{ name: 'Cost', value: mylCost.toString() }] } });

    if (andConditions.length > 0) {
      whereClause.AND = andConditions;
    }

    const products = await prisma.tcgProduct.findMany({
      where: whereClause,
      take: 2000,
      include: { group: true, physicalLinks: { select: { physicalProductId: true } } },
      orderBy: [
        { group: { publishedOn: 'desc' } },
        { physicalProductId: 'asc' },
        { name: 'asc' }
      ]
    });
    res.json({ success: true, data: withPhysicalIds(products) });
  } catch (error) {
    console.error('Error searching TCG products:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Rutas /api inexistentes y errores no controlados: mensajes genéricos, el detalle queda solo en el log
app.use('/api', (_req, res) => res.status(404).json({ success: false, message: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ success: false, message: 'La solicitud es demasiado grande' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Solicitud inválida' });
  console.error('Error no controlado:', err?.message || err);
  res.status(err?.status && err.status < 500 ? err.status : 500).json({ success: false, message: 'Error interno del servidor' });
});

app.listen(port, () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${port}`);
});

















