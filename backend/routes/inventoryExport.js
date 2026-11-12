// Exportar mi inventario (CSV): las cartas de mis carpetas, todas o de una. Es una función de plan (Raro en adelante).
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { PlanLimitError, assertFeature, getEffectivePlan, sendPlanError } from '../core/entitlements.js';
import { isUuid } from '../core/validation.js';

const router = express.Router();
const MAX_ROWS = 50000;
const CONDITIONS = { 5: 'Near Mint', 4: 'Lightly Played', 3: 'Moderately Played', 2: 'Heavily Played', 1: 'Damaged' };

// Un texto que empieza con = + - @ se interpretaría como fórmula al abrirlo en una planilla: se antepone una comilla
const cell = (value) => {
  let text = String(value ?? '').replace(/[\r\n]+/g, ' ');
  if (/^[=+\-@\t]/.test(text)) text = "'" + text;
  return /[",;]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

router.get('/api/inventory/export', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    assertFeature((await getEffectivePlan(prisma, user.id)).plan, 'inventoryExport');

    const folderId = req.query.folderId;
    if (folderId !== undefined && (typeof folderId !== 'string' || !isUuid(folderId))) return res.status(404).json({ success: false, message: 'Carpeta no encontrada' });
    const folders = await prisma.folder.findMany({ where: { userId: user.id, ...(folderId ? { id: folderId } : {}) }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, tcg: true } });
    if (folderId && !folders.length) return res.status(404).json({ success: false, message: 'Carpeta no encontrada' });

    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const cards = await prisma.card.findMany({ where: { folderId: { in: folders.map((folder) => folder.id) } }, orderBy: [{ folderId: 'asc' }, { name: 'asc' }], take: MAX_ROWS, select: { folderId: true, name: true, language: true, condition: true, price: true, stock: true, tcgId: true, data: true } });
    // Edición, número y rareza salen del catálogo cuando la carta tiene su id (TCGplayer o Mitos y Leyendas)
    const productIds = [...new Set(cards.map((card) => (/^\d{1,9}$/.test(card.tcgId) ? Number(card.tcgId) : null)).filter(Boolean))];
    const mylIds = [...new Set(cards.map((card) => /^myl:(\d{1,9})$/.exec(card.tcgId)?.[1]).filter(Boolean))];
    const catalog = new Map();
    (productIds.length ? await prisma.catalogCard.findMany({ where: { productId: { in: productIds } }, select: { productId: true, number: true, rarity: true, set: { select: { name: true, abbreviation: true } } } }) : [])
      .forEach((row) => catalog.set(String(row.productId), { id: String(row.productId), number: row.number, rarity: row.rarity, set: row.set.name, code: row.set.abbreviation }));
    (mylIds.length ? await prisma.tcgProduct.findMany({ where: { productId: { in: mylIds }, categoryId: 99 }, select: { productId: true, extData: true, group: { select: { name: true } } } }) : [])
      .forEach((row) => {
        const field = (name) => (Array.isArray(row.extData) ? String(row.extData.find((entry) => entry?.name === name)?.value ?? '') : '');
        catalog.set('myl:' + row.productId, { id: row.productId, number: field('Number'), rarity: field('Frequency'), set: field('Edition') || row.group.name, code: '' });
      });
    // Mismas columnas que la exportación de TCGplayer, más «Precio (CLP)» y «Carpeta» (TCGplayer usa dólares) para poder volver a importar el archivo
    const rows = [['Quantity', 'Name', 'Simple Name', 'Set', 'Card Number', 'Set Code', 'Printing', 'Condition', 'Language', 'Rarity', 'Product ID', 'SKU', 'Precio (CLP)', 'Carpeta'], ...cards.map((card) => {
      const folder = byId.get(card.folderId);
      const found = catalog.get(card.tcgId);
      const info = card.data && typeof card.data === 'object' ? card.data : {};
      const rarity = found?.rarity || (info.rarity !== 'Unknown' ? info.rarity : '');
      return [card.stock, card.name, card.name.split(' - ')[0], found?.set || info.set || '', found?.number || info.number || '', found?.code || '', info.finish || 'Normal', CONDITIONS[card.condition] || 'Near Mint', card.language, rarity || '', found?.id || '', '', card.price ?? '', folder.name];
    })];
    const stamp = new Date().toISOString().slice(0, 10);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="carpetazo-inventario-${stamp}.csv"`, 'Cache-Control': 'no-store' });
    res.send('﻿' + rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n');
  } catch (error) {
    if (error instanceof PlanLimitError) return sendPlanError(res, error);
    console.error('Error exportando el inventario:', error.message);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
