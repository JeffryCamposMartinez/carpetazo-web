import express from 'express';
import { prisma } from '../core/db.js';
import { badRequest } from '../core/validation.js';
import { indexedNames, searchTcgIndex } from '../core/tcgSearchIndex.js';
import { buildVocabulary, hasVocabulary, suggestQuery } from '../core/cardSuggest.js';
import { likeEscape, nameMatch } from '../core/cardSearch.js';
import { bulkPublishedRanges } from '../core/editionDates.js';
import { PRODUCT_ID, loadCatalogCard, loadCatalogSales } from '../core/catalogPage.js';
import { bumpMetric, searchKey } from '../core/metrics.js';
import { TCGDEX_CATEGORY } from '../core/tcgSync/tcgdex.js';

const router = express.Router();
const r2PublicUrl = (key) => {
  const base = String(process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  if (!base || !key) return null;
  return `${base}/${String(key).split('/').map((part) => encodeURIComponent(part).replace(/['()*!]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)).join('/')}`;
};

const clean = (value) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const SEARCH_CACHE_TTL = 30_000;
const SEARCH_CACHE_MAX = 500;
const searchCache = new Map();
const pendingSearches = new Map();

const cacheGet = (key) => {
  const entry = searchCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) { if (entry) searchCache.delete(key); return null; }
  searchCache.delete(key);
  searchCache.set(key, entry);
  return entry.value;
};
const cacheSet = (key, value) => {
  searchCache.delete(key);
  searchCache.set(key, { value, expiresAt: Date.now() + SEARCH_CACHE_TTL });
  while (searchCache.size > SEARCH_CACHE_MAX) searchCache.delete(searchCache.keys().next().value);
};

// Mismo orden que en las cartas a la venta: «Más vendidos» (pedidos confirmados de cualquier vendedor) y «Última edición» (fecha de la edición). Sin orden, por nombre.
const INDEX_SORTS = new Set(['best_selling', 'latest_edition']);
const RANKING_POOL = 3000;
const CARD_SELECT = {
  productId: true, categoryId: true, groupId: true, kind: true, name: true, cleanName: true,
  number: true, rarity: true, imageKey: true, sourceImageUrl: true, tcgplayerUrl: true,
  game: { select: { name: true } }, set: { select: { name: true } },
};
// Un código de carta («055», «055/», «055/165»): primero el número exacto, luego los que empiezan igual, y recién después el resto.
// El «/» final que agrega el buscador al escribir números no cuenta: «055/» también encuentra la carta con número «055».
const isCodeQuery = (text) => /^\d{1,4}\/?\d{0,4}$/.test(text);
const codeRankedPage = async (where, code, page, limit) => {
  const exact = { number: { equals: code, mode: 'insensitive' } };
  const sameSeries = { number: { startsWith: `${code}/`, mode: 'insensitive' } };
  const tiers = [{ AND: [where, exact] }, { AND: [where, sameSeries] }, { AND: [where, { OR: [{ number: null }, { NOT: { OR: [exact, sameSeries] } }] }] }];
  const rows = [];
  let skip = (page - 1) * limit;
  for (const tier of tiers) {
    if (rows.length >= limit) break;
    const count = await prisma.catalogCard.count({ where: tier });
    if (skip >= count) { skip -= count; continue; }
    rows.push(...await prisma.catalogCard.findMany({ where: tier, orderBy: [{ cleanName: 'asc' }, { productId: 'asc' }], skip, take: Math.min(limit - rows.length, count - skip), select: CARD_SELECT }));
    skip = 0;
  }
  return rows;
};
// «Última edición»: primero las cartas de ediciones con fecha confiable (de la más nueva a la más vieja) y al final las de fecha dudosa o sin fecha
const editionRankedPage = async (where, page, limit) => {
  const bulk = await bulkPublishedRanges();
  const inBulk = (range) => ({ set: { publishedOn: { gte: range.from, lt: range.to } } });
  const dated = { AND: [{ set: { publishedOn: { not: null } } }, ...bulk.map((range) => ({ NOT: inBulk(range) }))] };
  const rest = { OR: [{ set: { publishedOn: null } }, ...bulk.map(inBulk)] };
  const tiers = [
    { where: { AND: [where, dated] }, orderBy: [{ set: { publishedOn: 'desc' } }, { cleanName: 'asc' }, { productId: 'asc' }] },
    { where: { AND: [where, rest] }, orderBy: [{ cleanName: 'asc' }, { productId: 'asc' }] }
  ];
  const rows = [];
  let skip = (page - 1) * limit;
  for (const tier of tiers) {
    if (rows.length >= limit) break;
    const count = await prisma.catalogCard.count({ where: tier.where });
    if (skip >= count) { skip -= count; continue; }
    rows.push(...await prisma.catalogCard.findMany({ where: tier.where, orderBy: tier.orderBy, skip, take: Math.min(limit - rows.length, count - skip), select: CARD_SELECT }));
    skip = 0;
  }
  return rows;
};
const soldRankedPage = async (where, page, limit) => {
  const pool = await prisma.catalogCard.findMany({ where, orderBy: [{ cleanName: 'asc' }, { productId: 'asc' }], take: RANKING_POOL, select: { productId: true } });
  const ids = pool.map((card) => String(card.productId));
  const rows = ids.length ? await prisma.$queryRaw`
    SELECT elem->>'tcgId' AS "tcgId", SUM(GREATEST(1, COALESCE(NULLIF(elem->>'quantity', '')::numeric, 1)))::int AS "sold"
    FROM "Order" o, jsonb_array_elements(CASE WHEN jsonb_typeof(o."items") = 'array' THEN o."items" ELSE '[]'::jsonb END) AS elem
    WHERE o."status" = 'completed' AND elem->>'tcgId' = ANY(${ids}::text[])
    GROUP BY 1` : [];
  const sold = new Map(rows.map((row) => [row.tcgId, Number(row.sold)]));
  const ordered = [...pool].sort((a, b) => (sold.get(String(b.productId)) || 0) - (sold.get(String(a.productId)) || 0));
  const pageIds = ordered.slice((page - 1) * limit, page * limit).map((card) => card.productId);
  const found = pageIds.length ? await prisma.catalogCard.findMany({ where: { productId: { in: pageIds } }, select: CARD_SELECT }) : [];
  const byId = new Map(found.map((card) => [card.productId, card]));
  return pageIds.map((id) => byId.get(id)).filter(Boolean);
};

