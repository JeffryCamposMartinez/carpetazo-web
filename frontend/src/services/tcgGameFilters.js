// Filtros por juego para cartas ya guardadas en una carpeta (Yu-Gi-Oh!, Magic, One Piece y Riftbound): los mismos criterios del buscador de «agregar cartas».
// Cada carpeta guarda solo unos pocos datos de la carta, así que los completos se piden al catálogo y se arman igual que allí.
import { api } from './api';
import { EMPTY_YGO_FILTERS, countYugiohFilters, filterYugiohCards, loadYugiohMeta, yugiohExt } from './tcgcsvYugioh';
import { EMPTY_MAGIC_FILTERS, countMagicFilters, filterMagicCards, loadMagicMeta, magicExt } from './tcgcsvMagic';
import { EMPTY_OP_FILTERS, countOnePieceFilters, filterOnePieceCards, onePieceExt } from './tcgcsvOnePiece';
import { EMPTY_RB_FILTERS, countRiftboundFilters, filterRiftboundCards, riftboundExt } from './tcgcsvRiftbound';
import { EMPTY_LC_FILTERS, countLorcanaFilters, filterLorcanaCards, lorcanaExt } from './tcgcsvLorcana';
import { EMPTY_DG_FILTERS, countDigimonFilters, digimonExt, filterDigimonCards } from './tcgcsvDigimon';

const GAMES = {
  YuGiOh: { key: 'yugioh', empty: EMPTY_YGO_FILTERS, count: countYugiohFilters, filter: filterYugiohCards, meta: loadYugiohMeta, build: (ext, group, name, meta) => yugiohExt(ext, group, name, meta) },
  Magic: { key: 'magic', empty: EMPTY_MAGIC_FILTERS, count: countMagicFilters, filter: filterMagicCards, meta: loadMagicMeta, build: (ext, group, name, meta) => magicExt(ext, group, name, meta) },
  OnePiece: { key: 'onepiece', empty: EMPTY_OP_FILTERS, count: countOnePieceFilters, filter: filterOnePieceCards, meta: null, build: (ext, group, name) => onePieceExt(ext, group, name) },
  Riftbound: { key: 'riftbound', empty: EMPTY_RB_FILTERS, count: countRiftboundFilters, filter: filterRiftboundCards, meta: null, build: (ext, group, name) => riftboundExt(ext, group, name) },
  Lorcana: { key: 'lorcana', empty: EMPTY_LC_FILTERS, count: countLorcanaFilters, filter: filterLorcanaCards, meta: null, build: (ext, group, name) => lorcanaExt(ext, group, name) },
  Digimon: { key: 'digimon', empty: EMPTY_DG_FILTERS, count: countDigimonFilters, filter: filterDigimonCards, meta: null, build: (ext, group, name) => digimonExt(ext, group, name) },
};

// null si el juego no usa estos filtros (Pokémon y Mitos y Leyendas tienen los suyos)
export const gameFilterKit = (tcg) => GAMES[tcg] || null;

const CHUNK = 400;

// Devuelve las cartas con `extData` completo (las que no están en el catálogo quedan como estaban)
export async function withCatalogData(tcg, cards) {
  const kit = GAMES[tcg];
  if (!kit) return cards;
  const ids = [...new Set(cards.map((card) => String(card.tcgId || '')).filter((id) => /^[1-9]\d{0,9}$/.test(id)))];
  const [meta, ...pages] = await Promise.all([
    kit.meta ? kit.meta() : null,
    ...Array.from({ length: Math.ceil(ids.length / CHUNK) }, (_, index) => api.getCatalogCardsData(ids.slice(index * CHUNK, (index + 1) * CHUNK)).then((res) => res?.data || {}).catch(() => ({}))),
  ]);
  const byId = Object.assign({}, ...pages);
  return cards.map((card) => {
    const row = byId[String(card.tcgId)];
    if (!row) return card;
    const ext = {};
    row.extendedData.forEach((item) => { ext[item.name] = item.value; });
    return { ...card, extData: { ...ext, localId: ext.Number, ...kit.build(ext, row.group, card.name, meta) } };
  });
}
