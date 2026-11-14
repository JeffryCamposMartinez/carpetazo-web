// Fidelización de tiendas (plan Tienda, bloque 6): seguir tiendas y avisos, cupones y demanda de cartas.
import express from 'express';
import { authenticateToken, optionalAuth } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { PlanFeatureError, assertFeature, getEffectivePlan, sendPlanError } from '../core/entitlements.js';
import { routeLimiter } from '../core/limits.js';
import { badRequest, hasDeceptiveChars, isSmallObject, isUuid, normalizeUsername } from '../core/validation.js';
import { MAX_COUPONS, countCouponUses, couponProblem, discountFor, normalizeCode, parseCoupon } from '../core/storeCoupons.js';
import { demandFor } from '../core/storeDemand.js';
import { notifyFollowers } from '../core/storeNotices.js';

const router = express.Router();
const DAY = 24 * 60 * 60 * 1000;
const ownUserId = async (req) => (await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } }))?.id || null;
const storeOwner = async (req) => {
  const userId = await ownUserId(req);
  if (userId) assertFeature((await getEffectivePlan(prisma, userId)).plan, 'storeTools');
  return userId;
};
const fail = (res, label, error) => {
  if (error instanceof PlanFeatureError) return sendPlanError(res, error);
  console.error(label, error.message);
  res.status(500).json({ success: false, message: 'Error interno' });
};
// Tienda pública por nombre de usuario: solo cuentas con plan Tienda
const findStore = async (raw) => {
  const username = normalizeUsername(raw);
  if (!username || username.length > 40) return null;
  const store = await prisma.user.findFirst({ where: { username, NOT: { role: 'deleted' } }, select: { id: true, name: true, username: true } });
  return store && (await getEffectivePlan(prisma, store.id)).plan.storeTools ? store : null;
};

// ---------- Seguir ----------
router.get('/api/stores/:username/follow', optionalAuth, async (req, res) => {
  try {
    const store = await findStore(req.params.username);
    if (!store) return res.json({ success: true, available: false, following: false, followers: 0 });
    const viewer = req.user?.sub ? await ownUserId(req) : null;
    const [followers, mine] = await Promise.all([prisma.storeFollow.count({ where: { storeId: store.id } }), viewer ? prisma.storeFollow.findUnique({ where: { storeId_userId: { storeId: store.id, userId: viewer } } }) : null]);
    res.json({ success: true, available: true, isOwner: viewer === store.id, following: Boolean(mine), followers });
  } catch (error) { fail(res, 'Error cargando seguidores:', error); }
});

router.post('/api/stores/:username/follow', authenticateToken, routeLimiter(60 * 1000, 30), async (req, res) => {
  try {
    const userId = await ownUserId(req);
    const store = await findStore(req.params.username);
    if (!userId || !store) return res.status(404).json({ success: false, message: 'Tienda no encontrada' });
    if (store.id === userId) return badRequest(res, 'No puedes seguir tu propia tienda.');
    await prisma.storeFollow.upsert({ where: { storeId_userId: { storeId: store.id, userId } }, create: { storeId: store.id, userId }, update: {} });
    res.json({ success: true, following: true, followers: await prisma.storeFollow.count({ where: { storeId: store.id } }) });
  } catch (error) { fail(res, 'Error siguiendo tienda:', error); }
});

router.delete('/api/stores/:username/follow', authenticateToken, routeLimiter(60 * 1000, 30), async (req, res) => {
  try {
    const userId = await ownUserId(req);
    const username = normalizeUsername(req.params.username);
    const store = userId && username ? await prisma.user.findFirst({ where: { username }, select: { id: true } }) : null;
    if (store) await prisma.storeFollow.deleteMany({ where: { storeId: store.id, userId } });
    res.json({ success: true, following: false });
  } catch (error) { fail(res, 'Error dejando de seguir tienda:', error); }
});

