import { apiUrl } from './api';

// Precios de mercado de TCGCSV (TCGplayer, en USD) por edición, y el dólar en pesos para mostrarlos como referencia.

const groupPricesCache = new Map();
let rateCache = null;

// Una carta puede tener varios acabados (Normal, Holofoil…): cada uno con su precio de mercado
const toVariants = (rows) => rows
  .map((row) => ({ name: row.subTypeName || 'Normal', usd: Number(row.marketPrice ?? row.midPrice) }))
  .filter((variant) => Number.isFinite(variant.usd) && variant.usd > 0)
  .sort((a, b) => a.usd - b.usd);

// Filas de precios de una edición agrupadas por producto (se piden una sola vez)
const fetchGroupRows = (catId, groupId, signal) => {
  const key = `${catId}-${groupId}`;
  if (!groupPricesCache.has(key)) {
    const request = fetch(apiUrl(`/tcgcsv/tcgplayer/${catId}/${groupId}/prices`), { signal })
      .then((response) => (response.ok ? response.json() : { results: [] }))
      .then((json) => {
        const byProduct = new Map();
        (json.results || []).forEach((row) => {
          const id = String(row.productId);
          byProduct.set(id, [...(byProduct.get(id) || []), row]);
        });
        return byProduct;
      });
    // Si falla o se cancela, no se guarda para poder reintentar
    request.catch(() => groupPricesCache.delete(key));
    groupPricesCache.set(key, request);
  }
  return groupPricesCache.get(key);
};

// Mapa productId -> acabados con precio de mercado, para toda una edición
export const fetchGroupPrices = (catId, groupId, signal) => fetchGroupRows(catId, groupId, signal)
  .then((byProduct) => new Map([...byProduct].map(([id, rows]) => [id, toVariants(rows)])));

const positive = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null);

// Mínimo, mercado y máximo (USD) de cada acabado de una carta: productId -> [{ name, low, market, high }]
export const fetchCardPriceRanges = (catId, groupId, productId) => fetchGroupRows(catId, groupId)
  .then((byProduct) => (byProduct.get(String(productId)) || [])
    .map((row) => ({ name: row.subTypeName || 'Normal', low: positive(row.lowPrice), market: positive(row.marketPrice ?? row.midPrice), high: positive(row.highPrice) }))
    .filter((range) => range.market || range.low || range.high)
    .sort((a, b) => (a.market || a.low || 0) - (b.market || b.low || 0)));

export const fetchUsdClpRate = () => {
  if (!rateCache) {
    rateCache = fetch(apiUrl('/usd-clp'))
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => (Number(json?.rate) > 0 ? Number(json.rate) : null))
      .catch(() => null);
    rateCache.then((rate) => { if (!rate) rateCache = null; });
  }
  return rateCache;
};

// Pesos redondeados a la decena: es solo una referencia
export const usdToClp = (usd, rate) => (rate ? Math.max(10, Math.round((usd * rate) / 10) * 10) : null);
export const formatClp = (value) => `$${value.toLocaleString('es-CL')}`;
