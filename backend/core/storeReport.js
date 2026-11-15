// Informe de ventas (CSV) y resumen semanal de las tiendas.
import { prisma } from './db.js';
import { getEffectivePlan } from './entitlements.js';
import { addStoreTask, notifyUsers } from './storeNotices.js';
import { formatClp } from './storeFormat.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 24 * 60 * 60 * 1000;
const PAYMENT = { cash: 'Efectivo', transfer: 'Transferencia', debit: 'Débito', credit: 'Crédito', '': 'Sin indicar' };
const VIA = { pickup: 'Retiro en tienda', message: 'Mensaje', '': 'WhatsApp' };

// Fechas en hora de Chile (desde el inicio de `from` hasta el final de `to`); máximo 366 días
export const parseReportRange = (from, to) => {
  if (typeof from !== 'string' || typeof to !== 'string' || !DATE_RE.test(from) || !DATE_RE.test(to)) return null;
  const start = new Date(`${from}T00:00:00-03:00`);
  const end = new Date(new Date(`${to}T00:00:00-03:00`).getTime() + DAY);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || end - start > 367 * DAY) return null;
  return { start, end };
};

// Un texto que empieza con = + - @ se interpretaría como fórmula en una planilla: se antepone una comilla
const cell = (value) => {
  let text = String(value ?? '').replace(/[\r\n]+/g, ' ');
  if (/^[=+\-@\t]/.test(text)) text = "'" + text;
  return /[",;]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};
const when = (d) => new Date(d).toLocaleString('es-CL', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const lines = (items) => (Array.isArray(items) ? items : []).map((i) => `${i.quantity || 1}x ${i.name}`).join(' | ');

export const buildSalesCsv = (sales, orders) => {
  const rows = [['Fecha', 'Tipo', 'Código', 'Carpeta', 'Medio de pago', 'Cartas', 'Unidades', 'Descuento', 'Total (CLP)', 'Detalle']];
  for (const s of sales) rows.push([when(s.createdAt), 'Venta en persona', '', s.folderName, PAYMENT[s.paymentMethod] ?? s.paymentMethod, (Array.isArray(s.items) ? s.items.length : 0), s.units, Math.round(s.discountAmount || 0), Math.round(s.total), lines(s.items)]);
  for (const o of orders) rows.push([when(o.updatedAt), `Pedido (${VIA[o.via] ?? o.via})`, o.code || '', o.folderName, o.couponCode ? `Cupón ${o.couponCode}` : '', (Array.isArray(o.items) ? o.items.length : 0), (Array.isArray(o.items) ? o.items : []).reduce((n, i) => n + Number(i.quantity || 1), 0), o.discountClp || 0, Math.round(o.total), lines(o.items)]);
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
};

// ---------- Resumen semanal (lunes desde las 9:00, hora de Chile) ----------
const chileClock = (date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Santiago', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date).map((x) => [x.type, x.value]));
  return { weekday: p.weekday, hour: Number(p.hour) };
};
export const isSummaryTime = (date) => {
  const c = chileClock(date);
  return c.weekday === 'Mon' && c.hour >= 9;
};

export const weeklyStats = async (storeId, now = new Date()) => {
  const since = new Date(now.getTime() - 7 * DAY);
  const [sales, orders, pickups, followers, events, buys, folders] = await Promise.all([
    prisma.inPersonSale.aggregate({ where: { userId: storeId, createdAt: { gte: since } }, _sum: { total: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { sellerId: storeId, status: 'completed', updatedAt: { gte: since } }, _sum: { total: true }, _count: { _all: true } }),
    prisma.order.count({ where: { sellerId: storeId, via: 'pickup', createdAt: { gte: since } } }),
    prisma.storeFollow.count({ where: { storeId, createdAt: { gte: since } } }),
    prisma.storeEvent.count({ where: { storeId, status: 'scheduled', startsAt: { gte: now, lt: new Date(now.getTime() + 7 * DAY) } } }),
    prisma.storeBuyRequest.count({ where: { storeId, createdAt: { gte: since } } }),
    prisma.folder.aggregate({ where: { userId: storeId }, _sum: { weeklyVisits: true } })
  ]);
  return {
    visits: folders._sum.weeklyVisits || 0,
    salesTotal: Math.round((sales._sum.total || 0) + (orders._sum.total || 0)),
    salesCount: sales._count._all + orders._count._all,
    pickups, followers, events, buys
  };
};

export const summaryText = (s) => `Tus últimos 7 días: ${s.salesCount} ventas por ${formatClp(s.salesTotal)}, ${s.visits} visitas a tus carpetas, ${s.pickups} reservas para retirar, ${s.followers} seguidores nuevos y ${s.buys} colecciones ofrecidas. Esta semana tienes ${s.events} eventos programados.`;

export const runWeeklySummaries = async (now = new Date(), { force = false } = {}) => {
  if (!force && !isSummaryTime(now)) return { sent: 0 };
  const since = new Date(now.getTime() - 6 * DAY);
  const profiles = await prisma.storeProfile.findMany({ where: { OR: [{ lastSummaryAt: null }, { lastSummaryAt: { lt: since } }] }, select: { userId: true }, take: 500 });
  let sent = 0;
  for (const { userId } of profiles) {
    if (!(await getEffectivePlan(prisma, userId)).plan.storeTools) continue;
    const claimed = await prisma.storeProfile.updateMany({ where: { userId, OR: [{ lastSummaryAt: null }, { lastSummaryAt: { lt: since } }] }, data: { lastSummaryAt: now } });
    if (!claimed.count) continue;
    const stats = await weeklyStats(userId, now);
    sent += await notifyUsers([userId], { subject: `Tu semana en Carpetazo: ${formatClp(stats.salesTotal)} en ventas`, title: 'Resumen semanal de tu tienda', intro: summaryText(stats), url: '/dashboard?tab=tienda', tag: 'store-weekly', cta: 'Ver mi tienda' });
  }
  return { sent };
};
addStoreTask(runWeeklySummaries);
