// Reseñas de vendedores y su moderación.
import express from 'express';
import { authenticateToken, currentUserId, requireAdmin } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { getReviewSummary } from '../core/publicSeller.js';
import { badRequest, hasControlChars, isOptionalText, isUuid } from '../core/validation.js';
import { moderationHooks } from '../moderation/services.js';

const router = express.Router();

// --- Reseñas de vendedores ---
// Solo el comprador de un pedido completado puede calificar, una vez por pedido; la reseña no se edita ni se responde.
const REVIEWS_PAGE_SIZE = 10;

router.post('/api/reviews', authenticateToken, async (req, res) => {
  try {
    const reviewerId = await currentUserId(req);
    if (!reviewerId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const { orderId, rating, comment } = req.body || {};
    if (typeof orderId !== 'string' || !isUuid(orderId)) return badRequest(res, 'Pedido inválido');
    const stars = Number(rating);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return badRequest(res, 'Elige de 1 a 5 estrellas');
    if (comment !== undefined && comment !== null && (!isOptionalText(comment, 300) || hasControlChars(String(comment).replace(/[\r\n]/g, ' ')))) return badRequest(res, 'Comentario inválido');
    const text = comment ? String(comment).trim() || null : null;

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.buyerId !== reviewerId) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    if (order.sellerId === reviewerId) return badRequest(res, 'No puedes calificarte a ti mismo');
    if (order.status !== 'completed') return badRequest(res, 'Solo puedes calificar pedidos completados');

    // Una reseña por pareja comprador-vendedor: un pedido nuevo al mismo vendedor no suma otra
    const alreadyReviewed = await prisma.sellerReview.findFirst({ where: { sellerId: order.sellerId, reviewerId }, select: { id: true } });
    if (alreadyReviewed) return res.status(409).json({ success: false, message: 'Ya calificaste a este vendedor' });
    // Pedido creado y confirmado desde la misma conexión: la reseña se guarda pero no se muestra ni promedia
    const sameConnection = Boolean(order.createdIpHash && order.completedIpHash && order.createdIpHash === order.completedIpHash);

    let review;
    try {
      review = await prisma.sellerReview.create({ data: { sellerId: order.sellerId, reviewerId, orderId: order.id, rating: stars, comment: text, counts: !sameConnection, flag: sameConnection ? 'same_connection' : null } });
    } catch (error) {
      if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Ya calificaste a este vendedor' });
      throw error;
    }
    if (review.comment) moderationHooks.flagText?.('review', review.id, review.comment, 'review', null);
    res.json({ success: true, review: { id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt } });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Compras completadas del usuario que aún no calificó
router.get('/api/reviews/pending', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const orders = await prisma.order.findMany({
      where: { buyerId: userId, status: 'completed' },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      select: { id: true, code: true, sellerId: true, folderName: true, updatedAt: true }
    });
    if (orders.length === 0) return res.json({ success: true, pending: [] });
    const reviewed = await prisma.sellerReview.findMany({ where: { reviewerId: userId }, select: { orderId: true, sellerId: true } });
    const reviewedOrders = new Set(reviewed.map((row) => row.orderId));
    const reviewedSellers = new Set(reviewed.map((row) => row.sellerId));
    const seenSellers = new Set();
    // Solo se puede calificar una vez a cada vendedor: se ofrece el pedido más reciente de cada uno que aún no calificaste
    const open = orders.filter((order) => {
      if (reviewedOrders.has(order.id) || reviewedSellers.has(order.sellerId) || seenSellers.has(order.sellerId)) return false;
      seenSellers.add(order.sellerId);
      return true;
    });
    const sellers = open.length
      ? await prisma.user.findMany({ where: { id: { in: [...new Set(open.map((order) => order.sellerId))] } }, select: { id: true, name: true, username: true, photoURL: true } })
      : [];
    const sellerById = new Map(sellers.map((seller) => [seller.id, seller]));
    res.json({
      success: true,
      pending: open.map((order) => ({
        orderId: order.id,
        code: order.code,
        folderName: order.folderName,
        completedAt: order.updatedAt,
        seller: { name: sellerById.get(order.sellerId)?.name || null, username: sellerById.get(order.sellerId)?.username || null, photoURL: sellerById.get(order.sellerId)?.photoURL || null }
      }))
    });
  } catch (error) {
    console.error('Error loading pending reviews:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Reportar una reseña: siempre queda para moderación (/moderacion). Deja de contar y de mostrarse cuando la reportan
// REVIEW_HIDE_REPORTS compradores verificados (con al menos una compra completada) distintos del vendedor calificado:
// así ni el vendedor ni cuentas recién creadas pueden ocultar reseñas por su cuenta.
export const REVIEW_HIDE_REPORTS = 2;
router.post('/api/reviews/:id/report', authenticateToken, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    const reporterId = await currentUserId(req);
    if (!reporterId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const reason = req.body?.reason;
    if (!isOptionalText(reason, 200) || (typeof reason === 'string' && hasControlChars(reason.replace(/[\r\n]/g, ' ')))) return badRequest(res, 'Motivo inválido');

    // Solo se pueden reportar reseñas visibles; quien la escribió no puede reportarla
    const review = await prisma.sellerReview.findFirst({ where: { id: req.params.id, counts: true }, select: { id: true, reviewerId: true, sellerId: true } });
    if (!review) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    if (review.reviewerId === reporterId) return badRequest(res, 'No puedes reportar tu propia reseña');

    let hidden = false;
    try {
      hidden = await prisma.$transaction(async (tx) => {
        await tx.reviewReport.create({ data: { reviewId: review.id, reporterId, reason: reason ? String(reason).trim() || null : null } });
        const reporters = await tx.reviewReport.findMany({ where: { reviewId: review.id, reporterId: { not: review.sellerId } }, select: { reporterId: true } });
        const verified = reporters.length
          ? await tx.order.groupBy({ by: ['buyerId'], where: { buyerId: { in: reporters.map((row) => row.reporterId) }, status: 'completed' } })
          : [];
        const hide = verified.length >= REVIEW_HIDE_REPORTS;
        await tx.sellerReview.update({ where: { id: review.id }, data: { flag: 'reported', ...(hide ? { counts: false } : {}) } });
        return hide;
      });
    } catch (error) {
      if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Ya reportaste esta reseña' });
      throw error;
    }
    res.json({ success: true, hidden });
  } catch (error) {
    console.error('Error reporting review:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Reseñas públicas de un vendedor: solo calificación, comentario, fecha y nombre/usuario/foto de quien escribió
router.get('/api/users/:username/reviews', async (req, res) => {
  try {
    const username = typeof req.params.username === 'string' ? req.params.username.trim() : '';
    const page = Number.parseInt(req.query.page, 10) || 1;
    if (!username || username.length > 60 || page < 1 || page > 100) return badRequest(res, 'Consulta inválida');
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) return res.status(404).json({ success: false, message: 'Vendedor no encontrado' });
    const [summary, rows] = await Promise.all([
      getReviewSummary(user.id),
      prisma.sellerReview.findMany({
        where: { sellerId: user.id, counts: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * REVIEWS_PAGE_SIZE,
        take: REVIEWS_PAGE_SIZE,
        select: { id: true, rating: true, comment: true, createdAt: true, reviewer: { select: { name: true, username: true, photoURL: true } } }
      })
    ]);
    res.json({
      success: true,
      ...summary,
      page,
      pages: Math.max(1, Math.ceil(summary.count / REVIEWS_PAGE_SIZE)),
      reviews: rows.map((row) => ({ id: row.id, rating: row.rating, comment: row.comment, createdAt: row.createdAt, reviewer: { name: row.reviewer?.name || null, username: row.reviewer?.username || null, photoURL: row.reviewer?.photoURL || null } }))
    });
  } catch (error) {
    console.error('Error loading reviews:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// --- Moderación de reseñas (solo administradores): reportadas, visibles u ocultas, y las de la misma conexión ---
router.get('/api/admin/reviews', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const rows = await prisma.sellerReview.findMany({
      where: { OR: [{ counts: false }, { flag: 'reported' }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, rating: true, comment: true, counts: true, flag: true, createdAt: true,
        seller: { select: { name: true, username: true } },
        reviewer: { select: { name: true, username: true } },
        reports: { orderBy: { createdAt: 'desc' }, select: { reason: true, createdAt: true } }
      }
    });
    res.json({ success: true, reviews: rows });
  } catch (error) {
    console.error('Error loading reviews for moderation:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Aprobar: vuelve a mostrarse y contar; se borran sus reportes
router.post('/api/admin/reviews/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    const review = await prisma.sellerReview.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!review) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    await prisma.$transaction([
      prisma.reviewReport.deleteMany({ where: { reviewId: review.id } }),
      prisma.sellerReview.update({ where: { id: review.id }, data: { counts: true, flag: null } })
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error approving review:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Eliminar: se borra la reseña (y sus reportes); el comprador podrá volver a calificar a ese vendedor
router.delete('/api/admin/reviews/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    const deleted = await prisma.sellerReview.deleteMany({ where: { id: req.params.id } });
    if (deleted.count === 0) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
