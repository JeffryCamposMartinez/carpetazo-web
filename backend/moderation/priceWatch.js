// Vigilancia de precios: avisa al equipo de moderación (reportes automáticos) de posibles manipulaciones de precios.
//  - Publicaciones muy por debajo del precio de comparación de una cuenta nueva.
//  - Dos o más ventas muy por debajo del precio de comparación entre el mismo par de cuentas, o con una cuenta nueva.
// No sanciona ni oculta nada: solo deja el caso en la cola para que una persona lo revise.
import { LOW_RATIO, groupOffers, isYoung, loadLiveOffers, loadSales, marketAnchors, offersAnchor, suspiciousOffers } from '../core/priceIntegrity.js';
import { moderationHooks } from './services.js';

const EVERY_MS = 3 * 60 * 60 * 1000;
const SALES_DAYS = 30;
const MAX_REPORTS_PER_RUN = 50; // tope por pasada: un ataque masivo no inunda la cola
const MIN_LOW_SALES = 2;

export const runPriceWatch = async () => {
  const flag = (args) => moderationHooks.flagPrice?.(args);
  let created = 0;
  const groups = groupOffers(await loadLiveOffers());
  const market = await marketAnchors([...groups.values()].filter((offers) => offers[0].tcg === 'Pokemon').map((offers) => offers[0].tcgId));
  const anchorOf = (tcg, tcgId) => (tcg === 'Pokemon' ? market.get(tcgId) : null) || offersAnchor(groups.get(`${tcg}|${tcgId}`) || []);

  // 1) Publicaciones sospechosas
  for (const offers of groups.values()) {
    if (created >= MAX_REPORTS_PER_RUN) break;
    const { tcg, tcgId } = offers[0];
    for (const cardId of suspiciousOffers(offers, tcg === 'Pokemon' ? market.get(tcgId) || null : null)) {
      if (created >= MAX_REPORTS_PER_RUN) break;
      const offer = offers.find((item) => item.cardId === cardId);
      if (await flag({ targetType: 'card', targetId: cardId, reasonCode: 'auto.price_listing', context: `precio ${Math.round(offer.price)} frente a ${Math.round(anchorOf(tcg, tcgId))} de referencia` })) created += 1;
    }
  }

  // 2) Ventas muy baratas entre el mismo par de cuentas o con cuentas nuevas
  const low = [];
  for (const sale of await loadSales({ days: SALES_DAYS })) {
    if (sale.buyerId && sale.buyerId === sale.sellerId) continue;
    const anchor = anchorOf(sale.tcg, sale.tcgId);
    if (anchor && sale.unit < anchor * LOW_RATIO) low.push(sale);
  }
  const bySeller = new Map();
  for (const sale of low) bySeller.set(sale.sellerId, [...(bySeller.get(sale.sellerId) || []), sale]);
  for (const [sellerId, sales] of bySeller) {
    if (created >= MAX_REPORTS_PER_RUN) break;
    const pairs = new Map();
    for (const sale of sales) pairs.set(sale.buyerKey, (pairs.get(sale.buyerKey) || 0) + 1);
    const samePair = [...pairs.values()].some((count) => count >= MIN_LOW_SALES);
    const withNewAccounts = sales.filter((sale) => isYoung(sale.sellerCreatedAt) || (sale.buyerId && isYoung(sale.buyerCreatedAt))).length >= MIN_LOW_SALES;
    if (!samePair && !withNewAccounts) continue;
    if (await flag({ targetType: 'user', targetId: sellerId, reasonCode: 'auto.price_manipulation', context: `${sales.length} venta(s) en ${SALES_DAYS} días por debajo del ${Math.round(LOW_RATIO * 100)}% del precio de referencia (${samePair ? 'mismo comprador' : 'cuentas nuevas'})` })) created += 1;
  }
  return created;
};

let running = false;
export const startPriceWatch = () => {
  if (process.env.TEST_AUTH_STUB) return; // las pruebas lo ejecutan a mano
  const tick = async () => {
    if (running) return;
    running = true;
    try { const created = await runPriceWatch(); if (created) console.log(`Vigilancia de precios: ${created} reporte(s) automático(s)`); } catch (error) { console.error('Error en la vigilancia de precios:', error.message); } finally { running = false; }
  };
  setTimeout(tick, 2 * 60 * 1000).unref();
  setInterval(tick, EVERY_MS).unref();
};
