// Importar cartas a una carpeta desde un CSV (TCGplayer, TCGmatch…). El navegador lee el archivo y manda filas ya normalizadas;
// aquí se buscan en el catálogo (por id de TCGplayer o por nombre + número + edición) y se guardan respetando los límites del plan.
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { PlanLimitError, assertStockChange, getEffectivePlan, lockPlanUser, sendPlanError } from '../core/entitlements.js';
import { limitReached } from '../core/plans.js';
import { r2PublicUrl } from '../core/tcgCatalogImport.js';
import { badRequest, cleanCardData, isOptionalText, isUuid, isValidCondition, isValidPrice, normalizedCondition } from '../core/validation.js';

const router = express.Router();
const MAX_ROWS = 300; // por pedido: el navegador envía archivos grandes en tandas
const LANGUAGES = ['English', 'Spanish', 'Japanese'];
// Juego de la carpeta → categorías de TCGplayer donde se buscan las cartas (Mitos y Leyendas no existe en TCGplayer)
const CATEGORIES = { Pokemon: [3, 85], Pokemon_Japan: [85], OnePiece: [68], Magic: [1], YuGiOh: [2], Riftbound: [89], Lorcana: [71], Digimon: [63] };

const plain = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const baseName = (name) => plain(String(name ?? '').split(' - ')[0]);
const numberKey = (value) => plain(String(value ?? '').split('/')[0]).replace(/^0+(?=\d)/, '');
const finishOf = (data) => (data && typeof data === 'object' && typeof data.finish === 'string' ? data.finish : '');
const SELECT = { productId: true, categoryId: true, name: true, number: true, rarity: true, imageKey: true, set: { select: { name: true } } };

// Una fila bien formada o null
const cleanRow = (raw) => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const productId = r.productId === undefined || r.productId === null || r.productId === '' ? null : Number(r.productId);
  const quantity = r.quantity === undefined || r.quantity === '' ? 1 : Number(r.quantity);
  if (productId !== null && !(Number.isInteger(productId) && productId > 0 && productId < 2147483647)) return null;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) return null;
  if (![r.name, r.set, r.number, r.finish].every((value) => isOptionalText(value, 300)) || !isValidCondition(r.condition) || !isValidPrice(r.price)) return null;
  if (r.language && !LANGUAGES.includes(r.language)) return null;
  if (productId === null && !String(r.name || '').trim()) return null;
  return {
    line: Number.isInteger(r.line) ? r.line : 0, productId, quantity,
    name: String(r.name || '').trim(), set: String(r.set || '').trim(), number: String(r.number || '').trim(),
    language: r.language || '', condition: normalizedCondition(r.condition),
    finish: String(r.finish || '').trim().slice(0, 40), price: r.price === undefined || r.price === null || r.price === '' ? null : Number(r.price),
  };
};

