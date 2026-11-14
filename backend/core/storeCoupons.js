// Cupones de tiendas: validación al crearlos y cálculo del descuento (siempre en el servidor).
const CODE_RE = /^[A-Z0-9]{3,20}$/;
const CLOSED_ORDER = ['rejected', 'cancelled', 'expired'];
export const MAX_COUPONS = 30;

export const normalizeCode = (value) => String(value || '').trim().toUpperCase();

const optDate = (value) => {
  if (value === undefined || value === null || value === '') return { ok: true, value: null };
  if (typeof value !== 'string' || value.length > 40) return { ok: false };
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? { ok: false } : { ok: true, value: d };
};

export const parseCoupon = (body) => {
  const fail = (error) => ({ ok: false, error });
  if (!body || typeof body !== 'object') return fail('Datos del cupón inválidos.');
  const code = normalizeCode(body.code);
  if (!CODE_RE.test(code)) return fail('El código debe tener de 3 a 20 letras o números, sin espacios.');
  if (!['percent', 'fixed'].includes(body.kind)) return fail('Elige descuento en porcentaje o monto fijo.');
  const value = Number(body.value);
  if (!Number.isInteger(value) || value < 1 || (body.kind === 'percent' ? value > 90 : value > 1000000)) return fail(body.kind === 'percent' ? 'El porcentaje debe ser entre 1 y 90.' : 'El monto debe ser entre $1 y $1.000.000.');
  const minTotal = body.minTotal === undefined || body.minTotal === '' ? 0 : Number(body.minTotal);
  if (!Number.isInteger(minTotal) || minTotal < 0 || minTotal > 100000000) return fail('Compra mínima inválida.');
  const startsAt = optDate(body.startsAt);
  const endsAt = optDate(body.endsAt);
  if (!startsAt.ok || !endsAt.ok || (startsAt.value && endsAt.value && endsAt.value <= startsAt.value)) return fail('Fechas de vigencia inválidas.');
  const maxUses = body.maxUses === undefined || body.maxUses === null || body.maxUses === '' ? null : Number(body.maxUses);
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000)) return fail('Usos máximos inválidos.');
  const maxPerUser = body.maxPerUser === undefined || body.maxPerUser === '' ? 1 : Number(body.maxPerUser);
  if (!Number.isInteger(maxPerUser) || maxPerUser < 1 || maxPerUser > 100) return fail('Usos por persona inválidos.');
  return { ok: true, data: { code, kind: body.kind, value, minTotal, startsAt: startsAt.value, endsAt: endsAt.value, maxUses, maxPerUser, active: body.active !== false } };
};

// Descuento en pesos para un total (nunca más que el total)
export const discountFor = (coupon, total) => {
  const amount = coupon.kind === 'percent' ? Math.round(total * coupon.value / 100) : coupon.value;
  return Math.max(0, Math.min(Math.round(total), amount));
};

// ¿Se puede usar? usesAll/usesMine: usos vigentes (de pedidos no cerrados sin venta)
export const couponProblem = (coupon, { total, now = new Date(), usesAll = 0, usesMine = 0 }) => {
  if (!coupon || !coupon.active) return 'Ese cupón no existe o no está activo.';
  if (coupon.startsAt && now < coupon.startsAt) return 'Ese cupón todavía no está vigente.';
  if (coupon.endsAt && now > coupon.endsAt) return 'Ese cupón ya venció.';
  if (total < coupon.minTotal) return `Ese cupón requiere una compra mínima de $${coupon.minTotal.toLocaleString('es-CL')}.`;
  if (coupon.maxUses !== null && coupon.maxUses !== undefined && usesAll >= coupon.maxUses) return 'Ese cupón ya no tiene usos disponibles.';
  if (usesMine >= coupon.maxPerUser) return 'Ya usaste este cupón.';
  return null;
};

// Usos que cuentan: los de pedidos que no terminaron rechazados, cancelados o vencidos
export const countCouponUses = async (db, couponId, userId) => {
  const uses = await db.storeCouponUse.findMany({ where: { couponId }, select: { userId: true, orderId: true } });
  if (!uses.length) return { usesAll: 0, usesMine: 0 };
  const live = new Set((await db.order.findMany({ where: { id: { in: uses.map((u) => u.orderId) }, status: { notIn: CLOSED_ORDER } }, select: { id: true } })).map((o) => o.id));
  const counted = uses.filter((u) => live.has(u.orderId));
  return { usesAll: counted.length, usesMine: counted.filter((u) => u.userId === userId).length };
};
