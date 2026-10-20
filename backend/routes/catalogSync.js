// Reporte (solo lectura) de la sincronización nocturna del catálogo de TCGplayer: qué corridas hubo y qué entró en cada una.
// No hay un registro por elemento: lo que entró en una corrida son las filas creadas (o completadas con imagen) entre su inicio y su fin.
import express from 'express';
import { authenticateToken, requireStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { routeLimiter } from '../core/limits.js';
import { badRequest } from '../core/validation.js';
import { r2PublicUrl } from '../core/tcgCatalogImport.js';

const router = express.Router();
const PAGE = 48;
const RUNS = 14;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SECTIONS = new Set(['cards', 'products', 'filled', 'changes']);
const readLimit = routeLimiter(60 * 1000, 120);

// Filas que esta corrida creó o a las que les completó la imagen, según el tipo de sección
const windowOf = (run) => ({ gte: run.startedAt, lte: run.finishedAt || new Date() });
const whereFor = (run, section) => {
  const range = windowOf(run);
  if (section === 'cards') return { kind: 'card', createdAt: range };
  if (section === 'products') return { kind: 'product', createdAt: range };
  return { createdAt: { lt: run.startedAt }, updatedAt: range, imageKey: { not: null } }; // filled
};
const SELECT = { productId: true, name: true, number: true, rarity: true, kind: true, imageKey: true, thumbKey: true, set: { select: { name: true } }, game: { select: { name: true } } };
const cardView = (row) => ({
  productId: row.productId, name: row.name, number: row.number, rarity: row.rarity, kind: row.kind, game: row.game?.name || '', edition: row.set?.name || '',
  imageUrl: r2PublicUrl(row.thumbKey || row.imageKey),
});

router.get('/api/admin/catalog-sync', authenticateToken, requireStaff(2), readLimit, async (req, res) => {
  try {
    const runs = await prisma.catalogSyncRun.findMany({ where: { dryRun: false, status: { not: 'running' } }, orderBy: { startedAt: 'desc' }, take: RUNS });
    const running = await prisma.catalogSyncRun.findFirst({ where: { status: 'running', startedAt: { gt: new Date(Date.now() - 3 * 3600 * 1000) } }, select: { startedAt: true } });
    const selected = typeof req.query.run === 'string' && UUID.test(req.query.run) ? runs.find((run) => run.id === req.query.run) : runs[0];
    let counts = null;
    if (selected) {
      const [cards, products, filled, changes] = await Promise.all([
        prisma.catalogCard.count({ where: whereFor(selected, 'cards') }),
        prisma.catalogCard.count({ where: whereFor(selected, 'products') }),
        prisma.catalogCard.count({ where: whereFor(selected, 'filled') }),
        prisma.catalogChange.count({ where: { createdAt: windowOf(selected) } }),
      ]);
      counts = { cards, products, filled, changes };
    }
    res.json({
      success: true, running: Boolean(running), counts, selectedId: selected?.id || null,
      runs: runs.map((run) => ({ id: run.id, startedAt: run.startedAt, finishedAt: run.finishedAt, status: run.status, summary: run.summary })),
    });
  } catch (error) {
    console.error('Error cargando el reporte de sincronización:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.get('/api/admin/catalog-sync/:id/:section', authenticateToken, requireStaff(2), readLimit, async (req, res) => {
  const { id, section } = req.params;
  const page = Number.parseInt(req.query.page, 10) || 1;
  if (!UUID.test(id) || !SECTIONS.has(section) || page < 1 || page > 2000) return badRequest(res, 'Consulta inválida');
  try {
    const run = await prisma.catalogSyncRun.findUnique({ where: { id } });
    if (!run || run.dryRun) return res.status(404).json({ success: false, message: 'Corrida no encontrada' });
    if (section === 'changes') {
      const where = { createdAt: windowOf(run) };
      const [total, rows] = await Promise.all([prisma.catalogChange.count({ where }), prisma.catalogChange.findMany({ where, orderBy: [{ categoryId: 'asc' }, { productId: 'asc' }], skip: (page - 1) * PAGE, take: PAGE })]);
      const cards = await prisma.catalogCard.findMany({ where: { productId: { in: rows.map((row) => row.productId) } }, select: SELECT });
      const byId = new Map(cards.map((card) => [card.productId, cardView(card)]));
      return res.json({ success: true, total, page, pages: Math.max(1, Math.ceil(total / PAGE)), items: rows.map((row) => ({ id: row.id, status: row.status, before: row.before, after: row.after, card: byId.get(row.productId) || null })) });
    }
    const where = whereFor(run, section);
    const [total, rows] = await Promise.all([
      prisma.catalogCard.count({ where }),
      prisma.catalogCard.findMany({ where, orderBy: [{ categoryId: 'asc' }, { groupId: 'asc' }, { name: 'asc' }, { productId: 'asc' }], skip: (page - 1) * PAGE, take: PAGE, select: SELECT }),
    ]);
    res.json({ success: true, total, page, pages: Math.max(1, Math.ceil(total / PAGE)), items: rows.map(cardView) });
  } catch (error) {
    console.error('Error cargando el detalle de la sincronización:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
