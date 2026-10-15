// Carga del catálogo de TCGplayer desde los archivos "cartas_incrementales_tcg_*.json" (solo administradores).
// Dos pasos, igual que la carga de Mitos y Leyendas: "preview" compara el archivo con la base sin escribir; "apply" vuelve a revisarlo y guarda.
import express from 'express';
import { authenticateToken, requireStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { badRequest } from '../core/validation.js';
import { buildTcgImportPlan, checkTcgImages, r2PublicUrl } from '../core/tcgCatalogImport.js';

const router = express.Router();
const PREVIEW_CARDS = 300;
const FILE_NAME = /^cartas_incrementales_tcg_[\w .\-]{1,100}\.json$/;
let applying = false; // una carga a la vez: un doble clic o dos pestañas no la procesan dos veces

const publicCard = (card, setNames) => ({
  productId: card.productId, categoryId: card.categoryId, name: card.name, kind: card.kind, number: card.number, rarity: card.rarity,
  edition: setNames.get(card.groupId) || '', imageUrl: r2PublicUrl(card.thumbKey || card.imageKey), previousName: card.previousName || undefined, status: card.status,
});

const readBody = (req, res) => {
  const { fileName, data } = req.body || {};
  if (typeof fileName !== 'string' || !FILE_NAME.test(fileName)) { badRequest(res, 'El archivo debe llamarse cartas_incrementales_tcg_….json.'); return null; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) { badRequest(res, 'El contenido del archivo no es válido.'); return null; }
  return data;
};

router.post('/api/admin/tcg-catalog-import/preview', authenticateToken, requireStaff(3), async (req, res) => {
  const data = readBody(req, res);
  if (!data) return undefined;
  try {
    const plan = await buildTcgImportPlan(prisma, data);
    if (plan.fatal) return badRequest(res, plan.fatal);
    const images = await checkTcgImages(plan.cards);
    const setNames = new Map(plan.sets.map((set) => [set.groupId, set.name]));
    // Lo que cambia primero: así la lista corta muestra lo importante
    const order = { new: 0, update: 1, exists: 2 };
    const shown = [...plan.cards].sort((a, b) => order[a.status] - order[b.status]).slice(0, PREVIEW_CARDS);
    return res.json({
      success: true,
      digest: plan.digest,
      generatedAt: plan.generatedAt,
      counts: plan.counts,
      games: plan.perGame,
      errors: plan.errors.slice(0, 200),
      images,
      cards: shown.map((card) => publicCard(card, setNames)),
      truncated: plan.cards.length > PREVIEW_CARDS,
      canApply: plan.errors.length === 0 && plan.counts.new + plan.counts.updated + plan.counts.newSets + plan.counts.changedSets + plan.counts.newGames > 0,
    });
  } catch (error) {
    console.error('Error en la vista previa del catálogo TCG:', error);
    return res.status(500).json({ success: false, message: 'No se pudo revisar el archivo.' });
  }
});

router.post('/api/admin/tcg-catalog-import/apply', authenticateToken, requireStaff(3), async (req, res) => {
  const data = readBody(req, res);
  if (!data) return undefined;
  if (typeof req.body.digest !== 'string' || !/^[0-9a-f]{64}$/.test(req.body.digest)) return badRequest(res, 'Falta revisar el archivo antes de cargarlo.');
  if (applying) return res.status(409).json({ success: false, message: 'Ya hay una carga en curso. Espera a que termine.' });
  applying = true;
  try {
    const plan = await buildTcgImportPlan(prisma, data);
    if (plan.fatal) return badRequest(res, plan.fatal);
    if (plan.errors.length) return res.status(409).json({ success: false, message: 'El archivo tiene errores; corrígelos y vuelve a revisarlo.' });
    if (plan.digest !== req.body.digest) return res.status(409).json({ success: false, message: 'El archivo cambió desde la revisión. Vuelve a revisarlo.' });

    const fresh = plan.cards.filter((card) => card.status === 'new');
    const changed = plan.cards.filter((card) => card.status === 'update');
    const result = await prisma.$transaction(async (tx) => {
      // Juegos y ediciones primero: las cartas dependen de ellos
      for (const game of plan.games) {
        await tx.catalogGame.upsert({ where: { categoryId: game.categoryId }, create: game, update: { name: game.name, folder: game.folder } });
      }
      for (const set of plan.sets) {
        const { groupId, ...rest } = set;
        await tx.catalogSet.upsert({ where: { groupId }, create: set, update: rest });
      }
      const created = await tx.catalogCard.createMany({ data: fresh.map(({ status, previousName, ...card }) => card), skipDuplicates: true });
      for (const { status, previousName, productId, ...card } of changed) await tx.catalogCard.update({ where: { productId }, data: card });
      // Antes de confirmar se comprueba que las cartas quedaron en la base
      const stored = await tx.catalogCard.count({ where: { productId: { in: plan.cards.map((card) => card.productId) } } });
      if (stored !== plan.cards.length) throw new Error('La verificación previa a confirmar no coincide.');
      await tx.moderationAudit.create({
        data: {
          actorId: req.dbUser?.id || null, action: 'tcgcatalog.import', targetType: 'catalog', targetId: plan.digest.slice(0, 16),
          note: `Catálogo TCG: ${created.count} nuevas, ${changed.length} actualizadas, ${plan.cards.length - created.count - changed.length} sin cambios${plan.newGames.length ? `, ${plan.newGames.length} juego(s) nuevo(s)` : ''}${plan.newSets.length ? `, ${plan.newSets.length} edición(es) nueva(s)` : ''}`,
          meta: { digest: plan.digest, created: created.count, updated: changed.length, total: plan.cards.length, games: plan.games.map((game) => game.name), newSets: plan.newSets.length },
        },
      });
      return { created: created.count, updated: changed.length };
    }, { timeout: 120000, maxWait: 10000 });
    return res.json({ success: true, created: result.created, updated: result.updated, existing: plan.cards.length - result.created - result.updated, total: plan.cards.length, newGames: plan.newGames.length, newSets: plan.newSets.length });
  } catch (error) {
    console.error('Error cargando el catálogo TCG:', error);
    return res.status(500).json({ success: false, message: 'No se pudo cargar el archivo. No se guardó ningún cambio.' });
  } finally {
    applying = false;
  }
});

export default router;
