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
import { initializeApp } from 'firebase-admin/app';
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

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

const isAdminEmail = (email) => Boolean(email && adminEmails.includes(String(email).toLowerCase()));

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
const hasR2Config = () => missingR2Config().length === 0;
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
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    return getAllowedProxyImageHosts().has(host) || host.endsWith('.r2.dev');
  } catch (_error) {
    return false;
  }
};
// --- Validación de nombres de usuario y URLs guardadas por los usuarios ---
const RESERVED_USERNAMES = new Set([
  'admin', 'api', 'bienvenida', 'dashboard', 'perfil', 'carpeta', 'carpetas', 'c', 'mensajes',
  'cartas', 'vendedores', 'login', 'logout', 'registro', 'soporte', 'ayuda', 'carpetazo', 'root', 'null', 'undefined'
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
const isAllowedStoredImageUrl = (rawUrl) => {
  try {
    const url = new URL(String(rawUrl || ''));
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return getAllowedProxyImageHosts().has(host) || host.endsWith('.r2.dev') || host.endsWith('.googleusercontent.com');
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
app.post('/api/folders', routeLimiter(15 * 60 * 1000, 60));
app.put('/api/folders/:id', routeLimiter(15 * 60 * 1000, 200));
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

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));
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

  if (!isAllowedProxyImageUrl(imageUrl)) {
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
    if (!contentType.toLowerCase().startsWith('image/')) {
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
    
    let user = await prisma.user.findUnique({
      where: { firebaseUid }
    });
    
    if (!user) {
      user = await prisma.user.create({
        data: { 
          firebaseUid, 
          email,
          name: req.body.displayName || '',
          username: validUsername(req.body.username) || validUsername(normalizeUsername(req.body.displayName).slice(0, 20)) || `user_${firebaseUid.slice(0, 12).toLowerCase()}`,
          photoURL: isAllowedStoredImageUrl(req.body.photoURL) ? req.body.photoURL : null,
          role: req.user.email_verified === true && isAdminEmail(email) ? 'admin' : 'user'
        }
      });
    } else {
      user = await prisma.user.update({
        where: { firebaseUid },
        data: {
          name: req.body.displayName || user.name,
          username: validUsername(req.body.username) || user.username || validUsername(normalizeUsername(user.name).slice(0, 20)) || `user_${firebaseUid.slice(0, 12).toLowerCase()}`,
          photoURL: user.photoURL || (isAllowedStoredImageUrl(req.body.photoURL) ? req.body.photoURL : null),
          ...(req.user.email_verified === true && isAdminEmail(email) && user.role !== 'admin' ? { role: 'admin' } : {})
        }
      });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ success: false, error: 'Failed to sync user' });
  }
});

const DATA_DIR = process.env.DATA_DIR || __dirname;

const dataPath = path.join(DATA_DIR, 'data.json');
const ordersPath = path.join(DATA_DIR, 'orders.json');
const historyPath = path.join(DATA_DIR, 'history.json');

// --- INICIO: Inicializar volumen en Coolify ---
if (DATA_DIR !== __dirname) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  ['data.json', 'orders.json', 'history.json'].forEach(file => {
    const targetPath = path.join(DATA_DIR, file);
    const sourcePath = path.join(__dirname, file);
    if (!fs.existsSync(targetPath) && fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`Inicializado ${file} en disco persistente`);
    }
  });
}
// --- FIN ---

