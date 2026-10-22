// Integridad de precios: protege las estadísticas (precio de referencia, historial, últimas ventas) de la manipulación.
// Ataque que se evita: publicar una carta a $1 y "comprársela" desde otra cuenta para bajar el precio promedio.
//  1. Una venta solo cuenta si está cerca de lo que piden varios vendedores independientes (o del mercado de TCGplayer).
//  2. Una referencia se calcula con personas distintas: un valor por vendedor y al menos MIN_SELLERS vendedores y MIN_BUYERS compradores.
//  5. Una publicación muy por debajo del precio de una cuenta nueva no entra al "más barato", al historial ni a la referencia.
import { prisma } from './db.js';

export const LOW_RATIO = 0.25; // por debajo de este porcentaje del precio de comparación, un precio es sospechoso
export const HIGH_RATIO = 4; // por encima de este múltiplo, también
export const MIN_SELLERS = 3;
export const MIN_BUYERS = 3;
export const YOUNG_DAYS = 30; // una cuenta con menos días que estos es "nueva"
const DAY = 24 * 60 * 60 * 1000;

export const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const isYoung = (createdAt, now = Date.now()) => !createdAt || now - new Date(createdAt).getTime() < YOUNG_DAYS * DAY;

// Precio de comparación según lo que piden los vendedores: la mediana de un precio por vendedor (el más barato de cada uno). null si hay pocos vendedores.
export const offersAnchor = (offers, minSellers = MIN_SELLERS) => {
  const perSeller = new Map();
  for (const offer of offers) perSeller.set(offer.userId, Math.min(perSeller.get(offer.userId) ?? Infinity, offer.price));
  return perSeller.size >= minSellers ? median([...perSeller.values()]) : null;
};

// Publicaciones sospechosas: muy por debajo del precio de comparación y de una cuenta nueva.
// El precio de comparación es el de mercado externo (TCGplayer) si existe; si no, lo que piden OTROS al menos 2 vendedores.
export const suspiciousOffers = (offers, externalAnchor = null) => {
  const flagged = new Set();
  for (const offer of offers) {
    if (!isYoung(offer.sellerCreatedAt)) continue;
    const anchor = externalAnchor || offersAnchor(offers.filter((other) => other.userId !== offer.userId), 2);
    if (anchor && offer.price < anchor * LOW_RATIO) flagged.add(offer.cardId);
  }
  return flagged;
};

// Precio más bajo publicado sin contar las publicaciones sospechosas
export const fairLowest = (offers, externalAnchor = null) => {
  const flagged = suspiciousOffers(offers, externalAnchor);
  const fair = offers.filter((offer) => !flagged.has(offer.cardId));
  return fair.length ? Math.min(...fair.map((offer) => offer.price)) : null;
};

// Ofertas vigentes (carpetas públicas, con stock y precio) con la antigüedad de cada vendedor
export const loadLiveOffers = async ({ tcg = null, tcgIds = null } = {}) => {
  const cards = await prisma.card.findMany({
    where: {
      stock: { gt: 0 }, price: { gt: 0 }, moderationState: 'visible',
      ...(tcgIds ? { tcgId: { in: tcgIds } } : {}),
      folder: { isPublic: true, moderationState: 'visible', ...(tcg ? { tcg } : {}) }
    },
    select: { id: true, tcgId: true, price: true, folder: { select: { tcg: true, userId: true, user: { select: { createdAt: true } } } } }
  });
  return cards.map((card) => ({ cardId: card.id, tcgId: card.tcgId, tcg: card.folder.tcg, userId: card.folder.userId, price: card.price, sellerCreatedAt: card.folder.user?.createdAt || null }));
};

