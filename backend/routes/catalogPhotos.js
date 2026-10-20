// Cola de Moderación con las fotos que la comunidad propone para cartas del catálogo sin imagen (moderador o administrador).
import express from 'express';
import { authenticateToken, requireStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { routeLimiter } from '../core/limits.js';
import { badRequest, isShortText } from '../core/validation.js';
import { approveProposal, rejectProposal } from '../core/catalogPhotos.js';
import { r2PublicUrl } from '../core/tcgCatalogImport.js';
import { cleanNotice, notifyUser } from '../core/staffNotice.js';

const router = express.Router();
const PAGE = 30;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const decisionLimit = routeLimiter(60 * 1000, 60);

router.get('/api/admin/catalog-photos', authenticateToken, requireStaff(2), async (_req, res) => {
  try {
    const [rows, total] = await Promise.all([
      prisma.catalogImageProposal.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, take: PAGE }),
      prisma.catalogImageProposal.count({ where: { status: 'pending' } }),
    ]);
    const productIds = [...new Set(rows.map((row) => row.productId))];
    const [cards, users, repeated] = await Promise.all([
      prisma.catalogCard.findMany({ where: { productId: { in: productIds } }, select: { productId: true, name: true, number: true, rarity: true, imageKey: true, set: { select: { name: true } }, game: { select: { name: true } } } }),
      prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.userId))] } }, select: { id: true, username: true } }),
      prisma.catalogImageProposal.groupBy({ by: ['productId'], where: { productId: { in: productIds }, status: 'pending' }, _count: { _all: true } }),
    ]);
    const cardById = new Map(cards.map((card) => [card.productId, card]));
    const userById = new Map(users.map((user) => [user.id, user.username]));
    const repeatedById = new Map(repeated.map((row) => [row.productId, row._count._all]));
    res.json({
      success: true, total,
      proposals: rows.map((row) => {
        const card = cardById.get(row.productId);
        return {
          id: row.id, createdAt: row.createdAt, imageUrl: r2PublicUrl(row.imageKey), username: userById.get(row.userId) || null,
          samePending: repeatedById.get(row.productId) || 1, hasImage: Boolean(card?.imageKey),
          card: card ? { productId: card.productId, name: card.name, number: card.number, rarity: card.rarity, edition: card.set?.name || '', game: card.game?.name || '' } : null,
        };
      }),
    });
  } catch (error) {
    console.error('Error cargando las fotos propuestas:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

const decide = (action) => async (req, res) => {
  const { id } = req.params;
  if (!UUID.test(id)) return badRequest(res, 'Propuesta inválida');
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (action === 'reject' && note && !isShortText(note, 300)) return badRequest(res, 'El motivo es muy largo');
  try {
    const result = action === 'approve' ? await approveProposal(prisma, id, req.dbUser.id) : await rejectProposal(prisma, id, req.dbUser.id, note);
    // La persona que subió la foto se entera de lo que se decidió (no falla la decisión si el aviso no sale)
    const proposal = await prisma.catalogImageProposal.findUnique({ where: { id }, select: { userId: true, productId: true } });
    const card = proposal && await prisma.catalogCard.findUnique({ where: { productId: proposal.productId }, select: { name: true } });
    if (proposal) {
      await notifyUser(action === 'approve'
        ? { actorId: req.dbUser.id, targetId: proposal.userId, title: 'Tu foto de carta fue aprobada', summary: `Usaremos tu foto de «${card?.name || 'la carta'}» como imagen de esa carta para todos. ¡Gracias por ayudar!` }
        : { actorId: req.dbUser.id, targetId: proposal.userId, title: 'Tu foto de carta no fue aprobada', summary: `No pudimos usar tu foto de «${card?.name || 'la carta'}» como imagen de esa carta. Sigue en tu carpeta.`, message: cleanNotice(note) || '' });
    }
    res.json({ success: true, ...result });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    console.error('Error decidiendo una foto propuesta:', error);
    res.status(500).json({ success: false, message: 'No se pudo completar la acción.' });
  }
};
router.post('/api/admin/catalog-photos/:id/approve', authenticateToken, requireStaff(2), decisionLimit, decide('approve'));
router.post('/api/admin/catalog-photos/:id/reject', authenticateToken, requireStaff(2), decisionLimit, decide('reject'));

export default router;
