// Señales de confianza de un vendedor, calculadas solo con datos reales de la plataforma.
import { prisma } from './db.js';
import { r2PublicUrl } from './tcgCatalogImport.js';
import { rawMylId, storedMylId } from './mylIdentity.js';

// Verificado: Moderación revisó el carnet y el rostro de la persona (routes/verification.js)
export const isVerifiedSeller = (user) => Boolean(user?.identityVerifiedAt);

// Tiempo de respuesta: se mira cada vez que alguien le escribió (sin otro mensaje en las 12 horas anteriores) y cuánto tardó el vendedor en contestar.
const WINDOW_DAYS = 90;
const SAMPLE_MAX = 400;
const REPLY_MAX_MS = 7 * 24 * 60 * 60 * 1000; // una respuesta después de 7 días ya no cuenta como respuesta
const GRACE_MS = 24 * 60 * 60 * 1000; // un mensaje de hace menos de un día aún puede estar esperando respuesta
const CONVERSATION_GAP_MS = 12 * 60 * 60 * 1000;
const MIN_ANSWERED = 3; // con menos conversaciones no se muestra: una sola respuesta rápida no dice nada
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map();

export const computeResponseStats = (incoming, now = Date.now()) => {
  const delays = [];
  let waiting = 0;
  for (const row of incoming) {
    const asked = new Date(row.createdAt).getTime();
    const replied = row.repliedAt ? new Date(row.repliedAt).getTime() : null;
    if (replied && replied - asked <= REPLY_MAX_MS) delays.push(Math.max(0, replied - asked));
    else if (now - asked >= GRACE_MS) waiting += 1; // sin respuesta a tiempo
  }
  if (delays.length < MIN_ANSWERED) return null;
  delays.sort((a, b) => a - b);
  const middle = Math.floor(delays.length / 2);
  const median = delays.length % 2 ? delays[middle] : (delays[middle - 1] + delays[middle]) / 2;
  return { medianMinutes: Math.max(1, Math.round(median / 60000)), answeredRate: Math.round((delays.length / (delays.length + waiting)) * 100) / 100, sample: delays.length + waiting };
};

