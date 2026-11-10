// Orden por parecido con la carta escaneada: la cámara manda las claves «categoría:producto» de las candidatas, de la más parecida a la menos.
// Quien no está en la lista queda después, sin cambiar su orden.
const VALID = /^\d{1,9}:\d{1,12}$/;

// Lo que llega por el estado de navegación se vuelve a validar (puede venir de un historial viejo)
export const readScanOrder = (state) => (Array.isArray(state?.scanOrder) ? state.scanOrder.filter((key) => typeof key === 'string' && VALID.test(key)).slice(0, 60) : []);

// Clave de una carta del catálogo (resultado del índice o de Mitos y Leyendas)
export const catalogKey = (card) => {
  if (String(card?.id || '').startsWith('myl:')) return `99:${String(card.id).slice(4)}`;
  const category = card?.catId ?? card?.categoryId;
  const product = card?.tcgProductId ?? card?.productId;
  return category != null && product != null ? `${category}:${product}` : '';
};

export const sortByScan = (list, keyOf, order) => {
  if (!order?.length) return list;
  const rank = new Map(order.map((key, index) => [key, index]));
  return list
    .map((item, index) => ({ item, index, rank: rank.has(keyOf(item)) ? rank.get(keyOf(item)) : Infinity }))
    .sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank - b.rank))
    .map((entry) => entry.item);
};

// Las ofertas solo traen el id del producto (sin categoría): se compara por ese número
export const offerKeyIn = (order) => {
  const byProduct = new Map();
  order.forEach((key, index) => { const product = key.split(':')[1]; if (!byProduct.has(product)) byProduct.set(product, index); });
  return (offer) => { const product = String(offer?.tcgId || '').replace(/^(tcgcsv|myl):/, ''); return byProduct.has(product) ? `p:${byProduct.get(product)}` : ''; };
};
