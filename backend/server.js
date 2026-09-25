import helmet from 'helmet';
import 'dotenv/config';
import rateLimit from 'express-rate-limit';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
    return res.status(401).json({ success: false, message: 'Token de autenticaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n requerido' });
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = decodedToken; // Contains user payload (uid, email, etc.)
    req.user.sub = decodedToken.uid; // Ensure 'sub' maps to 'uid' for backwards compatibility
    next();
  } catch (error) {
    console.error('Error al verificar token Firebase:', error.message);
    return res.status(403).json({ success: false, message: 'Token de autenticaciÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³n invÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡lido o expirado' });
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
    const envAdmin = isAdminEmail(req.user.email || user?.email);

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

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    service: 'carpetazo-api',
    environment: process.env.NODE_ENV || 'development',
    commit: process.env.GIT_COMMIT || null,
    time: new Date().toISOString()
  });
});

app.set('trust proxy', 1);

const rateLimitMax = Number.parseInt(process.env.RATE_LIMIT_MAX || '2000', 10);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.isFinite(rateLimitMax) && rateLimitMax > 0 ? rateLimitMax : 2000,
  skip: (req) => req.method === 'OPTIONS',
  message: 'Demasiadas peticiones desde esta IP, por favor intenta de nuevo mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡s tarde.',
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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
          username: req.body.username || req.body.displayName?.toLowerCase().replace(/\s+/g, '_') || firebaseUid,
          photoURL: req.body.photoURL || null,
          role: isAdminEmail(email) ? 'admin' : 'user'
        }
      });
    } else {
      user = await prisma.user.update({
        where: { firebaseUid },
        data: {
          name: req.body.displayName || user.name,
          username: req.body.username || user.username || user.name?.toLowerCase().replace(/\s+/g, '_'),
          photoURL: req.body.photoURL || user.photoURL,
          ...(isAdminEmail(email) && user.role !== 'admin' ? { role: 'admin' } : {})
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
    
    await prisma.card.delete({
      where: { id: req.params.cardId, folderId: req.params.id }
    });
    
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
    const items = normalizeOrderItems(body.items || body.orderItems || []);
    const total = Number(body.total ?? body.totalAmount ?? 0);

    if (!items.length) {
      return res.status(400).json({ success: false, message: 'El pedido no tiene cartas' });
    }

    let sellerId = body.sellerId || null;
    let folderName = body.folderName || 'Catálogo';

    if ((!sellerId || !body.folderName) && body.folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: body.folderId } });
      sellerId = sellerId || folder?.userId || null;
      folderName = body.folderName || folder?.name || folderName;
    }

    const code = await generateOrderCode();
    const order = await prisma.order.create({
      data: {
        code,
        sellerId: sellerId || 'legacy',
        buyerName: body.buyerName || 'Cliente por WhatsApp',
        folderId: body.folderId || 'legacy',
        folderName,
        items,
        total: Number.isFinite(total) ? total : 0,
        status: 'pending'
      }
    });

    res.json({ success: true, code, order: formatOrderForUi(order) });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: 'Error interno al crear el pedido' });
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


