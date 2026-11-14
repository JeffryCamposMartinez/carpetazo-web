// «Vende tu colección» (plan Tienda, bloque 3): una persona manda su lista a una tienda; la tienda oferta; la persona acepta o rechaza.
// La conversación sigue por el chat existente; el precio lo pone la tienda (sin cálculo automático).
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { getEffectivePlan } from '../core/entitlements.js';
import { routeLimiter } from '../core/limits.js';
import { badRequest, isSmallObject, isUuid, normalizeUsername } from '../core/validation.js';
import { MAX_OPEN_PER_STORE, OPEN_STATUSES, nextStatus, parseBuyRequest, parseOffer, toBuyRequestView } from '../core/storeBuyRequests.js';
import { notifyUsers } from '../core/storeNotices.js';
import { formatClp } from '../core/storeFormat.js';

const router = express.Router();
const PEOPLE = { user: { select: { name: true, username: true } }, store: { select: { name: true, username: true } } };
const ownUserId = async (req) => (await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } }))?.id || null;
const notFound = (res) => res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
const fail = (res, label, error) => {
  console.error(label, error.message);
  res.status(500).json({ success: false, message: 'Error interno' });
};
const nameOf = (u) => u?.name || u?.username || 'Alguien';

// Enviar una lista a una tienda (que tenga el plan Tienda)
router.post('/api/stores/:username/buy-requests', authenticateToken, routeLimiter(60 * 60 * 1000, 20), async (req, res) => {
  try {
    if (!isSmallObject(req.body, 60000)) return badRequest(res, 'La lista es demasiado grande.');
    const userId = await ownUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const username = normalizeUsername(req.params.username);
    const store = username && username.length <= 40 ? await prisma.user.findFirst({ where: { username, NOT: { role: 'deleted' } }, select: { id: true, name: true, username: true } }) : null;
    if (!store || !(await getEffectivePlan(prisma, store.id)).plan.storeTools) return res.status(404).json({ success: false, message: 'Tienda no encontrada' });
    if (store.id === userId) return badRequest(res, 'No puedes enviarte una solicitud a ti mismo.');
    const parsed = parseBuyRequest(req.body);
    if (!parsed.ok) return badRequest(res, parsed.error);
    const open = await prisma.storeBuyRequest.count({ where: { storeId: store.id, userId, status: { in: OPEN_STATUSES } } });
    if (open >= MAX_OPEN_PER_STORE) return badRequest(res, `Ya tienes ${MAX_OPEN_PER_STORE} solicitudes abiertas con esta tienda.`);
    const created = await prisma.storeBuyRequest.create({ data: { storeId: store.id, userId, ...parsed.data }, include: PEOPLE });
    const total = parsed.data.items.reduce((sum, i) => sum + i.quantity, 0);
    await notifyUsers([store.id], { subject: `Nueva colección para comprar: ${total} cartas`, title: 'Te ofrecen una colección', intro: `${nameOf(created.user)} quiere venderte ${total} cartas. Revisa la lista y envía tu oferta.`, url: '/dashboard?tab=tienda', tag: `buy-${created.id}` });
    res.json({ success: true, request: toBuyRequestView(created) });
  } catch (error) { fail(res, 'Error creando la solicitud de compra:', error); }
});

// Solicitudes recibidas por la tienda (aunque baje de plan puede verlas y cerrarlas)
router.get('/api/stores/me/buy-requests', authenticateToken, async (req, res) => {
  try {
    const userId = await ownUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const rows = await prisma.storeBuyRequest.findMany({ where: { storeId: userId }, orderBy: { createdAt: 'desc' }, take: 100, include: PEOPLE });
    res.json({ success: true, requests: rows.map(({ store: _s, ...r }) => toBuyRequestView(r)) });
  } catch (error) { fail(res, 'Error cargando solicitudes de compra:', error); }
});

