// Reporte (solo lectura) de la sincronización nocturna del catálogo: qué corridas hubo y qué entró en cada una.
// TCGplayer: no hay un registro por elemento; lo que entró en una corrida son las filas creadas (o completadas con imagen) entre su inicio y su fin.
// Mitos y Leyendas (mazos.cl): cada corrida guarda en su resumen las listas de lo que entró, y las correcciones y cartas sin edición quedan en MylSyncFinding.
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
const MYL_SECTIONS = new Set([...SECTIONS, 'noEdition']);
const MYL_GAME = 'myl'; // valor del filtro de juego para Mitos y Leyendas (no es un juego de TCGplayer)
const MYL_NAME = 'Mitos y Leyendas';
const readLimit = routeLimiter(60 * 1000, 120);

// Filas que esta corrida creó o a las que les completó la imagen, según el tipo de sección
const windowOf = (run) => ({ gte: run.startedAt, lte: run.finishedAt || new Date() });
const whereFor = (run, section, game) => {
  const range = windowOf(run);
  const byGame = game ? { categoryId: game } : {};
  if (section === 'cards') return { kind: 'card', createdAt: range, ...byGame };
  if (section === 'products') return { kind: 'product', createdAt: range, ...byGame };
  return { createdAt: { lt: run.startedAt }, updatedAt: range, imageKey: { not: null }, ...byGame }; // filled
};
// Filtro opcional por juego (categoryId de TCGplayer); sin él se ven todos
const gameOf = (query) => (typeof query.game === 'string' && /^\d{1,9}$/.test(query.game) ? Number(query.game) : null);
const SELECT = { productId: true, name: true, number: true, rarity: true, kind: true, imageKey: true, thumbKey: true, set: { select: { name: true } }, game: { select: { name: true } } };
const cardView = (row) => ({
  productId: row.productId, name: row.name, number: row.number, rarity: row.rarity, kind: row.kind, game: row.game?.name || '', edition: row.set?.name || '',
  imageUrl: r2PublicUrl(row.thumbKey || row.imageKey),
});
const paged = (total, page, items) => ({ success: true, total, page, pages: Math.max(1, Math.ceil(total / PAGE)), items });
const slice = (list, page) => list.slice((page - 1) * PAGE, page * PAGE);

// --- Mitos y Leyendas
const summaryOf = (run) => (run.summary && typeof run.summary === 'object' ? run.summary : {});
const listOf = (run, name) => (Array.isArray(summaryOf(run).lists?.[name]) ? summaryOf(run).lists[name] : []);
const mylCounts = async (run) => {
  const summary = summaryOf(run);
  const [changes, noEdition] = await Promise.all([
    prisma.mylSyncFinding.count({ where: { kind: 'correction', createdAt: windowOf(run) } }),
    prisma.mylSyncFinding.count({ where: { kind: 'noEdition' } }), // pendientes: se quitan solas cuando la carta consigue edición
  ]);
  return { cards: summary.newCards || 0, products: (summary.newProducts || 0) + (summary.newEditions || 0), filled: summary.filled || 0, changes, noEdition };
};
// Una corrida de antes de que se guardaran las listas (o a la que le falta alguna) solo tiene cifras: el panel avisa que ese detalle no existe
const detailMissingIn = (run, section) => {
  const summary = summaryOf(run);
  if (section === 'cards') return (summary.newCards || 0) > 0 && listOf(run, 'cards').length === 0;
  if (section === 'products') return ((summary.newProducts || 0) + (summary.newEditions || 0)) > 0 && listOf(run, 'products').length + listOf(run, 'editions').length === 0;
  if (section === 'filled') return (summary.filled || 0) > 0 && listOf(run, 'filled').length === 0;
  return false;
};
const mylItems = async (run, section, page) => {
  if (detailMissingIn(run, section)) return { ...paged(0, page, []), detailMissing: true };
  if (section === 'cards') return paged(summaryOf(run).newCards || 0, page, slice(listOf(run, 'cards'), page).map((item) => ({ productId: String(item.id), name: item.name, game: MYL_NAME, edition: [item.block, item.edition].filter(Boolean).join(' · '), number: '', imageUrl: item.imageUrl || null })));
  if (section === 'filled') return paged(summaryOf(run).filled || 0, page, slice(listOf(run, 'filled'), page).map((item) => ({ productId: String(item.id), name: item.name, game: MYL_NAME, edition: [item.block, item.what && `completó ${item.what}`].filter(Boolean).join(' · '), number: '', imageUrl: item.imageUrl || null })));
  if (section === 'products') {
    const rows = [...listOf(run, 'editions').map((item) => ({ id: `e:${item.name}`, name: item.name, detail: `Edición nueva · ${item.block}` })), ...listOf(run, 'products').map((item) => ({ id: `p:${item.name}`, name: item.name, detail: `Producto nuevo · ${item.block}` }))];
    return paged(rows.length, page, slice(rows, page));
  }
  const where = section === 'changes' ? { kind: 'correction', createdAt: windowOf(run) } : { kind: 'noEdition' };
  const [total, rows] = await Promise.all([prisma.mylSyncFinding.count({ where }), prisma.mylSyncFinding.findMany({ where, orderBy: [{ blockName: 'asc' }, { name: 'asc' }, { productId: 'asc' }], skip: (page - 1) * PAGE, take: PAGE })]);
  return paged(total, page, rows.map((row) => ({ id: row.id, status: 'pending', before: row.before, after: row.after, card: { name: row.name, game: MYL_NAME, edition: row.blockName } })));
};

