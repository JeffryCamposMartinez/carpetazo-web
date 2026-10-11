// Cartas publicadas: recientes, búsqueda y borrado.
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { CARD_SEARCH_TCG_ALIASES, sameCardMatch } from '../core/listing.js';
import { isValidComuna } from '../core/chileData.js';
import { isVerifiedSeller } from '../core/sellerTrust.js';
import { badRequest } from '../core/validation.js';
import { eligibleSales, loadLiveOffers, loadSales, marketAnchors, offersAnchor, referenceFromSales, suspiciousOffers } from '../core/priceIntegrity.js';

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

// Mis cartas para mandarlas por el chat: de carpetas públicas (scope=public) o no públicas (scope=private), con filtro por juego y nombre
router.get('/api/cards/mine', authenticateToken, async (req, res) => {
  try {
    const scope = req.query.scope === 'private' ? 'private' : 'public';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const tcgRaw = typeof req.query.tcg === 'string' ? req.query.tcg.trim() : '';
    const tcg = CARD_SEARCH_TCG_ALIASES[tcgRaw] || tcgRaw;
    if (q.length > 80 || tcg.length > 60 || /[\u0000-\u001f]/.test(q + tcg)) return badRequest(res, 'Búsqueda inválida');
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const where = {
      moderationState: 'visible',
      folder: { userId: user.id, isPublic: scope === 'public', moderationState: 'visible', ...(tcg ? { tcg } : {}) },
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {})
    };
    const [cards, groups] = await Promise.all([
      prisma.card.findMany({
        where, orderBy: [{ createdAt: 'desc' }], take: 80,
        select: { id: true, name: true, imageUrl: true, price: true, stock: true, data: true, folder: { select: { name: true, tcg: true } } }
      }),
      // Juegos disponibles en esta lista (sin el filtro de juego) para armar el filtro
      prisma.folder.findMany({ where: { userId: user.id, isPublic: scope === 'public', moderationState: 'visible', cards: { some: { moderationState: 'visible' } } }, select: { tcg: true }, distinct: ['tcg'] })
    ]);
    res.set('Cache-Control', 'private, no-store');
    res.json({
      success: true,
      tcgs: groups.map((group) => group.tcg).filter(Boolean).sort(),
      cards: cards.map(({ data, folder, ...card }) => ({ ...card, tcg: folder.tcg, folderName: folder.name, set: data && typeof data === 'object' && typeof data.set === 'string' ? data.set.slice(0, 80) : null }))
    });
  } catch (error) {
    console.error('Error listing my cards:', error);
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
const REFERENCE_MIN_SELLERS = 3;
const REFERENCE_MAX_IDS = 60;
const REFERENCE_SALES_DAYS = 180;
const roundClp = (value) => Math.max(10, Math.round(Number(value) / 10) * 10);
// { [tcgId]: { clp, sales } | { clp, sellers } } solo para las cartas que alcanzan el mínimo de vendedores y compradores distintos.
// Defensas contra la manipulación (ver core/priceIntegrity.js): una venta solo cuenta si está cerca de lo que piden otros vendedores,
// la referencia se calcula con un valor por vendedor, y las publicaciones sospechosas (muy baratas, de cuentas nuevas) no cuentan.
const mylReferencePrices = async (ids) => {
  const [sales, offers] = await Promise.all([
    loadSales({ tcg: 'Mitos y Leyendas', tcgIds: ids, days: REFERENCE_SALES_DAYS }),
    loadLiveOffers({ tcg: 'Mitos y Leyendas', tcgIds: ids })
  ]);
  const prices = {};
  for (const id of ids) {
    const cardOffers = offers.filter((offer) => offer.tcgId === id);
    const bySales = referenceFromSales(eligibleSales(sales.filter((sale) => sale.tcgId === id), offersAnchor(cardOffers)));
    if (bySales) { prices[id] = { clp: roundClp(bySales.value), sales: bySales.sales }; continue; }
    const flagged = suspiciousOffers(cardOffers);
    const fair = cardOffers.filter((offer) => !flagged.has(offer.cardId));
    const sellers = new Set(fair.map((offer) => offer.userId)).size;
    const anchor = sellers >= REFERENCE_MIN_SELLERS ? offersAnchor(fair, REFERENCE_MIN_SELLERS) : null;
    if (anchor) prices[id] = { clp: roundClp(anchor), sellers };
  }
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

// Últimas ventas completadas de una carta en este juego: solo fecha, precio y cantidad (sin comprador ni vendedor).
// Se descartan las autoventas y las que están muy lejos de lo que piden otros vendedores o del precio de mercado de TCGplayer.
const SALES_SHOWN = 10;
const recentSales = async (tcgId, tcg) => {
  const [sales, offers, market] = await Promise.all([
    loadSales({ tcg, tcgIds: [tcgId], days: 730 }),
    loadLiveOffers({ tcg, tcgIds: [tcgId] }),
    tcg === 'Pokemon' ? marketAnchors([tcgId]) : new Map()
  ]);
  const anchor = market.get(tcgId) || offersAnchor(offers);
  return eligibleSales(sales, anchor)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, SALES_SHOWN)
    .map((sale) => ({ at: sale.at, price: Math.round(sale.unit), quantity: sale.quantity }));
};

// Ficha pública de una carta a la venta: sus datos y todas las ofertas de esa misma carta (de menor a mayor precio)
const OFFERS_MAX = 50;
const publicText = (value) => (typeof value === 'string' ? value.slice(0, 400) : null);
const visibleCardWhere = { stock: { gt: 0 }, moderationState: 'visible', folder: { isPublic: true, moderationState: 'visible' } };
// El vendedor de una oferta: solo datos públicos y si está verificado (el correo y el teléfono no salen)
const publicOfferUser = ({ emailVerified, phone, ...user }) => ({ ...user, verified: isVerifiedSeller({ ...user, emailVerified, phone }) });

router.get('/api/cards/:id/offers', async (req, res) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return badRequest(res, 'Carta inválida');
    const card = await prisma.card.findFirst({
      where: { id: req.params.id, ...visibleCardWhere },
      select: { id: true, tcgId: true, name: true, imageUrl: true, price: true, stock: true, data: true, folder: { select: { tcg: true } } },
    });
    if (!card) return res.status(404).json({ success: false, message: 'Carta no encontrada' });

    const offers = await prisma.card.findMany({
      where: { ...visibleCardWhere, ...sameCardMatch(card), folder: { ...visibleCardWhere.folder, tcg: card.folder.tcg } },
      orderBy: [{ price: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: OFFERS_MAX,
      select: { id: true, price: true, stock: true, data: true, folder: { select: { id: true, name: true, user: { select: { name: true, username: true, photoURL: true, publicComuna: true, emailVerified: true, phone: true } } } } },
    });
    const sales = await recentSales(card.tcgId, card.folder.tcg);
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
      sales,
      stats: { copies: offers.reduce((sum, offer) => sum + (offer.stock || 0), 0), sellers: new Set(offers.map((offer) => offer.folder.user?.username || offer.folder.id)).size },
      offers: offers.map(({ data, ...offer }) => ({ ...offer, folder: { ...offer.folder, user: offer.folder.user ? publicOfferUser(offer.folder.user) : null }, language: field(data, 'language') })),
    });
  } catch (error) {
    console.error('Error loading card offers:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Historial del precio más bajo publicado de una carta (un punto por día, últimos 180 días)
router.get('/api/cards/:id/price-history', async (req, res) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return badRequest(res, 'Carta inválida');
    const card = await prisma.card.findFirst({ where: { id: req.params.id, ...visibleCardWhere }, select: { tcgId: true, folder: { select: { tcg: true } } } });
    if (!card) return res.status(404).json({ success: false, message: 'Carta no encontrada' });
    const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const rows = await prisma.cardPriceSnapshot.findMany({ where: { tcg: card.folder.tcg, tcgId: card.tcgId, day: { gte: since } }, orderBy: { day: 'asc' }, select: { day: true, lowest: true, offers: true } });
    // Precio de mercado de TCGplayer (solo Pokémon) y ventas reales completadas de la carta, en el mismo período
    const market = card.folder.tcg === 'Pokemon' ? await prisma.cardMarketSnapshot.findMany({ where: { tcgId: card.tcgId, day: { gte: since } }, orderBy: { day: 'asc' }, select: { day: true, clp: true } }) : [];
    const sales = (await recentSales(card.tcgId, card.folder.tcg)).filter((sale) => new Date(sale.at) >= since);
    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      success: true,
      points: rows.map((row) => ({ day: row.day.toISOString().slice(0, 10), lowest: row.lowest, offers: row.offers })),
      market: market.map((row) => ({ day: row.day.toISOString().slice(0, 10), clp: row.clp })),
      sales: sales.map((sale) => ({ day: new Date(sale.at).toISOString().slice(0, 10), price: sale.price, quantity: sale.quantity })),
    });
  } catch (error) {
    console.error('Error loading price history:', error);
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
    const seller = typeof req.query.seller === 'string' ? req.query.seller.trim().toLowerCase() : '';
    const page = Number.parseInt(req.query.page, 10) || 1;
    const comuna = typeof req.query.comuna === 'string' ? req.query.comuna.trim() : '';
    if (comuna && !isValidComuna(comuna)) return badRequest(res, 'Búsqueda inválida');
    if (seller && !/^[a-z0-9_]{3,40}$/.test(seller)) return badRequest(res, 'Búsqueda inválida');
    if (q.length > 80 || tcg.length > 60 || /[\u0000-\u001f]/.test(q + tcg) || !Object.hasOwn(CARD_SEARCH_SORTS, sort) || page < 1 || page > 1000) {
      return badRequest(res, 'Búsqueda inválida');
    }

    const where = {
      stock: { gt: 0 },
      moderationState: 'visible',
      folder: { isPublic: true, ...(tcg ? { tcg } : {}), ...(seller || comuna ? { user: { ...(seller ? { username: seller } : {}), ...(comuna ? { publicComuna: comuna } : {}) } } : {}) },
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
          folder: { select: { id: true, name: true, tcg: true, user: { select: { name: true, username: true, photoURL: true, publicComuna: true } } } },
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
