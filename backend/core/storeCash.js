// Caja de las tiendas: totales por día (hora de Chile) y por medio de pago, a partir de ventas en persona y pedidos completados.
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' });
export const chileDay = (date) => dayFmt.format(new Date(date));
export const CASH_METHODS = ['cash', 'transfer', 'debit', 'credit', 'unspecified', 'orders'];

// sales: [{ total, paymentMethod, createdAt }] · orders: [{ total, updatedAt }] (completados)
export const summarizeCash = (sales, orders, days, now = new Date()) => {
  const out = new Map();
  for (let i = 0; i < days; i++) {
    const date = chileDay(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
    if (!out.has(date)) out.set(date, { date, total: 0, count: 0, byMethod: Object.fromEntries(CASH_METHODS.map((m) => [m, 0])) });
  }
  const add = (date, method, amount) => {
    const day = out.get(date);
    if (!day) return;
    const value = Math.round(Number(amount) || 0);
    day.total += value;
    day.count += 1;
    day.byMethod[method] += value;
  };
  for (const s of sales) add(chileDay(s.createdAt), CASH_METHODS.includes(s.paymentMethod) && s.paymentMethod !== 'orders' ? s.paymentMethod : 'unspecified', s.total);
  for (const o of orders) add(chileDay(o.updatedAt), 'orders', o.total);
  const list = [...out.values()];
  const totals = { total: 0, count: 0, byMethod: Object.fromEntries(CASH_METHODS.map((m) => [m, 0])) };
  for (const d of list) {
    totals.total += d.total;
    totals.count += d.count;
    for (const m of CASH_METHODS) totals.byMethod[m] += d.byMethod[m];
  }
  return { days: list, totals };
};
