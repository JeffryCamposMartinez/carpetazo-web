import { apiUrl } from './api';
import { ONE_PIECE_CATEGORY, filterOnePieceCards, onePieceExt, onePieceGroupLabel, onePieceMatchesQuery } from './tcgcsvOnePiece';
import { MAGIC_CATEGORY, MAGIC_MARKER, filterMagicCards, loadMagicMeta, magicExt, magicGroupLabel, magicGroupRank, magicMatchesQuery } from './tcgcsvMagic';
import { RIFTBOUND_CATEGORY, RIFTBOUND_MARKER, filterRiftboundCards, riftboundExt, riftboundGroupLabel, riftboundMatchesQuery } from './tcgcsvRiftbound';

// Juegos que se buscan directo en TCGCSV. `searchCategory` es el valor de la carpeta: '1' = Pokémon, '68' = One Piece, 'magic' = Magic, 'riftbound' = Riftbound.
// Devuelve la categoría de TCGCSV (Pokémon: 3 en inglés y 85 en japonés) o null si el juego se busca en la base de Carpetazo.
export const tcgcsvCategoryId = (searchCategory, lang) => {
  if (searchCategory === '1') return lang === 'ja' ? 85 : 3;
  if (searchCategory === String(ONE_PIECE_CATEGORY)) return ONE_PIECE_CATEGORY;
  if (searchCategory === MAGIC_MARKER) return MAGIC_CATEGORY;
  if (searchCategory === RIFTBOUND_MARKER) return RIFTBOUND_CATEGORY;
  return null;
};

// --- Catálogo de cada juego para buscar cartas fuera de una carpeta (lista de deseados) ---
const GAMES = {
  'One Piece': { catId: ONE_PIECE_CATEGORY, marker: '68', label: onePieceGroupLabel, parse: (ext, group, name) => onePieceExt(ext, group, name), matches: onePieceMatchesQuery, filter: filterOnePieceCards },
  Magic: { catId: MAGIC_CATEGORY, marker: MAGIC_MARKER, label: magicGroupLabel, rank: magicGroupRank, parse: (ext, group, name, meta) => magicExt(ext, group, name, meta), matches: magicMatchesQuery, filter: filterMagicCards },
  Riftbound: { catId: RIFTBOUND_CATEGORY, marker: RIFTBOUND_MARKER, label: riftboundGroupLabel, parse: (ext, group, name) => riftboundExt(ext, group, name), matches: riftboundMatchesQuery, filter: filterRiftboundCards },
};

export const tcgcsvGameInfo = (game) => GAMES[game] || null;

const groupsCache = new Map();
const cardsCache = new Map();

// Ediciones ya publicadas, de la más nueva a la más vieja (las que TCGCSV fecha el mismo día de importación van al final por nombre)
export const fetchGameGroups = async (game, signal) => {
  const info = GAMES[game];
  if (!groupsCache.has(game)) {
    const json = await fetch(apiUrl(`/tcgcsv/tcgplayer/${info.catId}/groups`), { signal }).then((r) => r.json());
    const results = json.results || [];
    const perDay = {};
    results.forEach((g) => { const day = g.publishedOn.slice(0, 10); perDay[day] = (perDay[day] || 0) + 1; });
    const undated = (g) => perDay[g.publishedOn.slice(0, 10)] >= 8;
    const groups = results
      .filter((g) => new Date(g.publishedOn) <= new Date())
      .sort((a, b) => (undated(a) - undated(b)) || (undated(a) ? a.name.localeCompare(b.name) : new Date(b.publishedOn) - new Date(a.publishedOn)));
    if (info.rank) groups.sort((a, b) => info.rank(a) - info.rank(b));
    groupsCache.set(game, groups.map((g) => ({ groupId: g.groupId, id: g.groupId, name: info.label(g), abbreviation: g.abbreviation, isSupplemental: g.isSupplemental, publishedOn: g.publishedOn })));
  }
  return groupsCache.get(game);
};

// Cartas de una edición (solo las que tienen número), con los datos que usan los filtros
export const fetchGameGroupCards = async (game, group, signal) => {
  const info = GAMES[game];
  const key = `${game}-${group.groupId}`;
  if (cardsCache.has(key)) return cardsCache.get(key);
  const [json, meta] = await Promise.all([
    fetch(apiUrl(`/tcgcsv/tcgplayer/${info.catId}/${group.groupId}/products`), { signal }).then((r) => r.json()),
    game === 'Magic' ? loadMagicMeta() : null,
  ]);
  const toNumber = (text) => { const match = String(text || '').match(/\d+/); return match ? parseInt(match[0], 10) : 0; };
  const list = (json.results || [])
    .map((product) => {
      const ext = {};
      (product.extendedData || []).forEach((entry) => { ext[entry.name] = entry.value; });
      return { product, ext };
    })
    .filter(({ ext }) => ext.Number)
    .map(({ product, ext }) => ({
      productId: String(product.productId),
      catId: info.catId,
      name: product.name,
      number: ext.Number,
      imageUrl: (product.imageUrl || '').replace('_200w', '_400w'),
      setName: group.name,
      language: 'Inglés',
      extData: { ...ext, localId: ext.Number, ...info.parse(ext, group, product.name, meta) },
    }));
  list.sort((a, b) => toNumber(a.number) - toNumber(b.number) || String(a.number).localeCompare(String(b.number)));
  cardsCache.set(key, list);
  return list;
};

// Texto del buscador (nombre, número o lo propio de cada juego) y los filtros del juego
export const filterGameCards = (game, cards, query, filters) => {
  const info = GAMES[game];
  const q = String(query || '').trim().toLowerCase();
  return info.filter(cards.filter((card) => info.matches(card, q)), filters);
};
