// Empleados de la tienda (plan Tienda, bloque 8). El dueño invita por nombre de usuario con un rol; la persona acepta; el dueño revoca.
// Lo que puede hacer cada rol se decide solo en core/storeAccess.js.
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { PlanFeatureError, assertFeature, getEffectivePlan, sendPlanError } from '../core/entitlements.js';
import { routeLimiter } from '../core/limits.js';
import { badRequest, isUuid, isValidCondition, normalizeUsername, normalizedCondition } from '../core/validation.js';
import { canActForStore, parsePermissions, permissionsOf } from '../core/storeAccess.js';
import { finishPendingOrder } from '../core/orderCompletion.js';
import { notifyUsers } from '../core/storeNotices.js';

const router = express.Router();
const MAX_MEMBERS = 10;
const ownUserId = async (req) => (await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } }))?.id || null;
const fail = (res, label, error) => {
  if (error instanceof PlanFeatureError) return sendPlanError(res, error);
  console.error(label, error.message);
  res.status(500).json({ success: false, message: 'Error interno' });
};
const denied = (res) => res.status(404).json({ success: false, message: 'No encontrado' });
const person = { select: { name: true, username: true } };

// ---------- Dueño ----------
router.get('/api/stores/me/team', authenticateToken, async (req, res) => {
  try {
    const userId = await ownUserId(req);
    if (!userId) return denied(res);
    const members = await prisma.storeMember.findMany({ where: { storeId: userId }, orderBy: { createdAt: 'asc' }, include: { user: person } });
    res.json({ success: true, members: members.map((m) => ({ id: m.id, permissions: permissionsOf(m.role), status: m.status, createdAt: m.createdAt, name: m.user.name, username: m.user.username })) });
  } catch (error) { fail(res, 'Error cargando el equipo:', error); }
});

router.post('/api/stores/me/team', authenticateToken, routeLimiter(60 * 60 * 1000, 30), async (req, res) => {
  try {
    const userId = await ownUserId(req);
    if (!userId) return denied(res);
    assertFeature((await getEffectivePlan(prisma, userId)).plan, 'storeTools');
    const role = parsePermissions(req.body?.permissions);
    const username = normalizeUsername(req.body?.username);
    if (!role) return badRequest(res, 'Marca al menos un permiso.');
    if (!username || username.length > 40) return badRequest(res, 'Escribe el usuario de la persona.');
    const target = await prisma.user.findFirst({ where: { username, NOT: { role: 'deleted' } }, select: { id: true } });
    if (!target) return badRequest(res, 'No encontramos ese usuario.');
    if (target.id === userId) return badRequest(res, 'No puedes invitarte a ti mismo.');
    if ((await prisma.storeMember.count({ where: { storeId: userId } })) >= MAX_MEMBERS) return badRequest(res, `Puedes tener hasta ${MAX_MEMBERS} personas en tu equipo.`);
    const existing = await prisma.storeMember.findUnique({ where: { storeId_userId: { storeId: userId, userId: target.id } } });
    if (existing) return badRequest(res, 'Esa persona ya está en tu equipo o invitada.');
    const member = await prisma.storeMember.create({ data: { storeId: userId, userId: target.id, role } });
    const store = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, username: true } });
    await notifyUsers([target.id], { subject: `${store.name || store.username} te invitó a su equipo`, title: 'Invitación a una tienda', intro: `${store.name || store.username} te invitó a su equipo. Acepta desde Mi tienda.`, url: '/dashboard?tab=tienda', tag: `team-${member.id}` });
    res.json({ success: true, member: { id: member.id, permissions: permissionsOf(role), status: member.status, username } });
  } catch (error) { fail(res, 'Error invitando al equipo:', error); }
});

router.put('/api/stores/me/team/:id', authenticateToken, routeLimiter(60 * 1000, 30), async (req, res) => {
  try {
    const userId = await ownUserId(req);
    if (!userId || !isUuid(req.params.id)) return denied(res);
    const role = parsePermissions(req.body?.permissions);
    if (!role) return badRequest(res, 'Marca al menos un permiso.');
    const updated = await prisma.storeMember.updateMany({ where: { id: req.params.id, storeId: userId }, data: { role } });
    if (!updated.count) return denied(res);
    res.json({ success: true, permissions: permissionsOf(role) });
  } catch (error) { fail(res, 'Error cambiando permisos del equipo:', error); }
});

