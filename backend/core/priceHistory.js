// Historial de precios: cada pocas horas se guarda el precio más bajo publicado de cada carta con stock (uno por día; el último del día queda).
// No cuentan las publicaciones sospechosas (muy por debajo del precio de comparación y de una cuenta nueva): ver core/priceIntegrity.js.
import { prisma } from './db.js';
import { fairLowest, groupOffers, loadLiveOffers, marketAnchors } from './priceIntegrity.js';

const EVERY_MS = 3 * 60 * 60 * 1000;
const KEEP_DAYS = 400;
const CHUNK = 100;

// Fecha de hoy en Chile como día (sin hora)
const today = () => {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date()).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

export const recordPriceSnapshots = async () => {
  const groups = groupOffers(await loadLiveOffers());
  const market = await marketAnchors([...groups.values()].filter((offers) => offers[0].tcg === 'Pokemon').map((offers) => offers[0].tcgId));
  const day = today();
  const rows = [];
  for (const offers of groups.values()) {
    const { tcg, tcgId } = offers[0];
    const lowest = fairLowest(offers, tcg === 'Pokemon' ? market.get(tcgId) || null : null);
    if (lowest !== null) rows.push({ tcg, tcgId, lowest, offers: offers.length });
  }
  for (let at = 0; at < rows.length; at += CHUNK) {
    await prisma.$transaction(rows.slice(at, at + CHUNK).map((row) => prisma.cardPriceSnapshot.upsert({
      where: { tcg_tcgId_day: { tcg: row.tcg, tcgId: row.tcgId, day } },
      create: { ...row, day },
      update: { lowest: row.lowest, offers: row.offers }
    })));
  }
  await prisma.cardPriceSnapshot.deleteMany({ where: { day: { lt: new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000) } } });
  return rows.length;
};

let running = false;
export const startPriceHistory = () => {
  if (process.env.TEST_AUTH_STUB) return; // las pruebas lo ejecutan a mano
  const tick = async () => {
    if (running) return;
    running = true;
    try { await recordPriceSnapshots(); } catch (error) { console.error('Error guardando el historial de precios:', error.message); } finally { running = false; }
  };
  setTimeout(tick, 45 * 1000).unref();
  setInterval(tick, EVERY_MS).unref();
};
