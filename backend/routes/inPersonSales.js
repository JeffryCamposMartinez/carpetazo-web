// Venta presencial: el dueño de una carpeta registra lo que vendió en persona; baja el stock y queda en su historial.
// Es una declaración propia: no crea pedidos y no alimenta el precio de referencia ni «Últimas ventas».
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { badRequest, isUuid } from '../core/validation.js';

const router = express.Router();
const MAX_LINES = 100;
const MAX_QUANTITY = 100000;
const MAX_PRICE = 100000000;
const HISTORY_SHOWN = 30;
const MINE_SHOWN = 200;

// Las ventas anteriores a que se guardara la imagen la toman de la carta si todavía existe
const withImages = async (sales) => {
  const missing = [...new Set(sales.flatMap((sale) => (Array.isArray(sale.items) ? sale.items : [])).filter((line) => !line.imageUrl && isUuid(String(line.cardId || ''))).map((line) => line.cardId))];
  if (!missing.length) return sales;
  const cards = await prisma.card.findMany({ where: { id: { in: missing } }, select: { id: true, imageUrl: true } });
  const byId = new Map(cards.map((card) => [card.id, card.imageUrl]));
  return sales.map((sale) => ({ ...sale, items: (Array.isArray(sale.items) ? sale.items : []).map((line) => (line.imageUrl ? line : { ...line, imageUrl: byId.get(line.cardId) || null })) }));
};

const publicSale = (sale) => ({ id: sale.id, folderId: sale.folderId, folderName: sale.folderName, items: sale.items, units: sale.units, total: sale.total, subtotal: sale.subtotal, adjustmentType: sale.adjustmentType, adjustmentValue: sale.adjustmentValue, discountAmount: sale.discountAmount, createdAt: sale.createdAt });

// Dueño de la carpeta: 404 si no existe o no es suya (no se distingue para no revelar carpetas ajenas)
const ownedFolder = async (req, folderId) => {
  if (!isUuid(folderId)) return null;
  const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
  if (!user) return null;
  const folder = await prisma.folder.findUnique({ where: { id: folderId }, select: { id: true, name: true, userId: true } });
  return folder && folder.userId === user.id ? { user, folder } : null;
};