export const groupOffers = (offers) => {
  const groups = new Map();
  for (const offer of offers) {
    const key = `${offer.tcg}|${offer.tcgId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(offer);
  }
  return groups;
};

// Precio de mercado de TCGplayer (en pesos) más reciente de cada carta (los últimos 7 días); referencia externa que nadie puede manipular desde Carpetazo
export const marketAnchors = async (tcgIds) => {
  if (!tcgIds.length) return new Map();
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT ON ("tcgId") "tcgId", "clp"
    FROM "CardMarketSnapshot"
    WHERE "tcgId" = ANY(${tcgIds}) AND "day" >= (now() - interval '7 days')::date
    ORDER BY "tcgId", "day" DESC`;
  return new Map(rows.map((row) => [row.tcgId, Number(row.clp)]));
};

// Líneas de pedidos completados: precio, cantidad, y quién vendió y quién compró (con la antigüedad de cada cuenta)
export const loadSales = async ({ tcg = null, tcgIds = null, days = 180 } = {}) => {
  const rows = await prisma.$queryRaw`
    SELECT s.*
    FROM (
      SELECT o."id" AS "orderId", o."sellerId", o."buyerId", o."buyerName", o."createdIpHash", o."completedIpHash", o."updatedAt" AS "at",
             (line->>'price')::float AS "unit",
             CASE WHEN line->>'quantity' ~ '^[0-9]{1,4}$' THEN (line->>'quantity')::int ELSE 1 END AS "quantity",
             COALESCE(line->>'tcgId', c."tcgId") AS "tcgId", f."tcg",
             su."createdAt" AS "sellerCreatedAt", bu."createdAt" AS "buyerCreatedAt"
      FROM "Order" o
      JOIN "Folder" f ON f."id" = o."folderId"
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o."items"::jsonb) = 'array' THEN o."items"::jsonb ELSE '[]'::jsonb END) AS line
      LEFT JOIN "Card" c ON c."id" = line->>'id'
      LEFT JOIN "User" su ON su."id" = o."sellerId"
      LEFT JOIN "User" bu ON bu."id" = o."buyerId"
      WHERE o."status" = 'completed' AND o."updatedAt" > now() - make_interval(days => ${days}::int) AND line->>'price' ~ '^[0-9]+(\\.[0-9]+)?$'
    ) s
    WHERE s."unit" > 0 AND (${tcg}::text IS NULL OR s."tcg" = ${tcg}) AND (${tcgIds}::text[] IS NULL OR s."tcgId" = ANY(${tcgIds}))`;
  return rows.map((row) => ({ ...row, unit: Number(row.unit), buyerKey: row.buyerId || (row.createdIpHash ? `ip:${row.createdIpHash}` : `name:${String(row.buyerName || '').toLowerCase()}`) }));
};

// Ventas presenciales declaradas por el vendedor. Solo conserva precios publicados por línea;
// no tiene comprador verificado y por eso se usa como señal separada, nunca en «Últimas ventas».
export const loadInPersonPriceSignals = async ({ tcg = null, tcgIds = null, days = 180 } = {}) => {
  const rows = await prisma.$queryRaw`
    SELECT s."userId" AS "sellerId", s."createdAt" AS "at",
           (line->>'unitPrice')::float AS "unit",
           CASE WHEN line->>'quantity' ~ '^[0-9]{1,4}$' THEN (line->>'quantity')::int ELSE 1 END AS "quantity",
           line->>'tcgId' AS "tcgId", line->>'tcg' AS "tcg",
           u."createdAt" AS "sellerCreatedAt"
    FROM "InPersonSale" s
    LEFT JOIN "User" u ON u."id" = s."userId"
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s."items"::jsonb) = 'array' THEN s."items"::jsonb ELSE '[]'::jsonb END) AS line
    WHERE s."createdAt" > now() - make_interval(days => ${days}::int)
      AND line->>'unitPrice' ~ '^[0-9]+(\\.[0-9]+)?$'
      AND line->>'tcg' IS NOT NULL
      AND (${tcg}::text IS NULL OR line->>'tcg' = ${tcg})
      AND (${tcgIds}::text[] IS NULL OR line->>'tcgId' = ANY(${tcgIds}))`;
  return rows.map((row) => ({ ...row, unit: Number(row.unit), quantity: Number(row.quantity) || 1, inPerson: true }));
};

// Pedido creado (comprador) y confirmado (vendedor) desde la misma conexión: es una señal de autoventa, no una prueba (en una feria
// ambos pueden compartir WiFi). Solo se usa para el precio de referencia; el pedido, el stock y «Últimas ventas» no cambian.
export const sameConnection = (sale) => Boolean(sale.createdIpHash && sale.completedIpHash && sale.createdIpHash === sale.completedIpHash);

// Ventas visibles: nunca la propia, y con anclaje solo las que están en un rango razonable
export const eligibleSales = (sales, anchor) => {
  const others = sales.filter((sale) => !sale.buyerId || sale.buyerId !== sale.sellerId);
  return anchor ? others.filter((sale) => sale.unit >= anchor * LOW_RATIO && sale.unit <= anchor * HIGH_RATIO) : others;
};

// Ventas que pueden fijar el precio de referencia: las visibles, menos las de la misma conexión
export const referenceSales = (sales, anchor) => eligibleSales(sales.filter((sale) => !sameConnection(sale)), anchor);

// Precio de referencia a partir de ventas: un valor por vendedor, mínimo MIN_SELLERS vendedores y MIN_BUYERS compradores distintos
export const referenceFromSales = (sales) => {
  const summarize = (list) => {
    const perSeller = new Map();
    for (const sale of list) perSeller.set(sale.sellerId, [...(perSeller.get(sale.sellerId) || []), sale.unit]);
    return { perSeller, value: median([...perSeller.values()].map((prices) => median(prices))) };
  };
  const counts = (list) => ({ sellers: new Set(list.map((sale) => sale.sellerId)).size, buyers: new Set(list.map((sale) => sale.buyerKey)).size });
  let list = sales;
  if (counts(list).sellers < MIN_SELLERS || counts(list).buyers < MIN_BUYERS) return null;
  // Sin un precio externo de comparación, se descartan las ventas que se alejan mucho de la mediana del propio grupo
  const first = summarize(list).value;
  list = list.filter((sale) => sale.unit >= first * LOW_RATIO && sale.unit <= first * HIGH_RATIO);
  const { sellers, buyers } = counts(list);
  if (sellers < MIN_SELLERS || buyers < MIN_BUYERS) return null;
  return { value: summarize(list).value, sales: list.length, sellers, buyers };
};
