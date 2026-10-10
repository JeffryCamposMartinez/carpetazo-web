// Carga de cartas nuevas al catálogo desde "cartas_incrementales.json" (solo administradores).
// Dos pasos: "preview" compara el archivo con la base sin escribir; "apply" vuelve a revisarlo y crea solo lo nuevo.
import express from 'express';
import { authenticateToken, requireStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { badRequest } from '../core/validation.js';
import { IMPORT_CATEGORY_ID, IMPORT_FILE_NAME, buildImportPlan, checkImages } from '../core/catalogImport.js';

const router = express.Router();
const PREVIEW_CARDS = 600;
let applying = false; // una carga a la vez: un doble clic o dos pestañas no la procesan dos veces

const field = (card, name) => card.extData.find((entry) => entry.name === name)?.value || '';
const publicCard = (card) => ({
  productId: card.productId, name: card.name, edition: card.editionName, block: card.blockName, product: card.physicalName, imageUrl: card.imageUrl,
  previousName: card.previousName || undefined, previousEdition: card.previousEdition || undefined, type: field(card, 'Type'), cost: field(card, 'Cost'), force: field(card, 'Fuerza'), race: field(card, 'Race'), frequency: field(card, 'Frequency'), number: field(card, 'Number'),
  status: card.status
});

// Valida lo que llega del navegador: nombre exacto del archivo y un objeto con las cartas
const readBody = (req, res) => {
  const { fileName, data } = req.body || {};
  if (fileName !== IMPORT_FILE_NAME) { badRequest(res, `Solo se acepta el archivo ${IMPORT_FILE_NAME}.`); return null; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) { badRequest(res, 'El contenido del archivo no es válido.'); return null; }
  return data;
};

router.post('/api/admin/catalog-import/preview', authenticateToken, requireStaff(3), async (req, res) => {
  const data = readBody(req, res);
  if (!data) return undefined;
  try {
    const plan = await buildImportPlan(prisma, data);
    if (plan.fatal) return badRequest(res, plan.fatal);
    const images = await checkImages(plan.cards);
    return res.json({
      success: true,
      digest: plan.digest,
      generatedAt: plan.generatedAt,
      counts: plan.counts,
      editions: plan.editions,
      physicalProducts: plan.physicalProducts,
      errors: plan.errors.slice(0, 200),
      images,
      cards: plan.cards.slice(0, PREVIEW_CARDS).map(publicCard),
      truncated: plan.cards.length > PREVIEW_CARDS,
      canApply: plan.errors.length === 0 && plan.counts.new + plan.counts.updated + plan.counts.newLinks > 0
    });
  } catch (error) {
    console.error('Error en la vista previa de la carga de cartas:', error);
    return res.status(500).json({ success: false, message: 'No se pudo revisar el archivo.' });
  }
});

router.post('/api/admin/catalog-import/apply', authenticateToken, requireStaff(3), async (req, res) => {
  const data = readBody(req, res);
  if (!data) return undefined;
  if (typeof req.body.digest !== 'string' || !/^[0-9a-f]{64}$/.test(req.body.digest)) return badRequest(res, 'Falta revisar el archivo antes de cargarlo.');
  if (applying) return res.status(409).json({ success: false, message: 'Ya hay una carga en curso. Espera a que termine.' });
  applying = true;
  try {
    const plan = await buildImportPlan(prisma, data);
    if (plan.fatal) return badRequest(res, plan.fatal);
    if (plan.errors.length) return res.status(409).json({ success: false, message: 'El archivo tiene errores; corrígelos y vuelve a revisarlo.' });
    if (plan.digest !== req.body.digest) return res.status(409).json({ success: false, message: 'El archivo cambió desde la revisión. Vuelve a revisarlo.' });

    const fresh = plan.cards.filter((card) => card.status === 'new');
    const result = await prisma.$transaction(async (tx) => {
      // Ediciones y productos físicos que aún no existían: se crean primero, con ids propios (la secuencia de una base restaurada puede ir atrasada)
      const groupIds = new Map();
      let nextGroupId = Math.max(900000, ((await tx.tcgGroup.aggregate({ _max: { groupId: true } }))._max.groupId ?? 0) + 1);
      for (const group of plan.newGroups) {
        const row = await tx.tcgGroup.create({ data: { groupId: nextGroupId++, name: group.name, blockId: group.blockId, categoryId: IMPORT_CATEGORY_ID, publishedOn: new Date(), modifiedOn: new Date() } });
        groupIds.set(group.key, row.groupId);
      }
      const physicalIds = new Map();
      let nextPhysicalId = ((await tx.tcgPhysicalProduct.aggregate({ _max: { id: true } }))._max.id ?? 0) + 1;
      for (const product of plan.newProducts) {
        const row = await tx.tcgPhysicalProduct.create({ data: { id: nextPhysicalId++, name: product.name, categoryId: IMPORT_CATEGORY_ID, blockId: product.blockId } });
        physicalIds.set(product.key, row.id);
      }
      const physicalOf = (key) => (key === null ? null : key.startsWith('id:') ? Number(key.slice(3)) : physicalIds.get(key) ?? null);
      const created = await tx.tcgProduct.createMany({
        data: fresh.map((card) => ({ productId: card.productId, name: card.name, cleanName: card.cleanName, imageUrl: card.imageUrl, extData: card.extData, groupId: card.groupId ?? groupIds.get(card.groupKey), categoryId: IMPORT_CATEGORY_ID, physicalProductId: physicalOf(card.physicalKey) })),
        skipDuplicates: true
      });
      // Cartas que ya existían con otro nombre, imagen o edición (del mismo bloque): se corrigen; los enlaces a productos solo se agregan
      let updated = 0;
      for (const card of plan.cards.filter((item) => item.status === 'update')) {
        await tx.tcgProduct.update({ where: { productId: card.productId }, data: { name: card.name, cleanName: card.cleanName, imageUrl: card.imageUrl, extData: card.extData, groupId: card.groupId ?? groupIds.get(card.groupKey) } });
        updated++;
      }
      const linkRows = plan.links.map((link) => ({ productId: link.productId, physicalProductId: physicalOf(link.physicalKey) })).filter((link) => link.physicalProductId !== null);
      const linked = linkRows.length ? await tx.tcgProductPhysicalProduct.createMany({ data: linkRows, skipDuplicates: true }) : { count: 0 };
      // Antes de confirmar se comprueba que las cartas quedaron en la base
      const stored = await tx.tcgProduct.count({ where: { productId: { in: plan.cards.map((card) => card.productId) }, categoryId: IMPORT_CATEGORY_ID } });
      if (stored !== plan.cards.length) throw new Error('La verificación previa a confirmar no coincide.');
      await tx.moderationAudit.create({
        data: { actorId: req.dbUser?.id || null, action: 'catalog.import', targetType: 'catalog', targetId: plan.digest.slice(0, 16), note: `Carga de cartas: ${created.count} nuevas, ${updated} actualizadas, ${plan.cards.length - created.count - updated} sin cambios${plan.newGroups.length ? `, ${plan.newGroups.length} edición(es) nueva(s)` : ''}${plan.newProducts.length ? `, ${plan.newProducts.length} producto(s) nuevo(s)` : ''}`, meta: { digest: plan.digest, created: created.count, updated, links: linked.count, total: plan.cards.length, newGroups: plan.newGroups.map((group) => group.name), newProducts: plan.newProducts.map((product) => product.name) } }
      });
      return { created: created.count, linked: linked.count, updated };
    }, { timeout: 60000, maxWait: 10000 });
    return res.json({ success: true, created: result.created, linked: result.linked, updated: result.updated, existing: plan.cards.length - result.created - result.updated, total: plan.cards.length, newGroups: plan.newGroups.length, newProducts: plan.newProducts.length });
  } catch (error) {
    console.error('Error cargando cartas al catálogo:', error);
    return res.status(500).json({ success: false, message: 'No se pudo cargar el archivo. No se guardó ningún cambio.' });
  } finally {
    applying = false;
  }
});

export default router;
