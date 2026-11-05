// Sección «Mitos y Leyendas» de Moderación: subir a mano las cartas que faltan y editar las que se subieron desde aquí.
// La usan los administradores y las cuentas de MYL_CARD_EDITORS. No hay ninguna ruta para borrar.
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { routeLimiter } from '../core/limits.js';
import { badRequest } from '../core/validation.js';
import { MYL_CATEGORY, cleanName } from '../core/mylSync/plan.js';
import { FREQUENCIES, TYPES, createManualCard, isManualId, readCardInput, requireMylEditor, toEditable, updateManualCard } from '../core/mylCards.js';

const router = express.Router();
const editor = requireMylEditor(prisma);
const PAGE = 24;
const include = { group: { select: { name: true, blockId: true } } };
let valuesCache = null; // razas y habilidades que ya usan las cartas, para sugerirlas al escribir

const distinct = async (name) => (await prisma.$queryRaw`SELECT DISTINCT e->>'value' AS value FROM "TcgProduct" p, jsonb_array_elements(p."extData"::jsonb) e WHERE p."categoryId" = ${MYL_CATEGORY} AND e->>'name' = ${name}`)
  .map((row) => row.value).filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));

const sendError = (res, error) => {
  if (error?.status) return res.status(error.status).json({ success: false, message: error.message, code: error.code, duplicates: error.duplicates });
  console.error('Error en las cartas de Mitos y Leyendas:', error);
  return res.status(500).json({ success: false, message: 'No se pudo completar la acción.' });
};

router.get('/api/admin/myl-cards/access', authenticateToken, editor, (_req, res) => res.json({ success: true, allowed: true }));

router.get('/api/admin/myl-cards/options', authenticateToken, editor, async (_req, res) => {
  try {
    if (!valuesCache || Date.now() - valuesCache.at > 10 * 60 * 1000) valuesCache = { at: Date.now(), races: await distinct('Race'), mechanics: await distinct('Mechanics') };
    const [blocks, groups, products] = await Promise.all([
      prisma.tcgBlock.findMany({ where: { categoryId: MYL_CATEGORY }, orderBy: { id: 'asc' }, select: { id: true, name: true } }),
      prisma.tcgGroup.findMany({ where: { categoryId: MYL_CATEGORY }, orderBy: { name: 'asc' }, select: { groupId: true, name: true, blockId: true } }),
      prisma.tcgPhysicalProduct.findMany({ where: { categoryId: MYL_CATEGORY }, orderBy: { name: 'asc' }, select: { id: true, name: true, blockId: true } }),
    ]);
    res.json({ success: true, blocks, editions: groups, products, types: TYPES, frequencies: FREQUENCIES, races: valuesCache.races, mechanics: valuesCache.mechanics });
  } catch (error) { sendError(res, error); }
});

// Las cartas creadas desde aquí (las más nuevas primero) o, con all=1, todo el catálogo por nombre: cada una dice si viene de mazos.cl o se agregó aquí
router.get('/api/admin/myl-cards', authenticateToken, editor, async (req, res) => {
  try {
    const q = cleanName(String(req.query.q || '').slice(0, 80));
    const page = Math.min(500, Math.max(1, parseInt(req.query.page, 10) || 1));
    const all = req.query.all === '1';
    if (all && q.length < 2) return badRequest(res, 'Escribe al menos 2 letras.');
    const where = { categoryId: MYL_CATEGORY, ...(all ? {} : { productId: { startsWith: 'manual-' } }), ...(q ? { cleanName: { contains: q } } : {}) };
    const [total, rows] = await Promise.all([
      prisma.tcgProduct.count({ where }),
      prisma.tcgProduct.findMany({ where, orderBy: all ? [{ cleanName: 'asc' }, { productId: 'asc' }] : { productId: 'desc' }, skip: (page - 1) * PAGE, take: PAGE, include }),
    ]);
    res.json({ success: true, total, page, pages: Math.max(1, Math.ceil(total / PAGE)), cards: rows.map(toEditable) });
  } catch (error) { sendError(res, error); }
});

router.post('/api/admin/myl-cards', authenticateToken, editor, routeLimiter(60 * 60 * 1000, 200), async (req, res) => {
  const { input, error } = readCardInput(req.body);
  if (error) return badRequest(res, error);
  try {
    const card = await createManualCard(prisma, req.dbUser, input);
    valuesCache = null;
    return res.json({ success: true, card });
  } catch (err) { return sendError(res, err); }
});

router.put('/api/admin/myl-cards/:productId', authenticateToken, editor, routeLimiter(60 * 60 * 1000, 300), async (req, res) => {
  if (!isManualId(req.params.productId)) return res.status(404).json({ success: false, message: 'Esa carta no se creó desde aquí, así que no se puede editar.' });
  const { input, error } = readCardInput(req.body);
  if (error) return badRequest(res, error);
  try {
    const card = await updateManualCard(prisma, req.dbUser, req.params.productId, input);
    valuesCache = null;
    return res.json({ success: true, card });
  } catch (err) { return sendError(res, err); }
});

export default router;
