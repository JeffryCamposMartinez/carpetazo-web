// Historial del precio de mercado de TCGplayer (vía TCGCSV) de las cartas de Pokémon que están a la venta: una vez al día, en pesos.
// Cada carta guarda el nombre de su edición; con él se busca la edición en TCGCSV y en ella el precio de mercado más bajo entre sus acabados.
import { prisma } from './db.js';

const TCGCSV = 'https://tcgcsv.com/tcgplayer';
const EVERY_MS = 6 * 60 * 60 * 1000;
const FETCH_MS = 25 * 1000;
const KEEP_DAYS = 400;
const isJapanese = (language) => /jap/i.test(language || '');

const fetchJson = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_MS), headers: { Accept: 'application/json', 'User-Agent': 'Carpetazo-PriceHistory/1.0' } });
  if (!response.ok) throw new Error(`${url} respondió ${response.status}`);
  return response.json();
};

let rateCache = null;
const usdClpRate = async () => {
  if (rateCache && Date.now() - rateCache.at < 60 * 60 * 1000) return rateCache.rate;
  const rate = Number((await fetchJson('https://open.er-api.com/v6/latest/USD'))?.rates?.CLP);
  if (!Number.isFinite(rate) || rate < 100 || rate > 5000) throw new Error('Respuesta de cambio inválida');
  rateCache = { at: Date.now(), rate };
  return rate;
};

// Fecha de hoy en Chile como día (sin hora)
const today = () => {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date()).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

export const recordMarketSnapshots = async () => {
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT c."tcgId" AS "tcgId", c."data"->>'set' AS "set", c."data"->>'language' AS "language"
    FROM "Card" c JOIN "Folder" f ON f."id" = c."folderId"
    WHERE f."tcg" = 'Pokemon' AND c."stock" > 0 AND c."moderationState" = 'visible' AND f."isPublic" = true AND f."moderationState" = 'visible'
      AND c."data"->>'set' IS NOT NULL AND c."tcgId" ~ '^[0-9]{1,12}$'`;
  if (!rows.length) return 0;
  const rate = await usdClpRate();
  const day = today();
  const groupIds = {};
  let saved = 0;
  // Las cartas se agrupan por categoría (inglés 3, japonés 85) y edición
  const bySet = new Map();
  for (const row of rows) {
    const cat = isJapanese(row.language) ? 85 : 3;
    const key = `${cat}|${row.set}`;
    if (!bySet.has(key)) bySet.set(key, { cat, set: row.set, ids: new Set() });
    bySet.get(key).ids.add(row.tcgId);
  }
  for (const { cat, set, ids } of bySet.values()) {
    try {
      if (!groupIds[cat]) groupIds[cat] = new Map((await fetchJson(`${TCGCSV}/${cat}/groups`)).results.map((group) => [group.name, group.groupId]));
      const groupId = groupIds[cat].get(set);
      if (!groupId) continue;
      const markets = new Map();
      for (const price of (await fetchJson(`${TCGCSV}/${cat}/${groupId}/prices`)).results || []) {
        if (!(price.marketPrice > 0)) continue;
        const current = markets.get(String(price.productId));
        if (current === undefined || price.marketPrice < current) markets.set(String(price.productId), price.marketPrice);
      }
      for (const tcgId of ids) {
        const usd = markets.get(tcgId);
        if (!usd) continue;
        const clp = Math.max(10, Math.round((usd * rate) / 10) * 10);
        await prisma.cardMarketSnapshot.upsert({ where: { tcgId_day: { tcgId, day } }, create: { tcgId, day, usd, clp }, update: { usd, clp } });
        saved += 1;
      }
    } catch (error) {
      console.error(`Error guardando precios de mercado de ${set}:`, error.message);
    }
  }
  await prisma.cardMarketSnapshot.deleteMany({ where: { day: { lt: new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000) } } });
  return saved;
};

let running = false;
export const startMarketPriceHistory = () => {
  if (process.env.TEST_AUTH_STUB) return; // las pruebas no llaman a servicios de afuera
  const tick = async () => {
    if (running) return;
    running = true;
    try { const saved = await recordMarketSnapshots(); if (saved) console.log(`Historial de mercado: ${saved} precio(s) guardado(s)`); } catch (error) { console.error('Error guardando el historial de mercado:', error.message); } finally { running = false; }
  };
  setTimeout(tick, 90 * 1000).unref();
  setInterval(tick, EVERY_MS).unref();
};