router.post('/api/folders/:id/cards-import', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
    const folder = isUuid(req.params.id) ? await prisma.folder.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true, tcg: true } }) : null;
    if (!user || !folder || folder.userId !== user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
    const categoryId = CATEGORIES[folder.tcg];
    if (!categoryId) return badRequest(res, 'Esta carpeta no admite importar cartas desde un CSV.');
    const input = req.body?.rows;
    if (!Array.isArray(input) || input.length === 0 || input.length > MAX_ROWS) return badRequest(res, 'Filas inválidas');

    const skipped = []; // { line, name, reason }: invalid | notFound | ambiguous | limit
    const rows = [];
    input.forEach((raw) => {
      const row = cleanRow(raw);
      if (row) rows.push(row);
      else skipped.push({ line: Number.isInteger(raw?.line) ? raw.line : 0, name: String(raw?.name || '').slice(0, 80), reason: 'invalid' });
    });

    // 1. Por id de TCGplayer
    const ids = [...new Set(rows.map((row) => row.productId).filter(Boolean))];
    const byId = new Map((ids.length ? await prisma.catalogCard.findMany({ where: { productId: { in: ids }, categoryId: { in: categoryId }, kind: 'card' }, select: SELECT }) : []).map((card) => [card.productId, card]));
    // 2. Sin id (o id desconocido): por nombre, y se afina con el número y la edición
    const byName = new Map();
    const resolved = [];
    for (const row of rows) {
      let hit = row.productId ? byId.get(row.productId) : null;
      if (!hit && row.name) {
        const key = baseName(row.name);
        if (!byName.has(key)) {
          const found = await prisma.catalogCard.findMany({ where: { categoryId: { in: categoryId }, kind: 'card', OR: [{ cleanName: { equals: key, mode: 'insensitive' } }, { name: { startsWith: row.name.split(' - ')[0].trim(), mode: 'insensitive' } }] }, select: SELECT, take: 80 });
          byName.set(key, found.filter((card) => baseName(card.name) === key));
        }
        let candidates = byName.get(key);
        if (row.number) candidates = candidates.filter((card) => numberKey(card.number) === numberKey(row.number));
        if (row.set && candidates.length > 1) {
          const sameSet = candidates.filter((card) => plain(card.set.name) === plain(row.set));
          candidates = sameSet.length ? sameSet : candidates.filter((card) => plain(card.set.name).includes(plain(row.set)) || plain(row.set).includes(plain(card.set.name)));
        }
        if (candidates.length === 1) hit = candidates[0];
        else { skipped.push({ line: row.line, name: row.name.slice(0, 80), reason: candidates.length ? 'ambiguous' : 'notFound' }); continue; }
      }
      if (!hit) { skipped.push({ line: row.line, name: (row.name || String(row.productId)).slice(0, 80), reason: 'notFound' }); continue; }
      resolved.push({ row, hit });
    }

    // 3. Guardar: lo que ya está en la carpeta (misma carta, idioma, estado y acabado) suma cantidad; lo demás se crea
    const result = await prisma.$transaction(async (tx) => {
      await lockPlanUser(tx, user.id);
      if (!(await tx.folder.findFirst({ where: { id: folder.id, userId: user.id }, select: { id: true } }))) throw Object.assign(new Error('Not authorized'), { status: 403 });
      const { plan } = await getEffectivePlan(tx, user.id);
      const tcgIds = [...new Set(resolved.map(({ hit }) => String(hit.productId)))];
      const existing = tcgIds.length ? await tx.card.findMany({ where: { folderId: folder.id, tcgId: { in: tcgIds } }, select: { id: true, tcgId: true, language: true, condition: true, stock: true, price: true, data: true } }) : [];
      const identity = (tcgId, language, condition, finish) => [tcgId, language, condition ?? '', finish].join('\u0000');
      const known = new Map(existing.map((card) => [identity(card.tcgId, card.language, card.condition, finishOf(card.data)), card]));
      let uniqueCount = await tx.card.count({ where: { folderId: folder.id } });
      let created = 0;
      let merged = 0;
      for (const { row, hit } of resolved) {
        const tcgId = String(hit.productId);
        const language = row.language || (hit.categoryId === 85 ? 'Japanese' : 'English');
        const finish = row.finish && !/^normal$/i.test(row.finish) ? row.finish : '';
        const key = identity(tcgId, language, row.condition, finish);
        const current = known.get(key);
        try {
          if (current) {
            assertStockChange(plan, current.stock, current.stock + row.quantity);
            const data = { stock: current.stock + row.quantity, ...(current.price === null && row.price !== null ? { price: row.price } : {}) };
            await tx.card.update({ where: { id: current.id }, data });
            current.stock = data.stock;
            merged += 1;
          } else {
            if (limitReached(uniqueCount, plan.uniqueCardsPerFolder)) throw new PlanLimitError('plan_unique_card_limit', { current: uniqueCount, limit: plan.uniqueCardsPerFolder, planKey: plan.key });
            assertStockChange(plan, 0, row.quantity);
            const card = await tx.card.create({
              data: {
                tcgId, name: hit.name, imageUrl: r2PublicUrl(hit.imageKey), price: row.price, stock: row.quantity, language, condition: row.condition, folderId: folder.id,
                data: { ...(cleanCardData({ ...(finish ? { finish } : {}), pseudoName: '', set: hit.set.name || 'Unknown', rarity: hit.rarity || 'Unknown', number: hit.number || '' }) || {}), language },
              },
              select: { id: true, tcgId: true, language: true, condition: true, stock: true, price: true, data: true },
            });
            known.set(key, card);
            uniqueCount += 1;
            created += 1;
          }
        } catch (error) {
          if (!(error instanceof PlanLimitError)) throw error;
          skipped.push({ line: row.line, name: hit.name.slice(0, 80), reason: 'limit' });
        }
      }
      return { created, merged };
    }, { timeout: 20000 });

    res.json({ success: true, ...result, skipped: skipped.slice(0, 100), skippedCount: skipped.length });
  } catch (error) {
    if (error instanceof PlanLimitError) return sendPlanError(res, error);
    if (error.status === 403) return res.status(403).json({ success: false, message: error.message });
    console.error('Error importando cartas desde un CSV:', error.message);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