// Aviso de la tienda a sus seguidores: una vez al día por tienda; a cada seguidor máximo un aviso de esa tienda al día
router.post('/api/stores/me/announce', authenticateToken, routeLimiter(60 * 60 * 1000, 5), async (req, res) => {
  try {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (message.length < 5 || message.length > 200 || /[\u0000-\u001f\u007f]/.test(message) || hasDeceptiveChars(message)) return badRequest(res, 'El aviso debe tener entre 5 y 200 caracteres.');
    const userId = await storeOwner(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const since = new Date(Date.now() - DAY);
    await prisma.storeProfile.upsert({ where: { userId }, create: { userId }, update: {} });
    const claimed = await prisma.storeProfile.updateMany({ where: { userId, OR: [{ lastAnnouncedAt: null }, { lastAnnouncedAt: { lt: since } }] }, data: { lastAnnouncedAt: new Date() } });
    if (!claimed.count) return res.status(429).json({ success: false, message: 'Puedes enviar un aviso a tus seguidores una vez al día.' });
    const sent = await notifyFollowers(userId, { kind: 'announce', message });
    res.json({ success: true, sent });
  } catch (error) { fail(res, 'Error avisando a seguidores:', error); }
});

// ---------- Cupones ----------
router.get('/api/stores/me/coupons', authenticateToken, async (req, res) => {
  try {
    const userId = await ownUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const coupons = await prisma.storeCoupon.findMany({ where: { storeId: userId }, orderBy: { createdAt: 'desc' } });
    const withUses = await Promise.all(coupons.map(async (c) => ({ ...c, uses: (await countCouponUses(prisma, c.id, null)).usesAll })));
    res.json({ success: true, coupons: withUses.map(({ storeId: _s, ...c }) => c) });
  } catch (error) { fail(res, 'Error cargando cupones:', error); }
});

router.post('/api/stores/me/coupons', authenticateToken, routeLimiter(60 * 60 * 1000, 40), async (req, res) => {
  try {
    if (!isSmallObject(req.body, 2000)) return badRequest(res, 'Datos inválidos.');
    const userId = await storeOwner(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const parsed = parseCoupon(req.body);
    if (!parsed.ok) return badRequest(res, parsed.error);
    if ((await prisma.storeCoupon.count({ where: { storeId: userId } })) >= MAX_COUPONS) return badRequest(res, `Puedes tener hasta ${MAX_COUPONS} cupones.`);
    if (await prisma.storeCoupon.findUnique({ where: { storeId_code: { storeId: userId, code: parsed.data.code } } })) return badRequest(res, 'Ya tienes un cupón con ese código.');
    const { storeId: _s, ...coupon } = await prisma.storeCoupon.create({ data: { storeId: userId, ...parsed.data } });
    res.json({ success: true, coupon: { ...coupon, uses: 0 } });
  } catch (error) { fail(res, 'Error creando cupón:', error); }
});

// Activar o pausar (no se borran: sus usos quedan en los pedidos)
router.put('/api/stores/me/coupons/:id', authenticateToken, routeLimiter(60 * 1000, 30), async (req, res) => {
  try {
    if (!isUuid(req.params.id) || typeof req.body?.active !== 'boolean') return badRequest(res, 'Datos inválidos.');
    const userId = await ownUserId(req);
    const updated = userId ? await prisma.storeCoupon.updateMany({ where: { id: req.params.id, storeId: userId }, data: { active: req.body.active } }) : { count: 0 };
    if (!updated.count) return res.status(404).json({ success: false, message: 'Cupón no encontrado' });
    res.json({ success: true, active: req.body.active });
  } catch (error) { fail(res, 'Error actualizando cupón:', error); }
});

// Revisar un cupón en el carrito: el total se calcula en el servidor con las cartas pedidas
router.post('/api/stores/coupons/check', authenticateToken, routeLimiter(60 * 1000, 30), async (req, res) => {
  try {
    const { folderId, code, items } = req.body || {};
    if (!isUuid(String(folderId || '')) || !Array.isArray(items) || !items.length || items.length > 100) return badRequest(res, 'Datos inválidos.');
    const userId = await ownUserId(req);
    const folder = await prisma.folder.findUnique({ where: { id: folderId }, select: { userId: true, isPublic: true } });
    if (!userId || !folder?.isPublic) return res.status(404).json({ success: false, message: 'Carpeta no encontrada' });
    const ids = items.map((i) => String(i?.id || '')).filter(isUuid);
    const cards = await prisma.card.findMany({ where: { id: { in: ids }, folderId }, select: { id: true, price: true } });
    const price = new Map(cards.map((c) => [c.id, Number(c.price) > 0 ? Number(c.price) : 0]));
    const total = items.reduce((sum, i) => sum + (price.get(String(i?.id)) || 0) * Math.min(99, Math.max(1, Math.floor(Number(i?.quantity) || 1))), 0);
    const normalized = normalizeCode(code);
    const coupon = /^[A-Z0-9]{3,20}$/.test(normalized) && (await getEffectivePlan(prisma, folder.userId)).plan.storeTools
      ? await prisma.storeCoupon.findUnique({ where: { storeId_code: { storeId: folder.userId, code: normalized } } }) : null;
    const problem = couponProblem(coupon, { total, ...(coupon ? await countCouponUses(prisma, coupon.id, userId) : {}) });
    if (problem) return res.json({ success: true, valid: false, message: problem });
    const discount = discountFor(coupon, total);
    res.json({ success: true, valid: true, code: coupon.code, discount, total: total - discount });
  } catch (error) { fail(res, 'Error revisando cupón:', error); }
});

// ---------- Demanda ----------
router.get('/api/stores/me/demand', authenticateToken, async (req, res) => {
  try {
    const userId = await storeOwner(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const demand = (await demandFor(userId)).slice(0, 300);
    const mine = new Map((await prisma.card.findMany({ where: { folder: { userId }, tcgId: { in: demand.map((d) => d.tcgId) } }, select: { tcgId: true, stock: true } })).map((c) => [c.tcgId, c.stock]));
    res.json({ success: true, demand: demand.slice(0, 100).map((d) => ({ ...d, stock: mine.get(d.tcgId) ?? null })) });
  } catch (error) { fail(res, 'Error cargando demanda:', error); }
});

export default router;