// Solicitudes que yo envié
router.get('/api/buy-requests/mine', authenticateToken, async (req, res) => {
  try {
    const userId = await ownUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const rows = await prisma.storeBuyRequest.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100, include: PEOPLE });
    res.json({ success: true, requests: rows.map(({ user: _u, ...r }) => toBuyRequestView(r)) });
  } catch (error) { fail(res, 'Error cargando mis solicitudes de venta:', error); }
});

// Cambio de estado: role 'store' (oferta / rechaza) o 'seller' (acepta / rechaza / cancela). Atómico: solo cambia si el estado no se movió.
const transition = (role, action) => async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res);
    if (!isSmallObject(req.body, 4000)) return badRequest(res, 'Datos inválidos.');
    const userId = await ownUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const current = await prisma.storeBuyRequest.findFirst({ where: { id: req.params.id, ...(role === 'store' ? { storeId: userId } : { userId }) }, include: PEOPLE });
    if (!current) return notFound(res);
    const status = nextStatus(role, action, current.status);
    if (!status) return res.status(409).json({ success: false, message: 'Esta solicitud ya no admite ese cambio.' });
    let extra = {};
    if (action === 'offer') {
      if (!(await getEffectivePlan(prisma, userId)).plan.storeTools) return res.status(403).json({ success: false, code: 'plan_feature_locked', feature: 'storeTools', message: 'Las herramientas de tienda están disponibles en el plan Tienda.' });
      const offer = parseOffer(req.body);
      if (!offer.ok) return badRequest(res, offer.error);
      extra = offer.data;
    }
    const updated = await prisma.storeBuyRequest.updateMany({ where: { id: current.id, status: current.status }, data: { status, ...extra } });
    if (!updated.count) return res.status(409).json({ success: false, message: 'La solicitud cambió mientras tanto. Recarga la página.' });
    const row = { ...current, status, ...extra };
    if (role === 'store') {
      await notifyUsers([current.userId], action === 'offer'
        ? { subject: `${nameOf(current.store)} te ofrece ${formatClp(extra.offerClp)}`, title: 'Recibiste una oferta', intro: `${nameOf(current.store)} ofrece ${formatClp(extra.offerClp)} por tu colección. Acéptala o recházala desde tu panel.`, url: '/dashboard?tab=tienda', tag: `buy-${current.id}` }
        : { subject: `${nameOf(current.store)} no comprará tu colección`, title: 'Solicitud rechazada', intro: `${nameOf(current.store)} rechazó tu solicitud de venta.`, url: '/dashboard?tab=tienda', tag: `buy-${current.id}` });
    } else if (action !== 'cancel') {
      await notifyUsers([current.storeId], { subject: action === 'accept' ? `${nameOf(current.user)} aceptó tu oferta` : `${nameOf(current.user)} rechazó tu oferta`, title: action === 'accept' ? 'Oferta aceptada' : 'Oferta rechazada', intro: action === 'accept' ? `Coordina la entrega de la colección por mensajes con ${nameOf(current.user)}.` : `${nameOf(current.user)} rechazó tu oferta de ${formatClp(current.offerClp)}.`, url: '/dashboard?tab=tienda', tag: `buy-${current.id}` });
    }
    const { user, store, ...rest } = row;
    res.json({ success: true, request: toBuyRequestView(role === 'store' ? { ...rest, user } : { ...rest, store }) });
  } catch (error) { fail(res, 'Error actualizando la solicitud de compra:', error); }
};

const limit = routeLimiter(60 * 1000, 30);
router.post('/api/stores/me/buy-requests/:id/offer', authenticateToken, limit, transition('store', 'offer'));
router.post('/api/stores/me/buy-requests/:id/decline', authenticateToken, limit, transition('store', 'decline'));
router.post('/api/buy-requests/:id/accept', authenticateToken, limit, transition('seller', 'accept'));
router.post('/api/buy-requests/:id/reject', authenticateToken, limit, transition('seller', 'reject'));
router.post('/api/buy-requests/:id/cancel', authenticateToken, limit, transition('seller', 'cancel'));

export default router;
