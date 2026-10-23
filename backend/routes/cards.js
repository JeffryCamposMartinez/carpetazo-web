// Cartas publicadas: recientes, búsqueda y borrado.
import express from 'express';
import { nameMatch, searchFragments, similarCardName } from '../core/cardSearch.js';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { userBoostLevels } from '../core/entitlements.js';
import { bulkPublishedRanges, reliablePublishedOn } from '../core/editionDates.js';
import { CARD_SEARCH_TCG_ALIASES, sameCardMatch } from '../core/listing.js';
import { isValidComuna } from '../core/chileData.js';
import { PUBLIC_PLAN_RELATIONS_SELECT, withPublicPlanBadge } from '../core/publicSeller.js';
import { isVerifiedSeller } from '../core/sellerTrust.js';
import { loadCatalogSales } from '../core/catalogPage.js';
import { badRequest } from '../core/validation.js';
import { bumpMetric, searchKey } from '../core/metrics.js';
import { eligibleSales, loadInPersonPriceSignals, loadLiveOffers, loadSales, marketAnchors, offersAnchor, referenceFromSales, referenceSales, suspiciousOffers } from '../core/priceIntegrity.js';

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
    const scope = ['private', 'all'].includes(req.query.scope) ? req.query.scope : 'public';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const tcgRaw = typeof req.query.tcg === 'string' ? req.query.tcg.trim() : '';
    const tcg = CARD_SEARCH_TCG_ALIASES[tcgRaw] || tcgRaw;
    if (q.length > 80 || tcg.length > 60 || /[\u0000-\u001f]/.test(q + tcg)) return badRequest(res, 'Búsqueda inválida');
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const where = {
      moderationState: 'visible',
      folder: { userId: user.id, ...(scope === 'all' ? {} : { isPublic: scope === 'public' }), moderationState: 'visible', ...(tcg ? { tcg } : {}) },
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {})
    };
    const [cards, groups] = await Promise.all([
      prisma.card.findMany({
        where, orderBy: [{ createdAt: 'desc' }], take: 80,
        select: { id: true, name: true, imageUrl: true, price: true, stock: true, data: true, folder: { select: { id: true, name: true, tcg: true } } }
      }),
      // Juegos disponibles en esta lista (sin el filtro de juego) para armar el filtro
      prisma.folder.findMany({ where: { userId: user.id, ...(scope === 'all' ? {} : { isPublic: scope === 'public' }), moderationState: 'visible', cards: { some: { moderationState: 'visible' } } }, select: { tcg: true }, distinct: ['tcg'] })
    ]);
    res.set('Cache-Control', 'private, no-store');
    res.json({
      success: true,
      tcgs: groups.map((group) => group.tcg).filter(Boolean).sort(),
      cards: cards.map(({ data, folder, ...card }) => ({ ...card, tcg: folder.tcg, folderId: folder.id, folderName: folder.name, set: data && typeof data === 'object' && typeof data.set === 'string' ? data.set.slice(0, 80) : null }))
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
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
// { [tcgId]: { clp, sales } | { clp, sellers } | { clp, inPersonSales } }.
// Defensas contra la manipulación (ver core/priceIntegrity.js): una venta solo cuenta si está cerca de lo que piden otros vendedores,
// la referencia se calcula con un valor por vendedor, y las publicaciones sospechosas (muy baratas, de cuentas nuevas) no cuentan.
const mylReferencePrices = async (ids) => {
  const [sales, inPersonSignals, offers] = await Promise.all([
    loadSales({ tcg: 'Mitos y Leyendas', tcgIds: ids, days: REFERENCE_SALES_DAYS }),
    loadInPersonPriceSignals({ tcg: 'Mitos y Leyendas', tcgIds: ids, days: REFERENCE_SALES_DAYS }),
    loadLiveOffers({ tcg: 'Mitos y Leyendas', tcgIds: ids })
  ]);
  const prices = {};
  for (const id of ids) {
    const cardOffers = offers.filter((offer) => offer.tcgId === id);
    const bySales = referenceFromSales(referenceSales(sales.filter((sale) => sale.tcgId === id), offersAnchor(cardOffers)));
    if (bySales) { prices[id] = { clp: roundClp(bySales.value), sales: bySales.sales }; continue; }
    // Declaraciones presenciales: precio publicado por unidad, agrupado por vendedor. No se presentan
    // como compras verificadas; exigen tres vendedores y pasan el mismo filtro de distancia al ancla.
    const declared = inPersonSignals.filter((sale) => sale.tcgId === id && sale.unit > 0);
    const declarationAnchor = offersAnchor(cardOffers) || (declared.length ? median(declared.map((sale) => sale.unit)) : null);
    const eligibleDeclarations = declarationAnchor
      ? declared.filter((sale) => sale.unit >= declarationAnchor * 0.25 && sale.unit <= declarationAnchor * 4)
      : declared;
    const perSellerPrices = new Map();
    for (const sale of eligibleDeclarations) perSellerPrices.set(sale.sellerId, [...(perSellerPrices.get(sale.sellerId) || []), sale.unit]);
    if (perSellerPrices.size >= REFERENCE_MIN_SELLERS) {
      const declaredValue = median([...perSellerPrices.values()].map((values) => median(values)));
      prices[id] = { clp: roundClp(declaredValue), sellers: perSellerPrices.size, inPersonSales: eligibleDeclarations.length };
      continue;
    }
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
    if (ids.length === 0 || ids.length > REFERENCE_MAX_IDS || ids.some((id) => !/^[A-Za-z0-9:_-]{1,40}$/.test(id))) {
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
const publicOfferUser = (user) => {
  const verified = isVerifiedSeller(user);
  const { emailVerified: _email, phone: _phone, ...safe } = withPublicPlanBadge(user);
  return { ...safe, verified };
};

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
      select: { id: true, price: true, stock: true, data: true, folder: { select: { id: true, name: true, user: { select: { name: true, username: true, photoURL: true, publicComuna: true, emailVerified: true, phone: true, ...PUBLIC_PLAN_RELATIONS_SELECT } } } } },
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
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const rows = await prisma.cardPriceSnapshot.findMany({ where: { tcg: card.folder.tcg, tcgId: card.tcgId, day: { gte: since } }, orderBy: { day: 'asc' }, select: { day: true, lowest: true, offers: true } });
    // Solo señales de Carpetazo: precio publicado aquí y ventas confirmadas de la carta.
    const sales = await loadCatalogSales(prisma, card.tcgId, card.folder.tcg, 365, 250);
    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      success: true,
      points: rows.map((row) => ({ day: row.day.toISOString().slice(0, 10), lowest: row.lowest, offers: row.offers })),
      sales: sales.map((sale) => ({ day: new Date(sale.at).toISOString().slice(0, 10), price: sale.price, quantity: sale.quantity, source: sale.source })),
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
// «Más vendidos» y «Última edición» dependen de las ventas y del catálogo, no de una columna: se ordenan en memoria
// sobre las cartas que coinciden (las RANKING_POOL más nuevas) y se entrega solo la página pedida.
const RANKED_SORTS = new Set(['best_selling', 'latest_edition']);
const RANKING_POOL = 3000;
const CARD_SEARCH_SELECT = {
  id: true,
  name: true,
  tcgId: true,
  imageUrl: true,
  price: true,
  stock: true,
  createdAt: true,
  data: true,
  folder: { select: { id: true, name: true, tcg: true, userId: true, user: { select: { name: true, username: true, photoURL: true, publicComuna: true } } } },
};
const rankedCardSlice = async (where, sort, skip, take) => {
  const pool = await prisma.card.findMany({ where, orderBy: [{ createdAt: 'desc' }], take: RANKING_POOL, select: { id: true, tcgId: true, createdAt: true } });
  const score = new Map(); // id de la carta → puntaje (mayor = antes)
  if (sort === 'best_selling') {
    // Unidades vendidas de esa carta del catálogo en pedidos confirmados (el pedido guarda el tcgId de cada línea)
    const tcgIds = [...new Set(pool.map((card) => card.tcgId).filter(Boolean))];
    const rows = tcgIds.length ? await prisma.$queryRaw`
      SELECT elem->>'tcgId' AS "tcgId", SUM(GREATEST(1, COALESCE(NULLIF(elem->>'quantity', '')::numeric, 1)))::int AS "sold"
      FROM "Order" o, jsonb_array_elements(CASE WHEN jsonb_typeof(o."items") = 'array' THEN o."items" ELSE '[]'::jsonb END) AS elem
      WHERE o."status" = 'completed' AND elem->>'tcgId' = ANY(${tcgIds}::text[])
      GROUP BY 1` : [];
    const sold = new Map(rows.map((row) => [row.tcgId, Number(row.sold)]));
    pool.forEach((card) => score.set(card.id, sold.get(card.tcgId) || 0));
  } else {
    // Fecha de publicación de la edición del catálogo a la que pertenece la carta: Pokémon, One Piece, Magic, etc. están en el catálogo importado (CatalogCard);
    // Mitos y Leyendas guarda su id con «myl:» y sus ediciones en TcgProduct
    const published = new Map(); // tcgId de la carta → fecha de su edición
    const numeric = [...new Set(pool.map((card) => card.tcgId).filter((id) => /^\d{1,12}$/.test(String(id || ''))))];
    const catalog = numeric.length ? await prisma.catalogCard.findMany({ where: { productId: { in: numeric.map(Number) } }, select: { productId: true, set: { select: { publishedOn: true } } } }) : [];
    const bulk = await bulkPublishedRanges(); // las fechas de carga masiva no son la fecha de la edición: esas cartas van al final
    catalog.forEach((row) => { const date = reliablePublishedOn(row.set?.publishedOn, bulk); published.set(String(row.productId), date ? date.getTime() : -Infinity); });
    const myl = [...new Set(pool.map((card) => card.tcgId).filter((id) => String(id || '').startsWith('myl:')))];
    const products = myl.length ? await prisma.tcgProduct.findMany({ where: { productId: { in: myl.map((id) => id.slice(4)) } }, select: { productId: true, group: { select: { publishedOn: true } } } }) : [];
    products.forEach((row) => published.set(`myl:${row.productId}`, row.group?.publishedOn ? row.group.publishedOn.getTime() : -Infinity));
    pool.forEach((card) => score.set(card.id, published.get(String(card.tcgId)) ?? -Infinity));
  }
  const ordered = [...pool].sort((a, b) => (score.get(b.id) - score.get(a.id)) || (b.createdAt - a.createdAt));
  const pageIds = ordered.slice(skip, skip + take).map((card) => card.id);
  const rows = pageIds.length ? await prisma.card.findMany({ where: { id: { in: pageIds } }, select: CARD_SEARCH_SELECT }) : [];
  const byId = new Map(rows.map((card) => [card.id, card]));
  return pageIds.map((id) => byId.get(id)).filter(Boolean);
};
const cardSlice = (where, sort, skip, take) => RANKED_SORTS.has(sort)
  ? rankedCardSlice(where, sort, skip, take)
  : prisma.card.findMany({ where, orderBy: CARD_SEARCH_SORTS[sort], skip, take, select: CARD_SEARCH_SELECT });

// La prioridad de plan se aplica a todos los ordenamientos y páginas, conservando el orden seleccionado dentro de cada nivel.
const prioritizedCardPage = async (where, sort, skip, take, boosts) => {
  const priorityUsers = [...boosts.keys()];
  if (!priorityUsers.length) return cardSlice(where, sort, skip, take);
  const storeUsers = priorityUsers.filter((id) => boosts.get(id) === 2);
  const legendUsers = priorityUsers.filter((id) => boosts.get(id) === 1);
  const groups = [
    ...(storeUsers.length ? [{ level: 2, where: { ...where, folder: { ...where.folder, userId: { in: storeUsers } } } }] : []),
    ...(legendUsers.length ? [{ level: 1, where: { ...where, folder: { ...where.folder, userId: { in: legendUsers } } } }] : []),
    { level: 0, where: { ...where, folder: { ...where.folder, userId: { notIn: priorityUsers } } } }
  ];
  const counts = await Promise.all(groups.map(({ where: groupWhere }) => prisma.card.count({ where: groupWhere })));
  const cards = [];
  let offset = skip;
  for (let index = 0; index < groups.length && cards.length < take; index += 1) {
    const groupCount = counts[index];
    if (offset >= groupCount) { offset -= groupCount; continue; }
    const amount = Math.min(take - cards.length, groupCount - offset);
    const rows = await cardSlice(groups[index].where, sort, offset, amount);
    cards.push(...rows.map((card) => ({ ...card, _boost: boosts.get(card.folder.userId) || 0 })));
    offset = 0;
  }
  return cards;
};
router.get('/api/cards/search', async (req, res) => {
  try {
    // El buscador agrega «/» al escribir números («055/»): «Kangaskhan ex - 055» también debe aparecer
    const q = (typeof req.query.q === 'string' ? req.query.q.trim() : '').replace(/^(\d+)\/$/, '$1');
    const tcgRaw = typeof req.query.tcg === 'string' ? req.query.tcg.trim() : '';
    const tcg = CARD_SEARCH_TCG_ALIASES[tcgRaw] || tcgRaw;
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'recent';
    const seller = typeof req.query.seller === 'string' ? req.query.seller.trim().toLowerCase() : '';
    const page = Number.parseInt(req.query.page, 10) || 1;
    const comuna = typeof req.query.comuna === 'string' ? req.query.comuna.trim() : '';
    if (comuna && !isValidComuna(comuna)) return badRequest(res, 'Búsqueda inválida');
    if (seller && !/^[a-z0-9_]{3,40}$/.test(seller)) return badRequest(res, 'Búsqueda inválida');
    if (q.length > 80 || tcg.length > 60 || /[\u0000-\u001f]/.test(q + tcg) || !(Object.hasOwn(CARD_SEARCH_SORTS, sort) || RANKED_SORTS.has(sort)) || page < 1 || page > 1000) {
      return badRequest(res, 'Búsqueda inválida');
    }

    const where = {
      stock: { gt: 0 },
      moderationState: 'visible',
      folder: { isPublic: true, ...(tcg ? { tcg } : {}), ...(seller || comuna ? { user: { ...(seller ? { username: seller } : {}), ...(comuna ? { publicComuna: comuna } : {}) } } : {}) },
      ...(q ? nameMatch(q) : {}),
    };
    const fragments = searchFragments(q);
    if (fragments.length) {
      const { AND: _name, ...publicScope } = where;
      const candidates = await prisma.card.findMany({
        where: { ...publicScope, OR: fragments.map((fragment) => ({ name: { contains: fragment, mode: 'insensitive' } })) },
        distinct: ['name'],
        select: { name: true },
      });
      const similarNames = candidates.filter((card) => similarCardName(card.name, q)).map((card) => card.name);
      delete where.AND;
      where.OR = [nameMatch(q), { name: { in: similarNames } }];
    }
    const boosts = await userBoostLevels(prisma);
    const [total, cards] = await Promise.all([
      prisma.card.count({ where }),
      prioritizedCardPage(where, sort, (page - 1) * CARD_SEARCH_PAGE_SIZE, CARD_SEARCH_PAGE_SIZE, boosts)
    ]);

    // Lo que se busca y nadie tiene a la venta (solo el texto, sin datos de la persona): muestra qué cartas faltan en el mercado
    if (total === 0 && page === 1 && !seller && !comuna && searchKey(q)) bumpMetric('search_no_offers', searchKey(q));

    // Solo campos públicos: el JSON `data` de la carta puede traer más cosas
    res.json({
      success: true,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / CARD_SEARCH_PAGE_SIZE)),
      cards: cards.map(({ data, _boost, folder, ...card }) => ({
        ...card,
        folder: { id: folder.id, name: folder.name, tcg: folder.tcg, user: folder.user },
        priorityLevel: _boost || 0,
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
