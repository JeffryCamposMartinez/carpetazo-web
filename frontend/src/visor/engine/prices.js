// Precios de mercado de TCGplayer vía el proxy público de Carpetazo (/api/tcgcsv/...). El productId del catálogo ES el de TCGplayer.
// Un archivo por edición: se guarda en memoria por (juego, edición) y se comparte entre todas las cartas de esa edición.
const groups = new Map(); // "cat/group" → Promise<Map<productId, {name,low,market,high}[]>>
let rate = null;

const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);

export const loadGroupPrices = (categoryId, groupId, { apiBase = '/api', fetchImpl = (...a) => fetch(...a) } = {}) => {
  if (!Number.isInteger(Number(categoryId)) || !Number.isInteger(Number(groupId))) return Promise.resolve(new Map());
  const key = `${categoryId}/${groupId}`;
  if (!groups.has(key)) {
    groups.set(key, (async () => {
      const res = await fetchImpl(`${apiBase}/tcgcsv/tcgplayer/${categoryId}/${groupId}/prices`);
      if (!res.ok) throw new Error(`precios ${res.status}`);
      const out = new Map();
      for (const r of (await res.json()).results || []) {
        const row = { name: r.subTypeName || 'Normal', low: num(r.lowPrice), market: num(r.marketPrice ?? r.midPrice), high: num(r.highPrice) };
        if (row.market || row.low) (out.get(String(r.productId)) || out.set(String(r.productId), []).get(String(r.productId))).push(row);
      }
      return out;
    })().catch((e) => { groups.delete(key); throw e; })); // un fallo no se cachea
  }
  return groups.get(key);
};

/** Precios (por acabado) de una carta del paquete, o null si TCGplayer no tiene datos. */
export const loadCardPrices = async (meta, opts) => (await loadGroupPrices(meta.categoryId, meta.groupId, opts)).get(String(meta.productId)) || null;

export const loadUsdClp = async ({ apiBase = '/api', fetchImpl = (...a) => fetch(...a) } = {}) => {
  if (rate) return rate;
  try { const r = await (await fetchImpl(`${apiBase}/usd-clp`)).json(); rate = num(r.rate); } catch { rate = null; }
  return rate;
};

export const usd = (n) => `US$${n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString('en-US')}`;
export const clp = (n) => `$${Math.round(n).toLocaleString('es-CL')}`;
