// Listado de vendedores y destacados de Inicio.
import { Prisma } from '@prisma/client';
import express from 'express';
import { prisma } from '../core/db.js';
import { folderFilterSql, folderOrderSql, likePattern, loadPublicFolders, validListText } from '../core/listing.js';
import { badRequest } from '../core/validation.js';

const router = express.Router();

const SELLERS_PAGE_SIZE = 24;

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

router.get('/api/sellers', async (req, res) => {
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
router.get('/api/home/featured', async (_req, res) => {
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

export default router;
