// Cartas publicadas: recientes, búsqueda y borrado.
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { CARD_SEARCH_TCG_ALIASES } from '../core/listing.js';
import { badRequest } from '../core/validation.js';

const router = express.Router();

// Borrar carta de una carpeta
router.delete('/api/cards/:id', authenticateToken, async (req, res) => {
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
router.get('/api/cards/recent', async (req, res) => {
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

// Búsqueda pública de cartas a la venta (solo carpetas públicas y con stock)
const CARD_SEARCH_PAGE_SIZE = 24;
const CARD_SEARCH_SORTS = {
  recent: [{ createdAt: 'desc' }],
  price_asc: [{ price: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
  price_desc: [{ price: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
};
router.get('/api/cards/search', async (req, res) => {
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

export default router;
