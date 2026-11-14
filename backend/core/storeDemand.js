// Demanda de cartas para tiendas: cuántas personas distintas tienen cada carta en su lista de deseos.
// Solo conteos agregados, solo cartas con 2 o más interesados; nunca quiénes.
import { prisma } from './db.js';
import { storedMylId } from './mylIdentity.js';
import { splitWishKey } from './wishlistKey.js';

const MIN_PEOPLE = 2;
const ITEMS_MAX = 20000;
const CACHE_MS = 10 * 60 * 1000;
let cache = { at: 0, rows: [] };

// Misma clave que usan los avisos de deseadas para encontrar la carta publicada (tcgId de la carta de carpeta)
export const wishTcgId = (item) => (item.categoryId === 99 ? storedMylId(item.productId) : splitWishKey(item.productId).base.replace(/^tcgcsv:\d+:/, ''));

export const aggregateDemand = (items, excludeUserId = null) => {
  const byKey = new Map();
  for (const item of items) {
    if (!item.productId || item.userId === excludeUserId) continue;
    const tcgId = wishTcgId(item);
    if (!tcgId) continue;
    const entry = byKey.get(tcgId) || { tcgId, name: item.name, game: item.game || '', imageUrl: item.imageUrl || null, people: new Set() };
    entry.people.add(item.userId);
    byKey.set(tcgId, entry);
  }
  return [...byKey.values()]
    .map(({ people, ...rest }) => ({ ...rest, count: people.size }))
    .filter((e) => e.count >= MIN_PEOPLE)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

const loadItems = () => prisma.wishlistItem.findMany({ where: { moderationState: 'visible', productId: { not: null } }, select: { userId: true, productId: true, categoryId: true, name: true, game: true, imageUrl: true }, take: ITEMS_MAX });

// Demanda general (en caché unos minutos), sin contar a la propia tienda
export const demandFor = async (storeId, now = Date.now()) => {
  if (now - cache.at > CACHE_MS) cache = { at: now, items: await loadItems() };
  return aggregateDemand(cache.items, storeId);
};
