// Listado de vendedores y destacados de Inicio.
import { Prisma } from '@prisma/client';
import express from 'express';
import { prisma } from '../core/db.js';
import { isValidComuna } from '../core/chileData.js';
import { folderFilterSql, folderOrderSql, likePattern, loadPublicFolders, validListText } from '../core/listing.js';
import { publicPlanBadge } from '../core/plans.js';
import { badRequest } from '../core/validation.js';

const router = express.Router();

const SELLERS_PAGE_SIZE = 24;
// Prisma persiste DateTime como `timestamp without time zone`; comparar contra UTC evita
// que la zona horaria de PostgreSQL adelante o retrase la vigencia de una insignia.
const utcNowSql = Prisma.sql`(NOW() AT TIME ZONE 'UTC')`;
const effectivePlanSql = Prisma.sql`COALESCE(
  (SELECT pg."planKey" FROM "PlanGrant" pg
    WHERE pg."userId" = u."id" AND pg."revokedAt" IS NULL AND pg."startsAt" <= ${utcNowSql}
      AND (pg."endsAt" IS NULL OR pg."endsAt" > ${utcNowSql})
    ORDER BY pg."createdAt" DESC LIMIT 1),
  (SELECT s."planKey" FROM "Subscription" s
    WHERE s."userId" = u."id"
      AND (s."status" = 'active' OR (s."status" = 'past_due' AND COALESCE(s."currentPeriodEnd", s."updatedAt") + INTERVAL '7 days' > ${utcNowSql}))
    ORDER BY s."updatedAt" DESC LIMIT 1),
  'free'
)`;
const withPlanBadge = ({ planKey, ...seller }) => ({ ...seller, planBadge: publicPlanBadge(planKey) });

// Vendedores = dueños de carpetas públicas, con sus cifras sumadas
const querySellers = ({ like, comuna = null, sort, limit, offset }) => {
  const filter = Prisma.sql`1 = 1
    AND f."isPublic" = true
    AND f."moderationState" = 'visible'
    AND EXISTS (
      SELECT 1 FROM "Card" pc
      WHERE pc."folderId" = f."id"
        AND pc."moderationState" IN ('visible', 'image_hidden')
    )
    ${like ? Prisma.sql`AND (u."name" ILIKE ${like} OR u."username" ILIKE ${like})` : Prisma.empty}
    ${comuna ? Prisma.sql`AND u."publicComuna" = ${comuna}` : Prisma.empty}`;
  const order = sort === 'name' ? Prisma.sql`LOWER(u."name") ASC` : sort === 'cards' ? Prisma.sql`cards DESC, visits DESC` : Prisma.sql`visits DESC, cards DESC`;
  return Promise.all([
    prisma.$queryRaw`
      SELECT u."name", u."username", u."photoURL", u."publicComuna", u."publicRegion",
             (u."emailVerified" AND u."username" IS NOT NULL AND u."photoURL" IS NOT NULL AND u."publicComuna" IS NOT NULL AND COALESCE(TRIM(u."phone"), '') <> '') AS verified,
             ${effectivePlanSql} AS "planKey",
             COUNT(f."id")::int AS folders,
             COALESCE(SUM(c.cnt), 0)::int AS cards,
             COALESCE(SUM(f."totalVisits"), 0)::int AS visits,
             ARRAY_AGG(DISTINCT f."tcg") AS tcgs
      FROM "User" u
      JOIN "Folder" f ON f."userId" = u."id"
      LEFT JOIN (SELECT "folderId", COUNT(*) AS cnt FROM "Card" WHERE "moderationState" IN ('visible', 'image_hidden') GROUP BY "folderId") c ON c."folderId" = f."id"
      WHERE ${filter}
      GROUP BY u."id"
      ORDER BY ${order}
      LIMIT ${limit} OFFSET ${offset}`,
    prisma.$queryRaw`SELECT COUNT(DISTINCT u."id")::int AS n FROM "User" u JOIN "Folder" f ON f."userId" = u."id" WHERE ${filter}`
  ]);
};

