// Operación: errores del navegador, lista de errores para el equipo y embudo de actividad (calculado con los datos que ya existen, sin rastreo).
import express from 'express';
import { authenticateToken, requireStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { isUuid } from '../core/validation.js';
import { recordError } from '../core/errorLog.js';

const router = express.Router();

// Error de la web (navegador). Público porque pasa también con sesión cerrada; se limita por conexión y se limpia antes de guardarse.
router.post('/api/client-errors', async (req, res) => {
  const { message, stack, path } = req.body || {};
  if (typeof message !== 'string' || !message.trim() || message.length > 600) return res.status(400).json({ success: false, message: 'Dato inválido' });
  if (stack !== undefined && (typeof stack !== 'string' || stack.length > 4000)) return res.status(400).json({ success: false, message: 'Dato inválido' });
  if (path !== undefined && (typeof path !== 'string' || path.length > 200 || !path.startsWith('/'))) return res.status(400).json({ success: false, message: 'Dato inválido' });
  await recordError({ kind: 'client', message, route: path || null, stack: stack || null });
  res.status(202).json({ success: true });
});

router.get('/api/admin/ops/errors', authenticateToken, requireStaff(3), async (_req, res) => {
  try {
    const [errors, last24h] = await Promise.all([
      prisma.errorEvent.findMany({ orderBy: { lastSeen: 'desc' }, take: 50, select: { id: true, kind: true, message: true, route: true, stack: true, count: true, firstSeen: true, lastSeen: true } }),
      prisma.errorEvent.count({ where: { lastSeen: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    ]);
    res.json({ success: true, errors, last24h });
  } catch (error) {
    console.error('Error loading error list:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Marcar un error como resuelto (se borra; si vuelve a ocurrir, aparece como nuevo)
router.delete('/api/admin/ops/errors/:id', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ success: false, message: 'Dato inválido' });
    await prisma.errorEvent.deleteMany({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting error event:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Embudo de las personas que se registraron en los últimos N días: cuántas llegan a cada paso
router.get('/api/admin/ops/funnel', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    const days = Number.parseInt(req.query.days ?? '30', 10);
    if (!Number.isInteger(days) || days < 1 || days > 365) return res.status(400).json({ success: false, message: 'Período inválido' });
    const [row] = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS "signups",
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Folder" f WHERE f."userId" = u."id"))::int AS "folder",
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Folder" f JOIN "Card" c ON c."folderId" = f."id" WHERE f."userId" = u."id" AND f."isPublic" = true))::int AS "cards",
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Order" o WHERE o."sellerId" = u."id"))::int AS "orders",
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Order" o WHERE o."sellerId" = u."id" AND o."status" = 'completed'))::int AS "sales",
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "WishlistItem" w WHERE w."userId" = u."id"))::int AS "wishlist",
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Order" o WHERE o."buyerId" = u."id"))::int AS "bought"
      FROM "User" u
      WHERE u."role" <> 'deleted' AND u."createdAt" >= now() - make_interval(days => ${days}::int)`;
    const [totals] = await prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*)::int FROM "User" WHERE "role" <> 'deleted') AS "users",
        (SELECT COUNT(*)::int FROM "Card" c JOIN "Folder" f ON f."id" = c."folderId" WHERE c."stock" > 0 AND f."isPublic" = true AND f."moderationState" = 'visible' AND c."moderationState" = 'visible') AS "cardsOnSale",
        (SELECT COUNT(*)::int FROM "Order" WHERE "createdAt" >= now() - make_interval(days => ${days}::int)) AS "ordersCreated",
        (SELECT COUNT(*)::int FROM "Order" WHERE "status" = 'completed' AND "updatedAt" >= now() - make_interval(days => ${days}::int)) AS "ordersCompleted"`;
    res.json({
      success: true, days,
      sellers: [
        { key: 'signups', label: 'Se registraron', count: row.signups },
        { key: 'folder', label: 'Crearon una carpeta', count: row.folder },
        { key: 'cards', label: 'Publicaron cartas', count: row.cards },
        { key: 'orders', label: 'Recibieron un pedido', count: row.orders },
        { key: 'sales', label: 'Completaron una venta', count: row.sales }
      ],
      buyers: [
        { key: 'signups', label: 'Se registraron', count: row.signups },
        { key: 'wishlist', label: 'Agregaron una carta deseada', count: row.wishlist },
        { key: 'bought', label: 'Hicieron un pedido', count: row.bought }
      ],
      totals
    });
  } catch (error) {
    console.error('Error loading funnel:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