// «¿Quisiste decir…?» para los buscadores de cartas
router.get('/api/tcg/suggest', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < 3 || query.length > 80) return badRequest(res, 'Búsqueda inválida');
  try {
    if (!hasVocabulary()) {
      const names = indexedNames();
      const [mylNames, catalogNames] = await Promise.all([
        prisma.tcgProduct.findMany({ distinct: ['name'], select: { name: true } }).catch(() => []),
        names.length ? Promise.resolve([]) : prisma.catalogCard.findMany({ where: { kind: 'card', categoryId: { not: TCGDEX_CATEGORY } }, distinct: ['name'], select: { name: true } }).catch(() => []),
      ]);
      buildVocabulary([...names, ...mylNames.map((card) => card.name), ...catalogNames.map((card) => card.name)]);
    }
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ success: true, suggestion: suggestQuery(query) });
  } catch (error) {
    console.error('Error sugeriendo búsqueda:', error.message);
    return res.json({ success: true, suggestion: null });
  }
});

router.get('/api/tcg/search-index', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const game = typeof req.query.game === 'string' ? req.query.game.trim() : '';
  const page = Number.parseInt(req.query.page, 10) || 1;
  const sort = typeof req.query.sort === 'string' && INDEX_SORTS.has(req.query.sort) ? req.query.sort : '';
  if (query.length < 2 || query.length > 80 || game.length > 60 || page < 1 || page > 10000) return badRequest(res, 'Búsqueda inválida');
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
  const limit = 60;
  const searchText = /^\d+\/$/.test(query) ? query.slice(0, -1) : query; // «055/» se busca como «055»
  const value = clean(searchText);
  const byCode = !sort && isCodeQuery(searchText);
  const cacheKey = `${value}|${game}|${page}|${sort}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);
  if (pendingSearches.has(cacheKey)) return res.json(await pendingSearches.get(cacheKey));
  // Uno o varios juegos separados por coma (por ejemplo «Pokemon,Pokemon_Japan»): solo nombres simples, para no armar filtros a partir de texto libre
  const games = game ? game.split(',').map((name) => name.trim()).filter(Boolean) : [];
  if ((game && !games.length) || games.length > 4 || games.some((name) => !/^[A-Za-z_ ]{1,40}$/.test(name))) return badRequest(res, 'Búsqueda inválida');
  const gameWhere = games.length ? { game: { name: { in: games } } } : {};
  const where = {
    kind: 'card',
    categoryId: { not: TCGDEX_CATEGORY }, // las cartas en español son solo otra imagen de las inglesas: no salen como cartas aparte
    ...gameWhere,
    OR: [
      { cleanName: { contains: likeEscape(value) } },
      nameMatch(searchText),
      { number: { contains: likeEscape(searchText), mode: 'insensitive' } },
    ],
  };
  const run = (async () => {
   try {
    const total = await prisma.catalogCard.count({ where });
    const rows = sort === 'best_selling'
      ? await soldRankedPage(where, page, limit)
      : sort === 'latest_edition'
        ? await editionRankedPage(where, page, limit)
        : byCode
        ? await codeRankedPage(where, clean(searchText), page, limit)
        : await prisma.catalogCard.findMany({
        where,
        orderBy: sort === 'latest_edition'
          ? [{ set: { publishedOn: { sort: 'desc', nulls: 'last' } } }, { cleanName: 'asc' }, { productId: 'asc' }]
          : [{ cleanName: 'asc' }, { productId: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: CARD_SELECT,
      });
    let source = 'database';
    let hydratedRows = rows;
    let hydratedTotal = total;
    // La base es siempre la fuente de verdad. El índice solo aporta candidatos
    // para errores tipográficos; los datos finales se vuelven a leer desde DB.
    if (total === 0) {
      const similar = searchTcgIndex({ query, game, page, limit });
      const ids = (similar.cards || []).map((card) => Number(card.productId)).filter(Number.isInteger);
      if (ids.length) {
        hydratedRows = await prisma.catalogCard.findMany({
          where: { productId: { in: ids }, kind: 'card', ...gameWhere },
          orderBy: [{ cleanName: 'asc' }, { productId: 'asc' }],
          select: {
            productId: true, categoryId: true, groupId: true, kind: true, name: true, cleanName: true,
            number: true, rarity: true, imageKey: true, sourceImageUrl: true, tcgplayerUrl: true,
            game: { select: { name: true } }, set: { select: { name: true } },
          },
        });
        const order = new Map(ids.map((id, index) => [id, index])); // el mismo orden de cercanía que dio el índice
        hydratedRows.sort((a, b) => order.get(a.productId) - order.get(b.productId));
        hydratedTotal = similar.total || hydratedRows.length;
        source = 'database-similarity';
      }
    }
    const cards = hydratedRows.map((card) => ({
      id: `${card.categoryId}:${card.productId}`,
      productId: card.productId,
      categoryId: card.categoryId,
      groupId: card.groupId,
      kind: card.kind,
      name: card.name,
      number: card.number,
      rarity: card.rarity,
      game: card.game.name,
      setName: card.set.name,
      imageKey: card.imageKey,
      imageUrl: r2PublicUrl(card.imageKey),
      sourceImageUrl: card.sourceImageUrl,
      tcgplayerUrl: card.tcgplayerUrl,
    }));
    const response = { success: true, source, available: true, total: hydratedTotal, page, pages: Math.max(1, Math.ceil(hydratedTotal / limit)), cards };
    cacheSet(cacheKey, response);
    return response;
   } catch (error) {
    console.error('Error buscando catálogo TCG en la base de datos:', error.message);
    throw error;
   }
  })();
  pendingSearches.set(cacheKey, run);
  try {
    const response = await run;
    // Lo que se buscó y no existe en el catálogo (solo el texto buscado, sin datos de la persona)
    if (response.total === 0 && page === 1 && searchKey(query)) bumpMetric('search_empty', searchKey(query));
    return res.json(response);
  } catch { return res.status(503).json({ success: false, available: false, message: 'No se pudo consultar el catálogo' }); }
  finally { pendingSearches.delete(cacheKey); }
});

// Ficha pública de una carta del catálogo (página /catalogo/<id>): sus datos y las ofertas visibles en Carpetazo
router.get('/api/tcg/card/:productId', async (req, res) => {
  if (!PRODUCT_ID.test(req.params.productId)) return badRequest(res, 'Carta inválida');
  try {
    const found = await loadCatalogCard(prisma, Number(req.params.productId));
    if (!found) return res.status(404).set('Cache-Control', 'public, max-age=60').json({ success: false, message: 'Carta no encontrada' });
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    bumpMetric('catalog_view', found.card.gameLabel);
    return res.json({ success: true, ...found });
  } catch (error) {
    console.error('Error cargando la ficha del catálogo:', error.message);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Historial de precios registrados en Carpetazo (sin datos de mercado externo).
router.get('/api/tcg/card/:productId/price-history', async (req, res) => {
  if (!PRODUCT_ID.test(req.params.productId)) return badRequest(res, 'Carta inválida');
  try {
    const productId = Number(req.params.productId);
    const card = await prisma.catalogCard.findFirst({ where: { productId, kind: 'card' }, select: { game: { select: { name: true } } } });
    if (!card) return res.status(404).json({ success: false, message: 'Carta no encontrada' });
    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const [snapshots, sales] = await Promise.all([
      prisma.cardPriceSnapshot.findMany({ where: { tcg: card.game.name, tcgId: String(productId), day: { gte: since } }, orderBy: { day: 'asc' }, select: { day: true, lowest: true, offers: true } }),
      loadCatalogSales(prisma, productId, card.game.name, 365, 250),
    ]);
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.json({
      success: true,
      points: snapshots.map((row) => ({ day: row.day.toISOString().slice(0, 10), price: Math.round(row.lowest), offers: row.offers, type: 'publicado' })),
      sales: sales.map((sale) => ({ day: new Date(sale.at).toISOString().slice(0, 10), price: sale.price, quantity: sale.quantity, source: sale.source })),
    });
  } catch (error) {
    console.error('Error cargando el historial del catálogo:', error.message);
    return res.status(500).json({ success: false, message: 'Error interno' });
  }
});
export default router;
