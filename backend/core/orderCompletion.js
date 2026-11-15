// Confirmar un pedido pendiente (venta o retiro entregado): reclama el estado y descuenta el stock en la misma transacción.
// Dos clics simultáneos no descuentan dos veces: solo el que cambia el estado «pending» sigue. Devuelve el pedido actualizado o null.
import { isUuid } from './validation.js';

const quantityOf = (item) => {
  const q = Number(item?.quantity ?? item?.q ?? 1);
  return Number.isFinite(q) && q > 0 ? q : 1;
};

export const finishPendingOrder = (db, order, status, extra = {}) => db.$transaction(async (tx) => {
  const claimed = await tx.order.updateMany({ where: { id: order.id, status: 'pending' }, data: { status } });
  if (claimed.count === 0) return null;
  if (status === 'completed') {
    for (const item of Array.isArray(order.items) ? order.items : []) {
      const id = String(item?.id || '');
      if (!isUuid(id)) continue;
      const card = await tx.card.findFirst({ where: { id, folderId: order.folderId } });
      if (!card) continue;
      await tx.card.update({ where: { id }, data: { stock: Math.max(0, Number(card.stock || 0) - quantityOf(item)) } });
    }
  }
  return tx.order.update({ where: { id: order.id }, data: { status, ...extra } });
});