router.delete('/api/stores/me/team/:id', authenticateToken, routeLimiter(60 * 1000, 30), async (req, res) => {
  try {
    const userId = await ownUserId(req);
    if (!userId || !isUuid(req.params.id)) return denied(res);
    const removed = await prisma.storeMember.deleteMany({ where: { id: req.params.id, storeId: userId } });
    if (!removed.count) return denied(res);
    res.json({ success: true });
  } catch (error) { fail(res, 'Error revocando miembro:', error); }
});

// ---------- Empleado ----------
router.get('/api/staff/stores', authenticateToken, async (req, res) => {
  try {
    const userId = await ownUserId(req);
    if (!userId) return denied(res);
    const rows = await prisma.storeMember.findMany({ where: { userId }, include: { store: person } });
    res.json({ success: true, stores: rows.map((m) => ({ id: m.id, storeId: m.storeId, permissions: permissionsOf(m.role), status: m.status, name: m.store.name, username: m.store.username })) });
  } catch (error) { fail(res, 'Error cargando tiendas del empleado:', error); }
});

router.post('/api/staff/invitations/:id/accept', authenticateToken, routeLimiter(60 * 1000, 20), async (req, res) => {
  try {
    const userId = await ownUserId(req);
    if (!userId || !isUuid(req.params.id)) return denied(res);
    const updated = await prisma.storeMember.updateMany({ where: { id: req.params.id, userId, status: 'invited' }, data: { status: 'active' } });
    if (!updated.count) return denied(res);
    res.json({ success: true });
  } catch (error) { fail(res, 'Error aceptando invitación:', error); }
});

// Rechazar una invitación o dejar una tienda
router.delete('/api/staff/invitations/:id', authenticateToken, routeLimiter(60 * 1000, 20), async (req, res) => {
  try {
    const userId = await ownUserId(req);
    if (!userId || !isUuid(req.params.id)) return denied(res);
    const removed = await prisma.storeMember.deleteMany({ where: { id: req.params.id, userId } });
    if (!removed.count) return denied(res);
    res.json({ success: true });
  } catch (error) { fail(res, 'Error dejando la tienda:', error); }
});

// Carpetas de la tienda con sus cartas (para caja y stock). Solo lo necesario: nada de datos de la cuenta del dueño.
router.get('/api/staff/stores/:storeId/folders', authenticateToken, async (req, res) => {
  try {
    const userId = await ownUserId(req);
    const { storeId } = req.params;
    if (!isUuid(storeId) || !userId) return denied(res);
    if (!(await canActForStore(prisma, userId, storeId, 'sales')) && !(await canActForStore(prisma, userId, storeId, 'stock'))) return denied(res);
    const folders = await prisma.folder.findMany({ where: { userId: storeId }, orderBy: { createdAt: 'asc' }, take: 50, select: { id: true, name: true, tcg: true, cards: { take: 2000, orderBy: { name: 'asc' }, select: { id: true, name: true, stock: true, price: true, imageUrl: true, language: true, condition: true, tcgId: true, data: true } } } });
    res.json({ success: true, folders });
  } catch (error) { fail(res, 'Error cargando carpetas de la tienda:', error); }
});

// Stock: cambia cantidad y precio de una carta de la tienda
router.put('/api/staff/stores/:storeId/cards/:cardId', authenticateToken, routeLimiter(60 * 1000, 120), async (req, res) => {
  try {
    const userId = await ownUserId(req);
    const { storeId, cardId } = req.params;
    if (!userId || !isUuid(storeId) || !isUuid(cardId)) return denied(res);
    if (!(await canActForStore(prisma, userId, storeId, 'stock'))) return denied(res);
    const { stock, price, condition } = req.body || {};
    if (condition !== undefined && (!isValidCondition(condition) || !(await canActForStore(prisma, userId, storeId, 'folders')))) return denied(res);
    if (!Number.isInteger(stock) || stock < 0 || stock > 100000) return badRequest(res, 'Cantidad inválida.');
    if (price !== null && (!Number.isInteger(price) || price < 0 || price > 100000000)) return badRequest(res, 'Precio inválido.');
    const data = { stock, price };
    if (condition !== undefined) {
      const current = await prisma.card.findFirst({ where: { id: cardId, folder: { userId: storeId } }, select: { id: true, folderId: true, tcgId: true, language: true, condition: true, data: true } });
      if (!current) return denied(res);
      const next = normalizedCondition(condition);
      const finish = (d) => (d && typeof d === 'object' && typeof d.finish === 'string' ? d.finish : '');
      if (next !== current.condition) {
        const same = await prisma.card.findMany({ where: { folderId: current.folderId, tcgId: current.tcgId, language: current.language, condition: next, id: { not: current.id } }, select: { data: true } });
        if (same.some((other) => finish(other.data) === finish(current.data))) return res.status(409).json({ success: false, message: 'Ya existe esa carta con ese estado en la carpeta.' });
      }
      data.condition = next;
    }
    const updated = await prisma.card.updateMany({ where: { id: cardId, folder: { userId: storeId } }, data });
    if (!updated.count) return denied(res);
    res.json({ success: true, card: { id: cardId, ...data } });
  } catch (error) { fail(res, 'Error actualizando carta:', error); }
});