router.get('/api/sellers', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'visits';
    const page = Number.parseInt(req.query.page, 10) || 1;
    const comuna = typeof req.query.comuna === 'string' ? req.query.comuna.trim() : '';
    if (!validListText(q) || !['visits', 'cards', 'name'].includes(sort) || page < 1 || page > 1000 || (comuna && !isValidComuna(comuna))) return badRequest(res, 'Búsqueda inválida');
    const [rows, totalRows] = await querySellers({ like: q ? likePattern(q) : null, comuna: comuna || null, sort, limit: SELLERS_PAGE_SIZE, offset: (page - 1) * SELLERS_PAGE_SIZE });
    const total = totalRows[0]?.n || 0;
    res.json({ success: true, sellers: rows.map(withPlanBadge), total, page, pages: Math.max(1, Math.ceil(total / SELLERS_PAGE_SIZE)) });
  } catch (error) {
    console.error('Error loading sellers:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Todo lo que muestra la portada: cifras, carpetas por juego, más visitadas, nuevas y mejores vendedores
router.get('/api/home/featured', async (_req, res) => {
  try {
    const filter = folderFilterSql({ like: null, tcgs: null });
    const [visitedIds, newestIds, tcgRows, statRows, sellerResult, salesRows] = await Promise.all([
      prisma.$queryRaw`SELECT f."id" FROM "Folder" f JOIN "User" u ON u."id" = f."userId" WHERE ${filter} ORDER BY ${folderOrderSql('weekly')} LIMIT 5`,
      prisma.$queryRaw`SELECT f."id" FROM "Folder" f JOIN "User" u ON u."id" = f."userId" WHERE ${filter} ORDER BY f."createdAt" DESC LIMIT 5`,
      prisma.$queryRaw`SELECT f."tcg", COUNT(*)::int AS n FROM "Folder" f WHERE f."isPublic" = true AND f."moderationState" = 'visible' AND EXISTS (SELECT 1 FROM "Card" c WHERE c."folderId" = f."id" AND c."moderationState" IN ('visible', 'image_hidden')) GROUP BY f."tcg"`,
      prisma.$queryRaw`SELECT COUNT(DISTINCT f."id")::int AS folders, COUNT(DISTINCT f."userId")::int AS sellers, (SELECT COUNT(*) FROM "Card" c JOIN "Folder" f2 ON f2."id" = c."folderId" AND f2."isPublic" = true AND f2."moderationState" = 'visible' WHERE c."moderationState" IN ('visible', 'image_hidden'))::int AS cards FROM "Folder" f WHERE f."isPublic" = true AND f."moderationState" = 'visible' AND EXISTS (SELECT 1 FROM "Card" c0 WHERE c0."folderId" = f."id" AND c0."moderationState" IN ('visible', 'image_hidden'))`,
      querySellers({ like: null, sort: 'visits', limit: 5, offset: 0 }),
      // Más ventas concretadas: solo pedidos confirmados por el vendedor
      prisma.$queryRaw`
        SELECT u."name", u."username", u."photoURL", u."publicComuna", ${effectivePlanSql} AS "planKey", COUNT(o."id")::int AS sales
        FROM "Order" o
        JOIN "User" u ON u."id" = o."sellerId"
        WHERE o."status" = 'completed'
          AND u."username" IS NOT NULL
          AND EXISTS (SELECT 1 FROM "Folder" f WHERE f."userId" = u."id" AND f."isPublic" = true AND f."moderationState" = 'visible' AND EXISTS (SELECT 1 FROM "Card" c WHERE c."folderId" = f."id" AND c."moderationState" IN ('visible', 'image_hidden')))
        GROUP BY u."id"
        ORDER BY sales DESC, MAX(o."updatedAt") DESC
        LIMIT 5`
    ]);
    const stats = statRows[0] || { folders: 0, sellers: 0, cards: 0 };
    res.json({
      success: true,
      stats: { folders: stats.folders, sellers: stats.sellers, cards: stats.cards },
      counts: tcgRows.map((row) => ({ tcg: row.tcg, count: row.n })),
      visited: await loadPublicFolders(visitedIds.map((row) => row.id)),
      newest: await loadPublicFolders(newestIds.map((row) => row.id)),
      topSellers: sellerResult[0].map(withPlanBadge),
      topSelling: salesRows.map(withPlanBadge)
    });
  } catch (error) {
    console.error('Error loading featured:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
