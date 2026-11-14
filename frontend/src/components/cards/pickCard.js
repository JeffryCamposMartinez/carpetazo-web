// Ayudantes de «Selecciona tu carta» (el escáner de cartas de una carpeta): impresiones de una carta en todos los idiomas del juego
export const baseName = (name) => String(name || '').replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+-\s+\S*\d\S*$/, '').trim();
// «Selecciona tu carta»: el catálogo suma a lo que trae el motor todas las impresiones de la carta, en los idiomas que tiene el juego
export const INDEX_GAME = { 3: 'Pokemon,Pokemon_Japan', 100: 'Pokemon,Pokemon_Japan', 85: 'Pokemon,Pokemon_Japan', 1: 'Magic', 2: 'YuGiOh', 68: 'One_Piece', 71: 'Disney_Lorcana', 63: 'Digimon_Card_Game', 89: 'Riftbound' };
export const LANG_CODE = { 3: 'EN', 100: 'ES', 85: 'JP' }; // solo Pokémon tiene varios idiomas en el catálogo
export const LANG_NAME = { EN: 'Inglés', ES: 'Español', JP: 'Japonés' };
export const LANG_ORDER = ['EN', 'ES', 'JP'];
export const plain = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const shownName = (name) => String(name || '').replace(/\s+-\s+\S*\d\S*$/, '').trim(); // se conserva la variante «(Cosmos Holo)»; el número se muestra aparte
export const fromIndex = (card) => ({ name: card.name, number: card.number || '', set: card.setName || '', rarity: card.rarity || '', image: card.hasImage === false ? null : card.imageUrl || null, categoryId: card.categoryId, productId: card.productId, groupId: card.groupId, score: 0 });
export const cardId = (card) => `${card.categoryId}:${card.productId}`;

// Número de coleccionista sin ceros ni total: «088/088» y «88» son el mismo
export const leadNumber = (value) => String(value || '').match(/\d+/)?.[0]?.replace(/^0+(?=\d)/, '') || '';


// Otras ediciones o impresiones de la carta reconocida, sin repetir, para el menú de versiones
export const versionsOf = (result) => {
  const seen = new Set();
  return [...(result.top || []), ...(result.same || [])].filter((card) => { const id = `${card.categoryId}:${card.productId}`; if (card.productId == null || seen.has(id)) return false; seen.add(id); return true; }).slice(0, 14);
};

// Impresiones de la misma carta (mismo nombre base) que ya trae el motor, la reconocida primero
export const pickOptions = (result) => {
  const first = result.top?.[0];
  if (!first || first.productId == null) return [];
  const key = plain(baseName(first.name) || first.name);
  // Misma carta: el mismo nombre o, con otro nombre (una carta en español contra su versión inglesa), el mismo número y casi el mismo parecido visual
  const lead = leadNumber;
  const sameCard = (card) => plain(baseName(card.name) || card.name) === key || (lead(card.number) !== '' && lead(card.number) === lead(first.number) && (first.score ?? 0) - (card.score ?? 0) <= 0.06);
  const rest = versionsOf(result).filter((card) => cardId(card) !== cardId(first) && sameCard(card));
  return [first, ...rest];
};

// La reconocida primero. El resto, por idioma (primero el de la reconocida) y, dentro de cada idioma, en el mismo orden que el listado en inglés:
// la versión en español (o japonés) de una impresión queda en el mismo lugar que la inglesa
export const mergeOptions = (base, extra, order = new Map()) => {
  const seen = new Set();
  const all = [];
  [...base, ...extra].forEach((card) => { if (card.productId == null || seen.has(cardId(card))) return; seen.add(cardId(card)); all.push(card); });
  const mine = LANG_CODE[base[0]?.categoryId];
  const rank = (card) => { const code = LANG_CODE[card.categoryId]; return code === mine ? -1 : LANG_ORDER.indexOf(code); };
  const [first, ...rest] = all;
  const place = (card) => (card.productId === first.productId ? -1 : order.has(card.productId) ? order.get(card.productId) : 1e6 + (card.apiIndex ?? 1e5)); // la gemela de la reconocida va primera en cada idioma
  const sorted = [first, ...rest.sort((x, y) => rank(x) - rank(y) || place(x) - place(y))];
  // Impresiones de la misma edición y número (la normal y su versión «Cosmos Holo» de liga) van seguidas, la normal primero
  const slot = (card) => (card.groupId != null && card.number ? `${LANG_CODE[card.categoryId]}|${card.groupId}|${card.number}` : null);
  const groups = new Map();
  sorted.forEach((card) => { const key = slot(card); if (key) groups.set(key, [...(groups.get(key) || []), card]); });
  const emitted = new Set();
  const together = sorted.flatMap((card) => {
    const key = slot(card);
    if (!key || groups.get(key).length < 2) return [card];
    if (emitted.has(key)) return [];
    emitted.add(key);
    return [...groups.get(key)].sort((x, y) => Number(/\)\s*$/.test(x.name)) - Number(/\)\s*$/.test(y.name)));
  });
  return together.slice(0, 200);
};
