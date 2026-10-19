// Cartas destacadas en el perfil público: el dueño marca cartas de sus carpetas; el máximo lo fija su plan.
// Quien baja de plan conserva las que ya tiene destacadas, pero no puede destacar más.
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { PlanLimitError, assertFeatureRoom, getEffectivePlan, lockPlanUser, sendPlanError } from '../core/entitlements.js';
import { badRequest, isUuid } from '../core/validation.js';

const router = express.Router();

const ownUserId = async (req) => (await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } }))?.id || null;

// Cuántas tengo destacadas y cuántas permite mi plan
router.get('/api/featured-cards/mine', authenticateToken, async (req, res) => {
  try {
    const userId = await ownUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const [{ plan }, count] = await Promise.all([getEffectivePlan(prisma, userId), prisma.card.count({ where: { featuredAt: { not: null }, folder: { userId } } })]);
    res.json({ success: true, count, limit: plan.featuredCards });
  } catch (error) {
    console.error('Error cargando las cartas destacadas:', error.message);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Cuerpo: { featured: true | false }
router.put('/api/folders/:id/cards/:cardId/featured', authenticateToken, async (req, res) => {
  try {
    if (typeof req.body?.featured !== 'boolean') return badRequest(res, 'Dato inválido');
    if (!isUuid(req.params.id) || !isUuid(req.params.cardId)) return res.status(404).json({ success: false, message: 'Carta no encontrada' });
    const userId = await ownUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const result = await prisma.$transaction(async (tx) => {
      await lockPlanUser(tx, userId); // dos destacados a la vez no pasan el máximo
      const card = await tx.card.findFirst({ where: { id: req.params.cardId, folderId: req.params.id, folder: { userId } }, select: { id: true, featuredAt: true } });
      if (!card) return null;
      if (req.body.featured && !card.featuredAt) {
        const { plan } = await getEffectivePlan(tx, userId);
        assertFeatureRoom(plan, 'featuredCards', await tx.card.count({ where: { featuredAt: { not: null }, folder: { userId } } }));
      }
      if (req.body.featured === Boolean(card.featuredAt)) return { id: card.id, featured: Boolean(card.featuredAt) };
      const updated = await tx.card.update({ where: { id: card.id }, data: { featuredAt: req.body.featured ? new Date() : null }, select: { id: true, featuredAt: true } });
      return { id: updated.id, featured: Boolean(updated.featuredAt) };
    });
    if (!result) return res.status(404).json({ success: false, message: 'Carta no encontrada' });
    res.json({ success: true, card: result });
  } catch (error) {
    if (error instanceof PlanLimitError) return sendPlanError(res, error);
    console.error('Error destacando una carta:', error.message);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
