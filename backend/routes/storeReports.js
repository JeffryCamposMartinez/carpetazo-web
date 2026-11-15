// Informe de ventas de la tienda (plan Tienda, bloque 8): CSV por rango de fechas con ventas en persona y pedidos completados. Solo el dueño.
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { PlanFeatureError, assertFeature, getEffectivePlan, sendPlanError } from '../core/entitlements.js';
import { routeLimiter } from '../core/limits.js';
import { badRequest } from '../core/validation.js';
import { buildSalesCsv, parseReportRange } from '../core/storeReport.js';

const router = express.Router();

router.get('/api/stores/me/report.csv', authenticateToken, routeLimiter(60 * 60 * 1000, 30), async (req, res) => {
  try {
    const range = parseReportRange(req.query.from, req.query.to);
    if (!range) return badRequest(res, 'Rango inválido: usa fechas AAAA-MM-DD, de hasta 366 días.');
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    assertFeature((await getEffectivePlan(prisma, user.id)).plan, 'storeTools');
    const [sales, orders] = await Promise.all([
      prisma.inPersonSale.findMany({ where: { userId: user.id, createdAt: { gte: range.start, lt: range.end } }, orderBy: { createdAt: 'asc' }, take: 20000 }),
      prisma.order.findMany({ where: { sellerId: user.id, status: 'completed', updatedAt: { gte: range.start, lt: range.end } }, orderBy: { updatedAt: 'asc' }, take: 20000 })
    ]);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="carpetazo-ventas-${req.query.from}-a-${req.query.to}.csv"`, 'Cache-Control': 'no-store' });
    res.send(buildSalesCsv(sales, orders));
  } catch (error) {
    if (error instanceof PlanFeatureError) return sendPlanError(res, error);
    console.error('Error generando informe de ventas:', error.message);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