// Helper to read data
const getCards = () => {
    try {
        const data = fs.readFileSync(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};


app.get('/api/admin/me', authenticateToken, requireAdmin, async (req, res) => {
  res.json({ success: true, isAdmin: true, user: req.dbUser || null });
});
// Helper to write data
const saveCards = (cards) => {
    fs.writeFileSync(dataPath, JSON.stringify(cards, null, 2));
};

// Helper to read orders
const getOrders = () => {
    try {
        if (!fs.existsSync(ordersPath)) return {};
        const data = fs.readFileSync(ordersPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
};

// Helper to write orders
const saveOrders = (orders) => {
    fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
};

// Helper to read history
const getHistory = () => {
    try {
        if (!fs.existsSync(historyPath)) return [];
        const data = fs.readFileSync(historyPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};

// Helper to write history
const saveHistory = (history) => {
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
};


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

const findOrderByCodeOrId = async (codeOrId) => {
  if (!codeOrId) return null;

  return prisma.order.findFirst({
    where: {
      OR: [
        { code: codeOrId },
        ...(isUuid(codeOrId) ? [{ id: codeOrId }] : [])
      ]
    }
  });
};

const deductOrderStock = async (order) => {
  const items = normalizeOrderItems(order.items || []);

  for (const item of items) {
    if (!item.id) continue;

    const card = await prisma.card.findUnique({ where: { id: item.id } }).catch(() => null);
    if (!card) continue;

    await prisma.card.update({
      where: { id: item.id },
      data: { stock: Math.max(0, Number(card.stock || 0) - Number(item.quantity || 1)) }
    });
  }
};

// PUT update card in folder
app.put('/api/folders/:id/cards/:cardId', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
    
    if (!folder || folder.userId !== user.id) {
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
    
    const inFolder = await prisma.card.findFirst({ where: { id: req.params.cardId, folderId: req.params.id }, select: { id: true } });
    if (!inFolder) return res.status(404).json({ success: false, message: 'Carta no encontrada' });

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
    
    if (!folder || folder.userId !== user.id) {
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

// PUT update order status

app.put('/api/orders/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Estado requerido' });
    }

    const existingOrder = await findOrderByCodeOrId(req.params.id);

    if (!existingOrder) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }

    if (status === 'completed' && existingOrder.status !== 'completed') {
      await deductOrderStock(existingOrder);
    }

    const order = await prisma.order.update({
      where: { id: existingOrder.id },
      data: { status }
    });

    res.json({ success: true, order: formatOrderForUi(order) });
  } catch (error) {
    console.error('Error al actualizar orden:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});


// GET all cards
app.get('/api/cards', authenticateToken, requireAdmin, (req, res) => {
    const cards = getCards();
    res.json({
        success: true,
        data: cards
    });
});

// POST new card
app.post('/api/cards', authenticateToken, requireAdmin, (req, res) => {
    const { id, name, pseudoName, hp, price, stock, imageUrl, types, set, rarity, supertype, number, total, language } = req.body;
    
    if (!id || !name || price === undefined || stock === undefined) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const cards = getCards();
    
    // Check if card already exists
    const existingIndex = cards.findIndex(c => c.id === id);
    if (existingIndex >= 0) {
        // Update stock and price
        cards[existingIndex].stock = parseInt(stock);
        cards[existingIndex].price = parseFloat(price);
    } else {
        // Add new card
        cards.push({
            id,
            name,
            pseudoName: pseudoName || '',
            hp: hp || 'N/A',
            price: parseFloat(price),
            stock: parseInt(stock),
            imageUrl,
            types: types || [],
            set: set || 'Unknown',
            rarity: rarity || 'Unknown',
            supertype: supertype || 'Unknown',
            number: number || req.body.number || id.split('-')[1] || '0',
            total: total || req.body.total || '???',
            language: language || req.body.language || 'English'
        });
    }

    saveCards(cards);
    
    res.json({ success: true, message: 'Card saved successfully' });
});

// POST update existing card stock and price
app.post('/api/cards/update', authenticateToken, requireAdmin, (req, res) => {
    const { id, price, stock } = req.body;
    
    if (!id || price === undefined || stock === undefined) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const cards = getCards();
    const existingIndex = cards.findIndex(c => c.id === id);
    
    if (existingIndex >= 0) {
        cards[existingIndex].stock = parseInt(stock);
        cards[existingIndex].price = parseFloat(price);
        saveCards(cards);
        res.json({ success: true, message: 'Card updated successfully' });
    } else {
        res.status(404).json({ success: false, message: 'Card not found' });
    }
});

// POST delete a card
app.post('/api/cards/delete', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ success: false, message: 'Missing card ID' });
    }
    let cards = getCards();
    const initialLength = cards.length;
    cards = cards.filter(c => c.id !== id);
    if (cards.length < initialLength) {
        saveCards(cards);
        res.json({ success: true, message: 'Card deleted successfully' });
    } else {
        res.status(404).json({ success: false, message: 'Card not found' });
    }
});

// GET all pending orders

app.get('/api/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: orders.map(formatOrderForUi) });
  } catch (error) {
    console.error('Error loading orders:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});


// GET history

app.get('/api/history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const history = await prisma.order.findMany({
      where: { status: { not: 'pending' } },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({ success: true, data: history.map(formatOrderForUi) });
  } catch (error) {
    console.error('Error loading order history:', error);
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

    let buyer = null;
    if (viaMessage) {
      const token = String(req.headers['authorization'] || '').split(' ')[1];
      if (!token) return res.status(401).json({ success: false, message: 'Inicia sesión para enviar el pedido por mensaje' });
      let decoded;
      try {
        decoded = await getAuth().verifyIdToken(token);
      } catch (_error) {
        return res.status(401).json({ success: false, message: 'Tu sesión venció. Inicia sesión otra vez' });
      }
      buyer = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid }, select: { id: true, name: true, username: true } });
      if (!buyer) return res.status(401).json({ success: false, message: 'Tu cuenta aún se está preparando. Intenta de nuevo en unos segundos' });
    }

    const folder = await prisma.folder.findUnique({ where: { id: folderId }, include: { cards: true } });
    if (!folder || !folder.isPublic) {
      return res.status(404).json({ success: false, message: 'Carpeta no encontrada' });
    }

    // Datos del vendedor: tema (para saber si recibe mensajes y si comparte sus datos bancarios) y datos para transferir
    const seller = await prisma.user.findUnique({ where: { id: folder.userId }, select: { name: true, fullName: true, rut: true, bankDetails: true, publicTheme: true } });
    const sellerTheme = seller?.publicTheme && typeof seller.publicTheme === 'object' ? seller.publicTheme : {};
    if (viaMessage) {
      if (folder.userId === buyer.id) return res.status(400).json({ success: false, message: 'No puedes enviarte un pedido a ti mismo' });
      if (sellerTheme.showMessageButton === 'off') return res.status(400).json({ success: false, message: 'Este vendedor no recibe pedidos por mensaje' });
    }

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

    // Completar descuenta el stock de las cartas de la carpeta en la misma transacción
    const updated = await prisma.$transaction(async (tx) => {
      if (status === 'completed') {
        for (const item of normalizeOrderItems(order.items)) {
          const id = String(item.id || '');
          if (!isUuid(id)) continue;
          const card = await tx.card.findFirst({ where: { id, folderId: order.folderId } });
          if (!card) continue;
          await tx.card.update({ where: { id }, data: { stock: Math.max(0, Number(card.stock || 0) - Number(item.quantity || 1)) } });
        }
      }
      return tx.order.update({ where: { id: order.id }, data: { status } });
    });

    res.json({ success: true, order: formatOrderForUi(updated) });
  } catch (error) {
    console.error('Error updating seller order:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// POST process order (discount stock using order code)

app.post('/api/process-order', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { code } = req.body || {};

    if (!code) {
      return res.status(400).json({ success: false, message: 'Código de pedido requerido' });
    }

    const order = await findOrderByCodeOrId(code);

    if (!order || order.status !== 'pending') {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado o ya procesado' });
    }

    await deductOrderStock(order);

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'completed' }
    });

    res.json({ success: true, message: 'Pedido procesado correctamente', order: formatOrderForUi(updatedOrder) });
  } catch (error) {
    console.error('Error processing order:', error);
    res.status(500).json({ success: false, message: 'Error interno al procesar el pedido' });
  }
});