export const getResponseStats = async (sellerId) => {
  const hit = cache.get(sellerId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw`
    SELECT m."createdAt" AS "createdAt",
           (SELECT MIN(r."createdAt") FROM "Message" r
             WHERE r."senderId" = ${sellerId} AND r."receiverId" = m."senderId" AND r."createdAt" > m."createdAt"
               -- la respuesta cuenta solo si llegó antes de que la misma persona volviera a escribir en otra consulta (más de 12 h después)
               AND r."createdAt" < COALESCE((SELECT MIN(n."createdAt") FROM "Message" n WHERE n."senderId" = m."senderId" AND n."receiverId" = ${sellerId} AND n."createdAt" > m."createdAt" + make_interval(secs => ${CONVERSATION_GAP_MS / 1000}::double precision)), 'infinity'::timestamp)) AS "repliedAt"
    FROM "Message" m
    WHERE m."receiverId" = ${sellerId} AND m."senderId" <> ${sellerId} AND m."moderationState" = 'visible' AND m."createdAt" > ${since}
      AND NOT EXISTS (
        SELECT 1 FROM "Message" p
        WHERE ((p."senderId" = m."senderId" AND p."receiverId" = ${sellerId}) OR (p."senderId" = ${sellerId} AND p."receiverId" = m."senderId"))
          AND p."createdAt" < m."createdAt" AND p."createdAt" > m."createdAt" - make_interval(secs => ${CONVERSATION_GAP_MS / 1000}::double precision)
      )
    ORDER BY m."createdAt" DESC
    LIMIT ${SAMPLE_MAX}`;
  const value = computeResponseStats(rows);
  cache.set(sellerId, { at: Date.now(), value });
  if (cache.size > 2000) cache.delete(cache.keys().next().value);
  return value;
};

export const clearResponseStatsCache = () => cache.clear();

// Ventas confirmadas (pedidos completados) del vendedor
export const getCompletedSales = (sellerId) => prisma.order.count({ where: { sellerId, status: 'completed' } });
// Historial público resumido: solo fecha y artículos vendidos, sin datos del comprador ni del pedido.
// Mezcla los pedidos confirmados con las ventas presenciales que el vendedor declaró (estas llevan `inPerson: true` para que se vean distinguidas).
export const getRecentCompletedSales = async (sellerId, take = 5) => {
  const [orders, inPerson] = await Promise.all([
    prisma.order.findMany({ where: { sellerId, status: 'completed' }, orderBy: { updatedAt: 'desc' }, take, select: { updatedAt: true, items: true } }),
    prisma.inPersonSale.findMany({ where: { userId: sellerId }, orderBy: { createdAt: 'desc' }, take, select: { createdAt: true, items: true } })
  ]);
  const sales = [
    ...orders.map((order) => ({ completedAt: order.updatedAt, inPerson: false, lines: Array.isArray(order.items) ? order.items : [] })),
    ...inPerson.map((sale) => ({ completedAt: sale.createdAt, inPerson: true, lines: (Array.isArray(sale.items) ? sale.items : []).map((line) => ({ ...line, id: line?.cardId })) }))
  ].sort((x, y) => new Date(y.completedAt) - new Date(x.completedAt)).slice(0, take);

  const lines = sales.flatMap((sale) => sale.lines);
  const cardIds = [...new Set(lines.map((item) => String(item?.id || '')).filter(Boolean))];
  const cards = cardIds.length
    ? await prisma.card.findMany({ where: { id: { in: cardIds } }, select: { id: true, imageUrl: true, data: true } })
    : [];
  const images = new Map(cards.filter((card) => card.imageUrl).map((card) => [card.id, card.imageUrl]));
  const finishes = new Map(cards.map((card) => [card.id, card.data && typeof card.data === 'object' && typeof card.data.finish === 'string' ? card.data.finish.slice(0, 40) : '']));

  // Si la carta ya no está en la carpeta (se agotó y se quitó), se busca su imagen por su identificador en otras cartas o en el catálogo
  const lost = lines.filter((item) => !images.has(String(item?.id || '')) && !item?.imageUrl && typeof item?.tcgId === 'string' && item.tcgId);
  const byTcgId = new Map();
  if (lost.length) {
    const tcgIds = [...new Set(lost.map((item) => item.tcgId))].slice(0, 60);
    const twins = await prisma.card.findMany({ where: { tcgId: { in: tcgIds }, imageUrl: { not: null } }, select: { tcgId: true, imageUrl: true }, distinct: ['tcgId'] });
    twins.forEach((card) => byTcgId.set(card.tcgId, card.imageUrl));
    // Mitos y Leyendas: la imagen oficial está en su catálogo (TcgProduct), no en el de TCGplayer
    const mylIds = tcgIds.filter((id) => id.startsWith('myl:') && !byTcgId.has(id));
    if (mylIds.length) {
      const products = await prisma.tcgProduct.findMany({ where: { productId: { in: mylIds.map(rawMylId) } }, select: { productId: true, imageUrl: true } });
      products.forEach((product) => { if (product.imageUrl) byTcgId.set(storedMylId(product.productId), product.imageUrl); });
    }
    const productIds = tcgIds.filter((id) => !byTcgId.has(id) && !id.startsWith('myl:')).map((id) => /^(?:tcgcsv:)?(\d{1,9})$/.exec(id)?.[1]).filter(Boolean).map(Number);
    if (productIds.length) {
      const catalog = await prisma.catalogCard.findMany({ where: { productId: { in: productIds } }, select: { productId: true, imageKey: true, thumbKey: true } });
      for (const row of catalog) {
        const url = r2PublicUrl(row.imageKey || row.thumbKey);
        if (url) tcgIds.filter((id) => id.replace(/^tcgcsv:/, '') === String(row.productId)).forEach((id) => byTcgId.set(id, url));
      }
    }
  }

  return sales.map((sale) => ({
    completedAt: sale.completedAt,
    inPerson: sale.inPerson,
    items: sale.lines.map((item) => {
      const quantity = Math.max(1, Number(item?.quantity ?? item?.q) || 1);
      const unitPrice = Math.max(0, Number(item?.unitPrice ?? item?.price) || 0);
      return {
        name: typeof item?.name === 'string' ? item.name : 'Carta',
        quantity,
        unitPrice,
        finish: (typeof item?.finish === 'string' ? item.finish.slice(0, 40) : '') || finishes.get(String(item?.id || '')) || '',
        imageUrl: images.get(String(item?.id || '')) || item?.imageUrl || byTcgId.get(item?.tcgId) || null
      };
    })
  }));
};
