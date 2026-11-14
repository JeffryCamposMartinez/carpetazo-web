// Reserva con retiro en tienda: código de retiro, plazo y vencimiento automático (libera el stock reservado).
import crypto from 'node:crypto';
import { prisma } from './db.js';
import { addStoreTask, notifyUsers } from './storeNotices.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para dictarlo en el mostrador
export const generatePickupCode = () => Array.from(crypto.randomBytes(6), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
export const pickupDeadline = (hours, now = new Date()) => new Date(now.getTime() + hours * 60 * 60 * 1000);

// Las reservas que pasan su plazo sin retirarse vencen: dejan de estar pendientes y su stock vuelve a estar disponible
export const runPickupExpiry = async (now = new Date()) => {
  const due = await prisma.order.findMany({ where: { via: 'pickup', status: 'pending', pickupBy: { lt: now } }, select: { id: true, code: true, buyerId: true, folderName: true }, take: 200 });
  let expired = 0;
  for (const order of due) {
    const claimed = await prisma.order.updateMany({ where: { id: order.id, status: 'pending' }, data: { status: 'expired' } });
    if (!claimed.count) continue;
    expired += 1;
    if (order.buyerId) await notifyUsers([order.buyerId], { subject: `Tu reserva ${order.code} venció`, title: 'Reserva vencida', intro: `Pasó el plazo para retirar tu reserva ${order.code} de «${order.folderName}». Las cartas volvieron a estar disponibles.`, url: '/dashboard?tab=tienda', tag: `pickup-${order.id}` });
  }
  return { expired };
};
addStoreTask(runPickupExpiry);
