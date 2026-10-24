// Exportar mi inventario (CSV): las cartas de mis carpetas, todas o de una. Es una función de plan (Raro en adelante).
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { PlanLimitError, assertFeature, getEffectivePlan, sendPlanError } from '../core/entitlements.js';
import { isUuid } from '../core/validation.js';

const router = express.Router();
const MAX_ROWS = 50000;

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
    const cards = await prisma.card.findMany({ where: { folderId: { in: folders.map((folder) => folder.id) } }, orderBy: [{ folderId: 'asc' }, { name: 'asc' }], take: MAX_ROWS, select: { folderId: true, name: true, language: true, price: true, stock: true, tcgId: true } });
    const rows = [['Carpeta', 'Juego', 'Carta', 'Idioma', 'Precio (CLP)', 'Stock', 'Código'], ...cards.map((card) => {
      const folder = byId.get(card.folderId);
      return [folder.name, folder.tcg, card.name, card.language, card.price ?? '', card.stock, card.tcgId];
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
