// Herramientas del plan Tienda. Bloque 1: ficha del local (dirección, horarios, pagos, juegos, fotos, política).
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { PlanFeatureError, assertFeature, getEffectivePlan, sendPlanError } from '../core/entitlements.js';
import { routeLimiter } from '../core/limits.js';
import { badRequest, isSmallObject } from '../core/validation.js';
import { parseStoreProfile, toPublicStore } from '../core/storeProfile.js';

const router = express.Router();

const ownUserId = async (req) => (await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } }))?.id || null;

// Ficha completa del dueño (aunque ya no tenga el plan, para que no pierda lo escrito)
router.get('/api/stores/me', authenticateToken, async (req, res) => {
  try {
    const userId = await ownUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const [{ plan }, profile] = await Promise.all([getEffectivePlan(prisma, userId), prisma.storeProfile.findUnique({ where: { userId } })]);
    const store = profile ? { ...toPublicStore({ ...profile, enabled: true }), enabled: profile.enabled } : null;
    res.json({ success: true, allowed: Boolean(plan.storeTools), store });
  } catch (error) {
    console.error('Error cargando la ficha de la tienda:', error.message);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.put('/api/stores/me', authenticateToken, routeLimiter(60 * 1000, 30), async (req, res) => {
  try {
    if (!isSmallObject(req.body, 24000)) return badRequest(res, 'Datos de la tienda demasiado grandes.');
    const userId = await ownUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const { plan } = await getEffectivePlan(prisma, userId);
    assertFeature(plan, 'storeTools');
    const parsed = parseStoreProfile(req.body);
    if (!parsed.ok) return badRequest(res, parsed.error);
    const data = { ...parsed.data, hours: parsed.data.hours ?? undefined };
    const profile = await prisma.storeProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    res.json({ success: true, store: { ...toPublicStore({ ...profile, enabled: true }), enabled: profile.enabled } });
  } catch (error) {
    if (error instanceof PlanFeatureError) return sendPlanError(res, error);
    console.error('Error guardando la ficha de la tienda:', error.message);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