// POST reject order

app.post('/api/reject-order', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { code } = req.body || {};

    if (!code) {
      return res.status(400).json({ success: false, message: 'Código de pedido requerido' });
    }

    const order = await findOrderByCodeOrId(code);

    if (!order || order.status !== 'pending') {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado o ya procesado' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'rejected' }
    });

    res.json({ success: true, message: 'Pedido rechazado correctamente', order: formatOrderForUi(updatedOrder) });
  } catch (error) {
    console.error('Error rejecting order:', error);
    res.status(500).json({ success: false, message: 'Error interno al rechazar el pedido' });
  }
});


// --- POKEMON TCG API PROXY CON CACHÉ ---
const tcgCache = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hora en milisegundos

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
        
        tcgCache.set(cacheKey, { timestamp: Date.now(), data });
        res.json(data);
    } catch (error) {
        console.error('TCG API Sets Error:', error);
        res.status(500).json({ error: 'Failed to fetch sets' });
    }
});

app.get('/api/tcg/cards', async (req, res) => {
    const query = req.query.q || '';
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
        
        tcgCache.set(cacheKey, { timestamp: Date.now(), data });
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

// Crear carpeta
app.post('/api/folders', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const { name, description, isPublic, tcg, color } = req.body;
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (!isShortText(name, 100) || !isOptionalText(description, 1000) || !isOptionalText(tcg, 60) || !isOptionalText(color, 40)
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

const toPublicSeller = (user, viewerUid = null) => {
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
    isOwner: Boolean(viewerUid && user.firebaseUid && user.firebaseUid === viewerUid)
  };
};

app.get('/api/folders/:id', optionalAuth, async (req, res) => {
  try {
    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id },
      include: {
        cards: {
          orderBy: { createdAt: 'asc' }
        },
        user: { select: PUBLIC_SELLER_SELECT }
      }
    });
    // Una carpeta privada no existe para nadie más que su dueño (mismo 404 que una carpeta inexistente)
    const isFolderOwner = Boolean(req.user?.sub && folder?.user?.firebaseUid && folder.user.firebaseUid === req.user.sub);
    if (!folder || (!folder.isPublic && !isFolderOwner)) return res.status(404).json({ success: false, message: 'Folder not found' });
    res.json({ success: true, folder: { ...folder, user: toPublicSeller(folder.user, req.user?.sub) } });
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
      
      const folder = await prisma.folder.findUnique({ where: { id: folderId } });
      if (!folder) return res.status(404).json({ success: false });

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
      res.status(500).json({ success: false });
    }
  });

  // Borrar carpeta
