import express from 'express';
import { prisma } from '../core/db.js';
import { badRequest } from '../core/validation.js';

const router = express.Router();
const r2PublicUrl = (key) => {
  const base = String(process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  if (!base || !key) return null;
  return `${base}/${String(key).split('/').map((part) => encodeURIComponent(part).replace(/['()*!]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)).join('/')}`;
};

const clean = (value) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

router.get('/api/tcg/search-index', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const game = typeof req.query.game === 'string' ? req.query.game.trim() : '';
  const page = Number.parseInt(req.query.page, 10) || 1;
  if (query.length < 2 || query.length > 80 || game.length > 60 || page < 1 || page > 10000) return badRequest(res, 'Búsqueda inválida');
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
  const limit = 60;
  const value = clean(query);
  const gameWhere = game ? { game: { name: game } } : {};
  const where = {
    ...gameWhere,
    OR: [
      { cleanName: { contains: value } },
      { name: { contains: query, mode: 'insensitive' } },
      { number: { contains: query, mode: 'insensitive' } },
    ],
  };
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
    const cards = rows.map((card) => ({
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
    return res.json({ success: true, source: 'database', available: true, total, page, pages: Math.max(1, Math.ceil(total / limit)), cards });
  } catch (error) {
    console.error('Error buscando catálogo TCG en la base de datos:', error.message);
    return res.status(503).json({ success: false, available: false, message: 'No se pudo consultar el catálogo' });
  }
});
export default router;
