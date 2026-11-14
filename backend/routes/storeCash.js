// Caja y stock de las tiendas (plan Tienda, bloque 5): cierre de caja por día y medio de pago, y alertas de stock.
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { PlanFeatureError, assertFeature, getEffectivePlan, sendPlanError } from '../core/entitlements.js';
import { routeLimiter } from '../core/limits.js';
import { badRequest } from '../core/validation.js';
import { summarizeCash } from '../core/storeCash.js';

const router = express.Router();
const DAY = 24 * 60 * 60 * 1000;

// Dueño con plan Tienda (estas herramientas no se muestran sin el plan)
const storeOwner = async (req) => {
  const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
  if (!user) return null;
  assertFeature((await getEffectivePlan(prisma, user.id)).plan, 'storeTools');
  return user.id;
};
const handle = (label) => (error, res) => {
  if (error instanceof PlanFeatureError) return sendPlanError(res, error);
  console.error(label, error.message);
  res.status(500).json({ success: false, message: 'Error interno' });
};

// Cierre de caja: ?days=1..31 (por defecto 7)
router.get('/api/stores/me/cash', authenticateToken, async (req, res) => {
  try {
    const days = req.query.days === undefined ? 7 : Number(req.query.days);
    if (!Number.isInteger(days) || days < 1 || days > 31) return badRequest(res, 'Rango inválido');
    const userId = await storeOwner(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const since = new Date(Date.now() - (days + 1) * DAY);
    const [sales, orders] = await Promise.all([
      prisma.inPersonSale.findMany({ where: { userId, createdAt: { gt: since } }, select: { total: true, paymentMethod: true, createdAt: true } }),
      prisma.order.findMany({ where: { sellerId: userId, status: 'completed', updatedAt: { gt: since } }, select: { total: true, updatedAt: true } })
    ]);
    res.json({ success: true, ...summarizeCash(sales, orders, days) });
  } catch (error) { handle('Error cargando la caja:')(error, res); }
});

// Alertas: poco stock (1..lowStockAt unidades) y cartas sin movimiento hace staleDays días
router.get('/api/stores/me/stock-alerts', authenticateToken, async (req, res) => {
  try {
    const userId = await storeOwner(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const profile = await prisma.storeProfile.findUnique({ where: { userId }, select: { lowStockAt: true, staleDays: true } });
    const lowStockAt = profile?.lowStockAt ?? 1;
    const staleDays = profile?.staleDays ?? 60;
    const select = { id: true, name: true, stock: true, price: true, imageUrl: true, updatedAt: true, folderId: true, folder: { select: { name: true } } };
    // shortcut: «sin movimiento» usa la última edición de la carta (vender o cambiar stock la actualiza); con más precisión habría que guardar la fecha de la última venta
    const [low, stale] = await Promise.all([
      lowStockAt > 0 ? prisma.card.findMany({ where: { folder: { userId }, stock: { gte: 1, lte: lowStockAt } }, orderBy: { stock: 'asc' }, take: 100, select }) : [],
      prisma.card.findMany({ where: { folder: { userId }, stock: { gt: 0 }, updatedAt: { lt: new Date(Date.now() - staleDays * DAY) } }, orderBy: { updatedAt: 'asc' }, take: 100, select })
    ]);
    const view = ({ folder, ...card }) => ({ ...card, folderName: folder.name });
    res.json({ success: true, lowStockAt, staleDays, low: low.map(view), stale: stale.map(view) });
  } catch (error) { handle('Error cargando alertas de stock:')(error, res); }
});

router.put('/api/stores/me/stock-settings', authenticateToken, routeLimiter(60 * 1000, 20), async (req, res) => {
  try {
    const { lowStockAt, staleDays } = req.body || {};
    if (!Number.isInteger(lowStockAt) || lowStockAt < 0 || lowStockAt > 50 || !Number.isInteger(staleDays) || staleDays < 7 || staleDays > 365) return badRequest(res, 'Usa entre 0 y 50 unidades y entre 7 y 365 días.');
    const userId = await storeOwner(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    await prisma.storeProfile.upsert({ where: { userId }, create: { userId, lowStockAt, staleDays }, update: { lowStockAt, staleDays } });
    res.json({ success: true, lowStockAt, staleDays });
  } catch (error) { handle('Error guardando ajustes de stock:')(error, res); }
});

export default router;