app.delete('/api/folders/:id', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
    
    if (!folder || folder.userId !== user.id) {
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
    
    if (!folder || folder.userId !== user.id) {
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
    
    if (!card || card.folder.userId !== user.id) {
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
      where: { stock: { gt: 0 }, imageUrl: { not: null }, folder: { isPublic: true } },
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
      where: { stock: { gt: 0 }, price: { not: null }, tcgId: { in: [...new Set(wanted.map((item) => item.tcgId))] }, folder: { isPublic: true, userId: { not: userId } } },
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
      prisma.wishlistItem.count({ where: { userId: user.id } }),
      prisma.wishlistItem.findMany({
        where: { userId: user.id },
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
    if (typeof receiverId !== 'string' || !isShortText(content, 1500000)) return badRequest(res, 'Mensaje inválido');
    if (!sender) return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    if (receiverId === sender.id || receiverId === sender.firebaseUid || receiverId === sender.username) {
      return res.status(400).json({ success: false, message: 'No puedes enviarte mensajes a ti mismo.' });
    }
    
    const receiver = await resolveUserByAnyId(receiverId);
    if (!receiver) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (receiver.id === sender.id) return res.status(400).json({ success: false, message: 'No puedes enviarte mensajes a ti mismo.' });

    const message = await prisma.message.create({
      data: {
        senderId: sender.id,
        receiverId: receiver.id,
        content
      }
    });
    res.json({ success: true, message });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Obtener mis mensajes recibidos
app.get('/api/messages/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });    if (!user) return res.status(401).json({ success: false, message: 'Usuario no encontrado' });

    const messages = await prisma.message.findMany({

      where: {
        OR: [
          { senderId: user.id },
          { receiverId: user.id }
        ]
      },

      orderBy: { createdAt: 'desc' }
    });
    const chatsMap = new Map();
    for (const msg of messages) {
      const partnerId = msg.senderId === user.id ? msg.receiverId : msg.senderId;
      if (partnerId === user.id || chatsMap.has(partnerId)) continue;
      chatsMap.set(partnerId, msg);
    }

    const chats = Array.from(chatsMap.values());
    const partnerIds = chats
      .map(msg => msg.senderId === user.id ? msg.receiverId : msg.senderId)
      .filter(Boolean);

    const partners = partnerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: partnerIds } },
          select: { id: true, firebaseUid: true, name: true, username: true, photoURL: true }
        })
      : [];

    const unreadCounts = messages.reduce((counts, msg) => {
      if (msg.senderId !== user.id && msg.receiverId === user.id && !msg.isRead) {
        counts.set(msg.senderId, (counts.get(msg.senderId) || 0) + 1);
      }
      return counts;
    }, new Map());

    const enrichedChats = chats.map(msg => {
      const partnerId = msg.senderId === user.id ? msg.receiverId : msg.senderId;
      const partner = partners.find(partnerUser => partnerUser.id === partnerId) || null;
      const unreadCount = unreadCounts.get(partnerId) || 0;

      return {
        ...msg,
        unreadCount,
        partner,
        otherUser: partner
      };
    });

    const totalUnread = Array.from(unreadCounts.values()).reduce((total, count) => total + count, 0);

    res.json({ success: true, messages: enrichedChats, chats: enrichedChats, totalUnread });
  } catch (error) {
    console.error('Error fetching messages/me:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Marcar mensaje como ledo
app.put('/api/messages/:id/read', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    
    if (!message || message.receiverId !== user.id) {
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
    
    res.json({ success: true, messages });
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
    if (!isShortText(content, 1500000)) return badRequest(res, 'Mensaje inválido');
    if (otherId === currentUser.id) {
      return res.status(400).json({ success: false, message: 'No puedes enviarte mensajes a ti mismo.' });
    }
    
    const message = await prisma.message.create({
      data: {
        senderId: currentUser.id,
        receiverId: otherId,
        content
      }
    });
    
    res.json({
      success: true,
      message,
      otherUser: {
        id: otherUser.id,
        firebaseUid: otherUser.firebaseUid,
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

// GET user chats (last message with each person)
app.get('/api/chats', authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    if (!currentUser) return res.status(401).json({ success: false });
    
    // Note: A real implementation would use a distinct query or group by.
    // For simplicity, we just fetch all messages for the user and group them in JS
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUser.id },
          { receiverId: currentUser.id }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const chatsMap = new Map();
    for (const msg of messages) {
      const otherId = msg.senderId === currentUser.id ? msg.receiverId : msg.senderId;
      if (otherId === currentUser.id) continue;
      if (!chatsMap.has(otherId)) {
        chatsMap.set(otherId, msg);
      }
    }
    
    const chats = Array.from(chatsMap.values());
    
    // We should also fetch the user info for each chat partner
    const otherIds = chats.map(c => c.senderId === currentUser.id ? c.receiverId : c.senderId);
    
    const users = await prisma.user.findMany({
      where: { id: { in: otherIds } },
      select: { id: true, firebaseUid: true, name: true, username: true, photoURL: true }
    });
    
    const unreadCounts = messages.reduce((counts, msg) => {
      if (msg.senderId !== currentUser.id && msg.receiverId === currentUser.id && !msg.isRead) {
        const otherId = msg.senderId;
        counts.set(otherId, (counts.get(otherId) || 0) + 1);
      }
      return counts;
    }, new Map());
    const totalUnread = Array.from(unreadCounts.values()).reduce((total, count) => total + count, 0);

    const enrichedChats = chats.map(c => {

      const partnerId = c.senderId === currentUser.id ? c.receiverId : c.senderId;
      const partner = users.find(u => u.id === partnerId) || {};
      return {
        ...c,
        unreadCount: unreadCounts.get(partnerId) || 0,
        partner,
        otherUser: partner
      };
    });
    
    res.json({ success: true, chats: enrichedChats, totalUnread });

  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});


// User profile management
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user.sub }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user });
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
    
    // Process image with sharp -> webp
    const imageProcessor = sharp(req.file.buffer).webp({ quality: 100 });
    
    const processedBuffer = await imageProcessor.toBuffer();
    
    let dominantColor = null;
    let complementaryColor = null;
    if (isBanner) {
      const { dominant } = await sharp(processedBuffer).stats();
      dominantColor = "rgb(" + dominant.r + ", " + dominant.g + ", " + dominant.b + ")";
      complementaryColor = "rgb(" + (255 - dominant.r) + ", " + (255 - dominant.g) + ", " + (255 - dominant.b) + ")";
    }

    if (!hasR2Config()) {
      return res.status(503).json({
        success: false,
        message: 'El servidor no tiene configurado R2 para guardar imágenes permanentes.',
        missingConfig: true
      });
    }

    const previousUser = isMessageImage || isCardImage ? null : await prisma.user.findUnique({
      where: { firebaseUid: req.user.sub },
      select: { photoURL: true, bannerBase64: true, wallpaperBase64: true }
    });

    const hash = crypto.randomBytes(16).toString('hex');
    const safeUid = String(req.user.sub || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = "Carpetazo.cl/Usuarios/" + safeUid + "/" + type + "/" + hash + ".webp";

    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: filename,
      Body: processedBuffer,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable'
    }));
    const publicUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, '') + "/" + filename;

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

    const previousImageUrl = isBanner
      ? previousUser?.bannerBase64
      : isWallpaper
        ? previousUser?.wallpaperBase64
        : previousUser?.photoURL;

    if (!isMessageImage && !isCardImage && previousImageUrl && previousImageUrl !== publicUrl) {
      await deleteR2ObjectByPublicUrl(previousImageUrl);
    }

    res.json({ success: true, url: publicUrl, dominantColor, complementaryColor });
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

    if (updateData.username !== undefined) {
      const username = validUsername(updateData.username);
      // Nombres antiguos que no cumplen la política se conservan mientras no se cambien
      const current = username ? null : await prisma.user.findUnique({ where: { firebaseUid }, select: { username: true } });
      if (!username && current?.username !== normalizeUsername(updateData.username)) {
        return res.status(400).json({ success: false, error: 'El usuario debe tener entre 3 y 20 caracteres: letras, números o _.' });
      }
      updateData.username = username || current.username;
    }

    for (const field of ['photoURL', 'bannerBase64', 'wallpaperBase64']) {
      if (updateData[field] !== undefined && !checkImageField(updateData[field])) {
        return res.status(400).json({ success: false, error: 'URL de imagen no permitida' });
      }
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

    const user = await prisma.user.update({
      where: { firebaseUid },
      data: {
        username: `deleted_${Date.now()}_${firebaseUid.slice(0, 8)}`,
        name: 'Usuario Eliminado',
        fullName: null,
        photoURL: null,
        bio: 'Cuenta eliminada'
      }
    });

    await prisma.folder.updateMany({
      where: { userId: user.id },
      data: { isPublic: false }
    });

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
        OR: publicUserLookup
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

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { folders, ...seller } = user;
    res.json({ success: true, user: { ...toPublicSeller(seller, req.user?.sub), folders } });
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

