// Editar carpetas: quitar una carta de la tienda
router.delete('/api/staff/stores/:storeId/cards/:cardId', authenticateToken, routeLimiter(60 * 1000, 60), async (req, res) => {
  try {
    const userId = await ownUserId(req);
    const { storeId, cardId } = req.params;
    if (!userId || !isUuid(storeId) || !isUuid(cardId) || !(await canActForStore(prisma, userId, storeId, 'folders'))) return denied(res);
    const removed = await prisma.card.deleteMany({ where: { id: cardId, folder: { userId: storeId } } });
    if (!removed.count) return denied(res);
    res.json({ success: true });
  } catch (error) { fail(res, 'Error quitando carta de la tienda:', error); }
});

// Caja: retiros de la tienda
const pickupView = (o) => ({ id: o.id, code: o.code, pickupCode: o.pickupCode, pickupBy: o.pickupBy, ready: Boolean(o.pickupReadyAt), status: o.status, total: o.total, folderName: o.folderName, buyerName: o.buyerName, createdAt: o.createdAt, items: (Array.isArray(o.items) ? o.items : []).map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })) });

router.get('/api/staff/stores/:storeId/pickups', authenticateToken, async (req, res) => {
  try {
    const userId = await ownUserId(req);
    const { storeId } = req.params;
    if (!userId || !isUuid(storeId) || !(await canActForStore(prisma, userId, storeId, 'pickups'))) return denied(res);
    const rows = await prisma.order.findMany({ where: { sellerId: storeId, via: 'pickup', OR: [{ status: 'pending' }, { updatedAt: { gt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } }] }, orderBy: { pickupBy: 'asc' }, take: 200 });
    res.json({ success: true, pickups: rows.map(pickupView) });
  } catch (error) { fail(res, 'Error cargando retiros del equipo:', error); }
});

router.post('/api/staff/stores/:storeId/pickups/:id/:action', authenticateToken, routeLimiter(60 * 1000, 60), async (req, res) => {
  try {
    const userId = await ownUserId(req);
    const { storeId, id, action } = req.params;
    if (!userId || !isUuid(storeId) || !isUuid(id) || !['ready', 'deliver'].includes(action)) return denied(res);
    if (!(await canActForStore(prisma, userId, storeId, 'pickups'))) return denied(res);
    const order = await prisma.order.findFirst({ where: { id, sellerId: storeId, via: 'pickup' } });
    if (!order) return denied(res);
    if (order.status !== 'pending') return res.status(409).json({ success: false, message: 'Esta reserva ya fue cerrada' });
    if (action === 'ready') {
      const claimed = await prisma.order.updateMany({ where: { id, status: 'pending', pickupReadyAt: null }, data: { pickupReadyAt: new Date() } });
      if (claimed.count && order.buyerId) await notifyUsers([order.buyerId], { subject: `Tu reserva ${order.code} está lista`, title: 'Lista para retirar', intro: `Tu reserva ya está lista. Muestra el código ${order.pickupCode} en el local.`, url: '/dashboard?tab=tienda', tag: `pickup-${order.id}` });
      return res.json({ success: true, pickup: pickupView({ ...order, pickupReadyAt: order.pickupReadyAt || new Date() }) });
    }
    const updated = await finishPendingOrder(prisma, order, 'completed');
    if (!updated) return res.status(409).json({ success: false, message: 'Esta reserva ya fue cerrada' });
    res.json({ success: true, pickup: pickupView(updated) });
  } catch (error) { fail(res, 'Error gestionando retiro del equipo:', error); }
});

export default router;