// Todas mis ventas presenciales (para el historial de ventas de la cuenta)
router.get('/api/in-person-sales/mine', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const sales = await prisma.inPersonSale.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: MINE_SHOWN });
    res.json({ success: true, sales: (await withImages(sales)).map(publicSale) });
  } catch (error) {
    console.error('Error cargando mis ventas presenciales:', error.message);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.get('/api/folders/:id/in-person-sales', authenticateToken, async (req, res) => {
  try {
    const owned = await ownedFolder(req, req.params.id);
    if (!owned) return res.status(404).json({ success: false, message: 'Carpeta no encontrada' });
    const sales = await prisma.inPersonSale.findMany({ where: { userId: owned.user.id, folderId: owned.folder.id }, orderBy: { createdAt: 'desc' }, take: HISTORY_SHOWN });
    res.json({ success: true, sales: (await withImages(sales)).map(publicSale) });
  } catch (error) {
    console.error('Error cargando ventas presenciales:', error.message);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Cuerpo: { requestId, items: [{ cardId, quantity }], adjustment }. Precios publicados, totales y stock se resuelven en el servidor.
router.post('/api/folders/:id/in-person-sales', authenticateToken, async (req, res) => {
  try {
    const owned = await ownedFolder(req, req.params.id);
    if (!owned) return res.status(404).json({ success: false, message: 'Carpeta no encontrada' });

    const { requestId, items, adjustment = { type: 'none', value: 0 } } = req.body || {};
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) return badRequest(res, 'Solicitud inválida');
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_LINES) return badRequest(res, 'Elige entre 1 y ' + MAX_LINES + ' cartas');
    if (!adjustment || !['none', 'fixed', 'percent'].includes(adjustment.type) || typeof adjustment.value !== 'number' || !Number.isFinite(adjustment.value)) return badRequest(res, 'Ajuste inválido');
    if ((adjustment.type === 'none' && adjustment.value !== 0) || (adjustment.type === 'fixed' && (!Number.isInteger(adjustment.value) || adjustment.value < 0 || adjustment.value > MAX_PRICE)) || (adjustment.type === 'percent' && (adjustment.value < 0 || adjustment.value > 100 || Math.round(adjustment.value * 100) !== adjustment.value * 100))) return badRequest(res, 'Ajuste inválido');
    const lines = [];
    const seen = new Set();
    for (const item of items) {
      const quantity = item?.quantity;
      if (typeof item?.cardId !== 'string' || !isUuid(item.cardId) || seen.has(item.cardId)) return badRequest(res, 'Carta inválida');
      if (typeof quantity !== 'number') return badRequest(res, 'Cantidad inválida');
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) return badRequest(res, 'Cantidad inválida');
      seen.add(item.cardId);
      lines.push({ cardId: item.cardId, quantity });
    }

    const sale = await prisma.$transaction(async (tx) => {
      // El mismo envío repetido (doble clic, reintento) devuelve la venta ya registrada sin tocar el stock otra vez
      const previous = await tx.inPersonSale.findUnique({ where: { userId_requestId: { userId: owned.user.id, requestId } } });
      if (previous) return { sale: previous, duplicate: true };

      const cards = await tx.card.findMany({ where: { id: { in: lines.map((line) => line.cardId) }, folderId: owned.folder.id }, select: { id: true, name: true, tcgId: true, price: true, language: true, imageUrl: true } });
      if (cards.length !== lines.length) throw Object.assign(new Error('Carta no encontrada'), { status: 400 });
      const byId = new Map(cards.map((card) => [card.id, card]));

      const sold = [];
      for (const line of lines) {
        const card = byId.get(line.cardId);
        const unitPrice = card.price;
        if (unitPrice === null || unitPrice === undefined || !Number.isInteger(Number(unitPrice)) || Number(unitPrice) < 0 || Number(unitPrice) > MAX_PRICE) throw Object.assign(new Error('Falta un precio publicado válido para ' + card.name), { status: 400, exposeMessage: true });
        // Baja el stock solo si alcanza: sin dos ventas simultáneas de la última unidad
        const updated = await tx.card.updateMany({ where: { id: card.id, folderId: owned.folder.id, stock: { gte: line.quantity } }, data: { stock: { decrement: line.quantity } } });
        if (updated.count === 0) throw Object.assign(new Error('No queda stock suficiente de ' + card.name), { status: 409, exposeMessage: true });
        const tcg = owned.folder.tcg;
        sold.push({ cardId: card.id, tcgId: card.tcgId, tcg, name: card.name, language: card.language, imageUrl: card.imageUrl, quantity: line.quantity, unitPrice: Number(unitPrice) });
      }
      const units = sold.reduce((sum, line) => sum + line.quantity, 0);
      const subtotal = sold.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
      const discountAmount = adjustment.type === 'fixed' ? subtotal - adjustment.value : adjustment.type === 'percent' ? Math.round(subtotal * adjustment.value / 100) : 0;
      if (adjustment.type === 'fixed' && (adjustment.value < 0 || adjustment.value > MAX_PRICE)) throw Object.assign(new Error('Monto final inválido'), { status: 400, exposeMessage: true });
      if (adjustment.type === 'percent' && (discountAmount < 0 || discountAmount > subtotal)) throw Object.assign(new Error('Descuento inválido'), { status: 400, exposeMessage: true });
      const total = adjustment.type === 'fixed' ? adjustment.value : subtotal - discountAmount;
      const created = await tx.inPersonSale.create({ data: { userId: owned.user.id, folderId: owned.folder.id, folderName: owned.folder.name, requestId, items: sold, units, subtotal, adjustmentType: adjustment.type, adjustmentValue: adjustment.value, discountAmount, total } });
      return { sale: created, duplicate: false };
    });

    const stocks = Object.fromEntries((await prisma.card.findMany({ where: { id: { in: lines.map((line) => line.cardId) }, folderId: owned.folder.id }, select: { id: true, stock: true } })).map((card) => [card.id, card.stock]));
    res.status(sale.duplicate ? 200 : 201).json({ success: true, duplicate: sale.duplicate, sale: publicSale(sale.sale), stocks });
  } catch (error) {
    // Dos envíos iguales a la vez: el segundo choca con el índice único y se responde con la venta del primero
    if (error?.code === 'P2002') {
      const owned = await ownedFolder(req, req.params.id).catch(() => null);
      const existing = owned ? await prisma.inPersonSale.findUnique({ where: { userId_requestId: { userId: owned.user.id, requestId: String(req.body?.requestId) } } }).catch(() => null) : null;
      if (existing) return res.json({ success: true, duplicate: true, sale: publicSale(existing), stocks: {} });
    }
    if (error?.status && error.status < 500) return res.status(error.status).json({ success: false, message: error.exposeMessage ? error.message : 'No se pudo registrar la venta' });
    console.error('Error registrando venta presencial:', error.message);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