// --- POKEMON TCG API PROXY CON CACHÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â° ---
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Crear carpeta
app.post('/api/folders', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const { name, description, isPublic, tcg, color } = req.body;
    
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener detalles de una carpeta (y sus cartas)
app.get('/api/folders/:id', async (req, res) => {
  try {
    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id },
      include: { cards: true, user: { select: { name: true, email: true, username: true, photoURL: true, firebaseUid: true } } }
    });
    if (!folder) return res.status(404).json({ success: false, message: 'Folder not found' });
    res.json({ success: true, folder });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

  // Registrar visita a carpeta
  app.post('/api/folders/:id/visit', async (req, res) => {
    try {
      const folderId = req.params.id;
      const { currentWeek } = req.body;
      
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
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
  }
});


// --- RUTAS PÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡BLICAS Y MENSAJES ---

// Obtener todas las carpetas pblicas
app.get('/api/folders', async (req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      where: { isPublic: true },
      include: { user: { select: { name: true, username: true, photoURL: true, firebaseUid: true } }, _count: { select: { cards: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, folders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enviar un mensaje
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const sender = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const { receiverId, content } = req.body;
    
    if (!receiverId || !content) return res.status(400).json({ success: false, message: 'Missing fields' });
    
    const message = await prisma.message.create({
      data: {
        senderId: sender.id,
        receiverId,
        content
      }
    });
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Obtener mis mensajes recibidos
app.get('/api/messages/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const messages = await prisma.message.findMany({
      where: { receiverId: user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({
      success: true,
      messages,
      otherUser: {
        id: otherUser.id,
        firebaseUid: otherUser.firebaseUid,
        name: otherUser.name,
        username: otherUser.username,
        photoURL: otherUser.photoURL
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
  }
});


const resolveUserByAnyId = async (identifier) => {
  const value = String(identifier || '').trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const where = [{ firebaseUid: value }, { username: value }];
  if (isUuid) where.push({ id: value });
  return prisma.user.findFirst({ where: { OR: where } });
};

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
    
    const enrichedChats = chats.map(c => {
      const partnerId = c.senderId === currentUser.id ? c.receiverId : c.senderId;
      const partner = users.find(u => u.id === partnerId) || {};
      return {
        ...c,
        partner,
        otherUser: partner
      };
    });
    
    res.json({ success: true, chats: enrichedChats });
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

const hasR2Config = () => Boolean(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME &&
  process.env.R2_PUBLIC_URL
);

app.post('/api/users/upload-image', authenticateToken, (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'La imagen debe pesar menos de 10 MB.' });
    }

    return res.status(400).json({ success: false, message: error.message || 'No se pudo leer la imagen.' });
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se envió ninguna imagen.' });
    }

    const type = req.body.type; // 'avatar' or 'banner'
    if (!['avatar', 'banner'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Tipo de imagen inválido.' });
    }

    const isBanner = type === 'banner';
    
    // Process image with sharp -> webp
    const imageProcessor = sharp(req.file.buffer).webp({ quality: 85 });
    
    if (isBanner) {
      imageProcessor.resize({ width: 1200, height: 400, fit: 'cover' });
    } else {
      imageProcessor.resize({ width: 400, height: 400, fit: 'cover' });
    }

    const processedBuffer = await imageProcessor.toBuffer();
    
    let dominantColor = null;
    let complementaryColor = null;
    if (isBanner) {
      const { dominant } = await sharp(processedBuffer).stats();
      dominantColor = "rgb(" + dominant.r + ", " + dominant.g + ", " + dominant.b + ")";
      complementaryColor = "rgb(" + (255 - dominant.r) + ", " + (255 - dominant.g) + ", " + (255 - dominant.b) + ")";
    }

    const hash = crypto.randomBytes(16).toString('hex');
    const filename = "Carpetazo.cl/users/" + req.user.sub + "/" + type + "_" + hash + ".webp";
    let publicUrl;

    if (hasR2Config()) {
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filename,
        Body: processedBuffer,
        ContentType: 'image/webp',
      }));
      publicUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, '') + "/" + filename;
    } else {
      console.warn('R2 no configurado. Guardando imagen de perfil como data URL temporal.');
      publicUrl = "data:image/webp;base64," + processedBuffer.toString('base64');
    }

    const updateData = isBanner 
      ? { bannerBase64: publicUrl, bannerDominantColor: dominantColor, bannerComplementaryColor: complementaryColor }
      : { photoURL: publicUrl };

    await prisma.user.update({
      where: { firebaseUid: req.user.sub },
      data: updateData
    });

    res.json({ success: true, url: publicUrl, dominantColor, complementaryColor });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, message: 'Error procesando o subiendo la imagen' });
  }
});

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

    if (updateData.username) {
      updateData.username = String(updateData.username)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
    }

    if (updateData.publicTheme !== undefined) {
      if (!updateData.publicTheme || typeof updateData.publicTheme !== 'object' || Array.isArray(updateData.publicTheme)) {
        return res.status(400).json({ success: false, error: 'Invalid public theme' });
      }

      const allowedThemeFields = ['id', 'name', 'primary', 'secondary', 'accent', 'surface', 'card', 'text', 'font'];
      updateData.publicTheme = Object.fromEntries(
        Object.entries(updateData.publicTheme)
          .filter(([key, value]) => allowedThemeFields.includes(key) && typeof value === 'string')
          .map(([key, value]) => [key, value.slice(0, 40)])
      );
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
    const username = String(req.query.username || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
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

app.get('/api/users/:username', async (req, res) => {
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
      include: {
        folders: {
          where: { isPublic: true },
          include: {
            _count: { select: { cards: true } },
            user: { select: { name: true, username: true, photoURL: true, firebaseUid: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});
// --- TCGCSV LOCAL DB ---
app.get('/api/tcg/categories', async (req, res) => {
  try {
    const categories = await prisma.tcgCategory.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
    res.status(500).json({ success: false, error: error.message });
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
    const productIds = [...new Set(ids.map(id => parseInt(id)).filter(id => Number.isFinite(id)))];

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

app.get('/api/tcg/:categoryId/:groupId/products', async (req, res) => {
  try {
    const { categoryId, groupId } = req.params;
    const { mylType, mylRace, mylFrequency, mylCost, physicalProductId } = req.query;

    let whereClause = { categoryId: parseInt(categoryId) };
    if (physicalProductId) whereClause.physicalProductId = parseInt(physicalProductId);
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
      orderBy: [
        { physicalProductId: 'asc' },
        { name: 'asc' }
      ]
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// --- Image Cache Proxy ---

app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/images/myl', express.static(path.join(__dirname, 'data/images/myl')));




app.get('/api/tcg/physical-products', async (req, res) => {
  try {
    const products = await prisma.tcgPhysicalProduct.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
      whereClause.physicalProductId = parseInt(physicalProductId);
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
      orderBy: [
        { physicalProductId: 'asc' },
        { name: 'asc' }
      ]
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
    console.log(`ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ Servidor backend corriendo en http://localhost:${port}`);
});
















