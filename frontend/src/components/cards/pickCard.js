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