router.get('/api/admin/catalog-sync', authenticateToken, requireStaff(2), readLimit, async (req, res) => {
  try {
    const isMyl = req.query.game === MYL_GAME;
    const source = isMyl ? 'myl' : 'tcgplayer';
    const runs = await prisma.catalogSyncRun.findMany({ where: { source, dryRun: false, status: { not: 'running' } }, orderBy: { startedAt: 'desc' }, take: RUNS });
    const running = await prisma.catalogSyncRun.findFirst({ where: { source, status: 'running', startedAt: { gt: new Date(Date.now() - 3 * 3600 * 1000) } }, select: { startedAt: true } });
    const selected = typeof req.query.run === 'string' && UUID.test(req.query.run) ? runs.find((run) => run.id === req.query.run) : runs[0];
    const game = gameOf(req.query);
    const games = [...await prisma.catalogGame.findMany({ select: { categoryId: true, name: true }, orderBy: { name: 'asc' } }), { categoryId: MYL_GAME, name: MYL_NAME }];
    let counts = null;
    if (selected && isMyl) counts = await mylCounts(selected);
    else if (selected) {
      const [cards, products, filled, changes] = await Promise.all([
        prisma.catalogCard.count({ where: whereFor(selected, 'cards', game) }),
        prisma.catalogCard.count({ where: whereFor(selected, 'products', game) }),
        prisma.catalogCard.count({ where: whereFor(selected, 'filled', game) }),
        prisma.catalogChange.count({ where: { createdAt: windowOf(selected), ...(game ? { categoryId: game } : {}) } }),
      ]);
      counts = { cards, products, filled, changes };
    }
    res.json({
      success: true, running: Boolean(running), counts, games, selectedId: selected?.id || null,
      // Del resumen de Mitos y Leyendas solo salen las cifras, no las listas (esas van por la ruta de detalle)
      runs: runs.map((run) => ({ id: run.id, startedAt: run.startedAt, finishedAt: run.finishedAt, status: run.status, summary: run.source === 'myl' ? { ...summaryOf(run), lists: undefined } : run.summary })),
    });
  } catch (error) {
    console.error('Error cargando el reporte de sincronización:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.get('/api/admin/catalog-sync/:id/:section', authenticateToken, requireStaff(2), readLimit, async (req, res) => {
  const { id, section } = req.params;
  const page = Number.parseInt(req.query.page, 10) || 1;
  if (!UUID.test(id) || !MYL_SECTIONS.has(section) || page < 1 || page > 2000) return badRequest(res, 'Consulta inválida');
  try {
    const run = await prisma.catalogSyncRun.findUnique({ where: { id } });
    if (!run || run.dryRun) return res.status(404).json({ success: false, message: 'Corrida no encontrada' });
    if (run.source === 'myl') return res.json(await mylItems(run, section, page));
    if (run.source !== 'tcgplayer' || !SECTIONS.has(section)) return section === 'noEdition' ? badRequest(res, 'Consulta inválida') : res.status(404).json({ success: false, message: 'Corrida no encontrada' });
    const game = gameOf(req.query);
    if (section === 'changes') {
      const where = { createdAt: windowOf(run), ...(game ? { categoryId: game } : {}) };
      const [total, rows] = await Promise.all([prisma.catalogChange.count({ where }), prisma.catalogChange.findMany({ where, orderBy: [{ categoryId: 'asc' }, { productId: 'asc' }], skip: (page - 1) * PAGE, take: PAGE })]);
      const cards = await prisma.catalogCard.findMany({ where: { productId: { in: rows.map((row) => row.productId) } }, select: SELECT });
      const byId = new Map(cards.map((card) => [card.productId, cardView(card)]));
      return res.json(paged(total, page, rows.map((row) => ({ id: row.id, status: row.status, before: row.before, after: row.after, card: byId.get(row.productId) || null }))));
    }
    const where = whereFor(run, section, game);
    const [total, rows] = await Promise.all([
      prisma.catalogCard.count({ where }),
      prisma.catalogCard.findMany({ where, orderBy: [{ categoryId: 'asc' }, { groupId: 'asc' }, { name: 'asc' }, { productId: 'asc' }], skip: (page - 1) * PAGE, take: PAGE, select: SELECT }),
    ]);
    res.json(paged(total, page, rows.map(cardView)));
  } catch (error) {
    console.error('Error cargando el detalle de la sincronización:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
