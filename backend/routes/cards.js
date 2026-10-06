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

// Precio referencial de Mitos y Leyendas en Carpetazo, por carta:
// 1) mediana de las ventas completadas en los últimos 6 meses (mínimo 3 ventas);
// 2) si no hay ventas suficientes, mediana de lo que piden los vendedores. Cuenta un precio por vendedor (el más bajo)
//    y exige al menos 3 vendedores distintos, para que una sola persona no mueva la referencia.
const REFERENCE_MIN_SALES = 3;
const REFERENCE_MIN_SELLERS = 3;
const REFERENCE_MAX_IDS = 60;
const REFERENCE_SALES_DAYS = 180;
const roundClp = (value) => Math.max(10, Math.round(Number(value) / 10) * 10);
// { [tcgId]: { clp, sales } | { clp, sellers } } solo para las cartas que alcanzan el mínimo de ventas o de vendedores
const mylReferencePrices = async (ids) => {
  // Ventas completadas: la carta se identifica por el `tcgId` guardado en el pedido o, en los pedidos antiguos, por la carta que sigue existiendo
  const sales = await prisma.$queryRaw`
    SELECT s."tcgId", percentile_cont(0.5) WITHIN GROUP (ORDER BY s."unit") AS median, COUNT(*)::int AS n
    FROM (
      SELECT COALESCE(line->>'tcgId', c."tcgId") AS "tcgId", (line->>'price')::float AS "unit"
      FROM "Order" o
      JOIN "Folder" f ON f."id" = o."folderId"
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o."items"::jsonb) = 'array' THEN o."items"::jsonb ELSE '[]'::jsonb END) AS line
      LEFT JOIN "Card" c ON c."id" = line->>'id'
      WHERE o."status" = 'completed' AND f."tcg" = 'Mitos y Leyendas' AND o."createdAt" > now() - make_interval(days => ${REFERENCE_SALES_DAYS}::int)
        AND line->>'price' ~ '^[0-9]+(\\.[0-9]+)?$'
    ) s
    WHERE s."tcgId" = ANY(${ids}) AND s."unit" > 0
    GROUP BY s."tcgId" HAVING COUNT(*) >= ${REFERENCE_MIN_SALES}`;
  const rows = await prisma.$queryRaw`
    SELECT "tcgId", percentile_cont(0.5) WITHIN GROUP (ORDER BY "price") AS median, COUNT(*)::int AS sellers
    FROM (
      SELECT c."tcgId", f."userId", MIN(c."price") AS "price"
      FROM "Card" c JOIN "Folder" f ON f."id" = c."folderId"
      WHERE f."tcg" = 'Mitos y Leyendas' AND c."tcgId" = ANY(${ids}) AND c."stock" > 0 AND c."price" > 0
        AND c."moderationState" = 'visible' AND f."isPublic" = true AND f."moderationState" = 'visible'
      GROUP BY c."tcgId", f."userId"
    ) per_seller
    GROUP BY "tcgId" HAVING COUNT(*) >= ${REFERENCE_MIN_SELLERS}`;
  const prices = {};
  rows.forEach((row) => { prices[row.tcgId] = { clp: roundClp(row.median), sellers: row.sellers }; });
  sales.forEach((row) => { prices[row.tcgId] = { clp: roundClp(row.median), sales: row.n }; });
  return prices;
};

router.get('/api/cards/reference-prices', async (req, res) => {
  try {
    const ids = typeof req.query.ids === 'string' ? [...new Set(req.query.ids.split(','))] : [];
    if (ids.length === 0 || ids.length > REFERENCE_MAX_IDS || ids.some((id) => !/^[A-Za-z0-9_-]{1,40}$/.test(id))) {
      return badRequest(res, 'Cartas inválidas');
    }
    const prices = await mylReferencePrices(ids);
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ success: true, prices });
  } catch (error) {
    console.error('Error calculando precios referenciales:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Ficha pública de una carta a la venta: sus datos y todas las ofertas de esa misma carta (de menor a mayor precio)
const OFFERS_MAX = 50;
const publicText = (value) => (typeof value === 'string' ? value.slice(0, 400) : null);
const visibleCardWhere = { stock: { gt: 0 }, moderationState: 'visible', folder: { isPublic: true, moderationState: 'visible' } };
router.get('/api/cards/:id/offers', async (req, res) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return badRequest(res, 'Carta inválida');
    const card = await prisma.card.findFirst({
      where: { id: req.params.id, ...visibleCardWhere },
      select: { id: true, tcgId: true, name: true, imageUrl: true, price: true, stock: true, data: true, folder: { select: { tcg: true } } },
    });
    if (!card) return res.status(404).json({ success: false, message: 'Carta no encontrada' });

    const offers = await prisma.card.findMany({
      where: { ...visibleCardWhere, tcgId: card.tcgId, folder: { ...visibleCardWhere.folder, tcg: card.folder.tcg } },
      orderBy: [{ price: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: OFFERS_MAX,
      select: { id: true, price: true, stock: true, data: true, folder: { select: { id: true, name: true, user: { select: { name: true, username: true, photoURL: true } } } } },
    });
    const reference = card.folder.tcg === 'Mitos y Leyendas' ? (await mylReferencePrices([card.tcgId]))[card.tcgId] || null : null;
    const field = (data, key) => (data && typeof data === 'object' ? publicText(data[key]) : null);

    // Solo campos públicos: el JSON `data` de la carta puede traer más cosas
    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      success: true,
      card: {
        id: card.id, tcgId: card.tcgId, name: card.name, imageUrl: card.imageUrl, tcg: card.folder.tcg,
        set: field(card.data, 'set'), rarity: field(card.data, 'rarity'), number: field(card.data, 'number'), type: field(card.data, 'type'),
        race: field(card.data, 'race'), cost: field(card.data, 'cost'), effect: field(card.data, 'effect'),
      },
      reference,
      offers: offers.map(({ data, ...offer }) => ({ ...offer, language: field(data, 'language') })),
    });
  } catch (error) {
    console.error('Error loading card offers:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Búsqueda pública de cartas a la venta (solo carpetas públicas y con stock)
// 60 se reparte exacto en 2, 3, 4, 5 y 6 columnas: la última fila nunca queda con huecos
const CARD_SEARCH_PAGE_SIZE = 60;
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
          createdAt: true,
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
