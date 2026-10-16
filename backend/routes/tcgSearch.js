import express from 'express';
import { prisma } from '../core/db.js';
import { badRequest } from '../core/validation.js';
import { searchTcgIndex } from '../core/tcgSearchIndex.js';

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

router.get('/api/tcg/search-index', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const game = typeof req.query.game === 'string' ? req.query.game.trim() : '';
  const page = Number.parseInt(req.query.page, 10) || 1;
  if (query.length < 2 || query.length > 80 || game.length > 60 || page < 1 || page > 10000) return badRequest(res, 'Búsqueda inválida');
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
  const limit = 60;
  const value = clean(query);
  const cacheKey = `${value}|${game}|${page}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);
  if (pendingSearches.has(cacheKey)) return res.json(await pendingSearches.get(cacheKey));
  const gameWhere = game ? { game: { name: game } } : {};
  const where = {
    kind: 'card',
    ...gameWhere,
    OR: [
      { cleanName: { contains: value } },
      { name: { contains: query, mode: 'insensitive' } },
      { number: { contains: query, mode: 'insensitive' } },
    ],
  };
  const run = (async () => {
   try {
    const [total, rows] = await prisma.$transaction([
      prisma.catalogCard.count({ where }),
      prisma.catalogCard.findMany({
        where,
        orderBy: [{ cleanName: 'asc' }, { productId: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          productId: true, categoryId: true, groupId: true, kind: true, name: true, cleanName: true,
          number: true, rarity: true, imageKey: true, sourceImageUrl: true, tcgplayerUrl: true,
          game: { select: { name: true } }, set: { select: { name: true } },
        },
      }),
    ]);
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
  try { return res.json(await run); } catch { return res.status(503).json({ success: false, available: false, message: 'No se pudo consultar el catálogo' }); }
  finally { pendingSearches.delete(cacheKey); }
});
export default router;
