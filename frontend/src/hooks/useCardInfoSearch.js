import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { fetchPokemonGroupCards, fetchPokemonGroups, filterPokemonCards } from '../services/tcgcsvPokemon';
import { fetchGameGroupCards, fetchGameGroups, filterGameCards } from '../services/tcgcsvGames';
import { EMPTY_OP_FILTERS } from '../services/tcgcsvOnePiece';
import { EMPTY_MAGIC_FILTERS } from '../services/tcgcsvMagic';
import { EMPTY_RB_FILTERS } from '../services/tcgcsvRiftbound';
import { EMPTY_YGO_FILTERS } from '../services/tcgcsvYugioh';
import { EMPTY_LC_FILTERS } from '../services/tcgcsvLorcana';
import { EMPTY_DG_FILTERS } from '../services/tcgcsvDigimon';
import { isSimilarName } from '../utils/similarName';

export const INFO_PAGE = 60; // cartas por página
export const INFO_GAMES = ['Pokémon', 'Mitos y Leyendas', 'One Piece', 'Magic', 'Yu-Gi-Oh!', 'Riftbound', 'Lorcana', 'Digimon'];
const GAME_FILTERS = { 'One Piece': EMPTY_OP_FILTERS, Magic: EMPTY_MAGIC_FILTERS, 'Yu-Gi-Oh!': EMPTY_YGO_FILTERS, Riftbound: EMPTY_RB_FILTERS, Lorcana: EMPTY_LC_FILTERS, Digimon: EMPTY_DG_FILTERS };
const MYL_CATEGORY = '99';
const BATCH = 3; // ediciones que se descargan a la vez
const ROUND_EDITIONS = 24; // ediciones revisadas por juego en cada tanda; las tandas se repiten hasta llenar la página
const SIMILAR_FROM = 4; // desde este largo del texto también se buscan nombres parecidos

const INDEX_GAME_LABEL = { Pokemon: 'Pokémon', Pokemon_Japan: 'Pokémon', YuGiOh: 'Yu-Gi-Oh!', One_Piece: 'One Piece', OnePiece: 'One Piece', Disney_Lorcana: 'Lorcana', Digimon_Card_Game: 'Digimon' };
const label = (name, number) => (number && !name.includes(number) ? `${name} - ${number}` : name);

const fromTcgcsv = (card, game, groupId) => ({
  id: `tcgcsv:${card.catId}:${card.productId}`,
  groupId, catId: card.catId, tcgProductId: card.productId, // para el precio de referencia de TCGplayer
  name: label(card.name, card.number),
  imageUrl: card.imageUrl,
  setName: card.setName,
  language: card.language,
  game,
  payload: { external: { categoryId: card.catId, productId: card.productId }, name: label(card.name, card.number), imageUrl: card.imageUrl, detail: `${card.setName} · ${card.language}`, game },
});

const fromMyl = (product, game) => ({
  id: `myl:${product.productId}`, name: product.name, imageUrl: product.imageUrl, setName: product.group?.name || 'Catálogo', language: 'Español', game, payload: { productId: product.productId },
});

// Cartas de TCGCSV (y de la base de Mitos y Leyendas) que coinciden con un texto o se le parecen, solo para informar: no están a la venta.
// Busca en un juego o en todos; en cada uno revisa las ediciones de la más nueva a la más vieja y sigue hasta llenar la página pedida.
// La lista solo crece al final, así las cartas ya vistas no cambian de página.
export default function useCardInfoSearch({ query, game, enabled, page, sort = '' }) {
  const term = query.trim();
  const [state, setState] = useState({ results: [], searching: false, exhausted: false, pages: 1, total: 0 });
  const searchId = useRef(0);
  const loopRef = useRef(null);
  const wantedRef = useRef(1);
  const cursors = useRef({});
  const mylRef = useRef(null); // Mitos y Leyendas no está en el índice: se busca aparte en su catálogo, una vez por búsqueda
  const listRef = useRef([]);
  const seenRef = useRef(new Set());
  const controllerRef = useRef(null);
  const games = game && INFO_GAMES.includes(game) ? [game] : INFO_GAMES;
  const gamesKey = games.join('|');

  // Una tanda de un juego: coincidencias exactas y, aparte, las parecidas
  const scanGame = async (name, signal) => {
    if (name === 'Mitos y Leyendas') {
      let products = (await api.searchTcgProducts(term, MYL_CATEGORY, '', {})).data || [];
      let similar = [];
      if (!products.length && term.length >= SIMILAR_FROM) { // sin coincidencia exacta: se busca por el comienzo y se dejan las que se parecen
        const start = (await api.searchTcgProducts(term.slice(0, 3), MYL_CATEGORY, '', {})).data || [];
        similar = start.filter((product) => isSimilarName(product.name, term));
      }
      cursors.current[name] = { done: true };
      return { exact: products.map((product) => fromMyl(product, name)), similar: similar.map((product) => fromMyl(product, name)) };
    }
    const isPokemon = name === 'Pokémon';
    let cursor = cursors.current[name];
    if (!cursor) {
      cursor = { groups: await (isPokemon ? fetchPokemonGroups('en', signal) : fetchGameGroups(name, signal)), at: 0 };
      cursors.current[name] = cursor;
    }
    const exact = [];
    const similar = [];
    let scanned = 0;
    while (exact.length < INFO_PAGE && scanned < ROUND_EDITIONS && cursor.at < cursor.groups.length && !signal.aborted) {
      const batch = cursor.groups.slice(cursor.at, cursor.at + BATCH);
      const lists = await Promise.all(batch.map((group) => (isPokemon ? fetchPokemonGroupCards('en', group, signal) : fetchGameGroupCards(name, group, signal)).catch(() => [])));
      if (signal.aborted) break; // una búsqueda cancelada no avanza la posición: no se pierden ediciones
      lists.forEach((list, index) => {
        const groupId = batch[index].groupId;
        const matches = isPokemon ? filterPokemonCards(list, { query: term }) : filterGameCards(name, list, term, GAME_FILTERS[name]);
        const matched = new Set(matches);
        exact.push(...matches.map((card) => fromTcgcsv(card, name, groupId)));
        if (term.length >= SIMILAR_FROM) similar.push(...list.filter((card) => !matched.has(card) && isSimilarName(card.name, term)).map((card) => fromTcgcsv(card, name, groupId)));
      });
      cursor.at += batch.length;
      scanned += batch.length;
    }
    if (!signal.aborted) cursor.done = cursor.at >= cursor.groups.length;
    return { exact, similar };
  };

  const allDone = () => games.every((name) => cursors.current[name]?.done);

  // Tandas hasta que haya una carta más que las que llenan la página pedida (así se sabe si existe la siguiente) o no queden ediciones.
  // Un solo ciclo por búsqueda: si cambia la página mientras corre, solo se actualiza lo que pide.
  const fill = async (id, signal) => {
    setState((previous) => ({ ...previous, searching: true }));
    // Índice local: una sola petición paginada sustituye el recorrido de ediciones externas.
    try {
      // Mitos y Leyendas (solo o dentro de «Todos») sale de su propio catálogo; el índice no lo tiene
      if (!mylRef.current && (!game || game === 'Mitos y Leyendas')) {
        const found = await scanGame('Mitos y Leyendas', signal).catch(() => ({ exact: [], similar: [] }));
        if (id !== searchId.current || signal.aborted) return;
        mylRef.current = [...found.exact, ...found.similar];
      }
      const myl = mylRef.current || [];
      if (game === 'Mitos y Leyendas') {
        listRef.current = myl;
        setState({ results: myl, searching: false, exhausted: true, pages: 1, total: myl.length });
        loopRef.current = null;
        return;
      }
      const indexGame = game === 'Pokémon' ? 'Pokemon,Pokemon_Japan' : game === 'Yu-Gi-Oh!' ? 'YuGiOh' : game === 'One Piece' ? 'One_Piece' : game === 'Lorcana' ? 'Disney_Lorcana' : game === 'Digimon' ? 'Digimon_Card_Game' : game;
      const indexed = await api.searchTcgIndex(term, indexGame, wantedRef.current, sort);
      if (indexed.available) {
        // El índice nombra los juegos con claves técnicas (Pokemon_Japan, One_Piece...): se muestran y se guardan con el nombre del sitio
        const indexedCards = (indexed.cards || []).map((card) => {
          const gameName = INDEX_GAME_LABEL[card.game] || card.game;
          return {
            id: `tcg-db:${card.id}`, productId: card.productId, tcgProductId: card.productId, catId: card.categoryId,
            categoryId: card.categoryId, groupId: card.groupId, name: card.name, imageUrl: card.imageUrl,
            sourceImageUrl: card.sourceImageUrl, setName: card.setName || 'Catálogo',
            language: card.categoryId === 85 ? 'Japonés' : 'Español', game: gameName,
            payload: { external: { categoryId: card.categoryId, productId: String(card.productId) }, productId: String(card.productId), name: card.name, imageUrl: card.imageUrl, detail: card.setName || 'Catálogo', game: gameName },
          };
        });
        // En «Todos», las de Mitos y Leyendas van al comienzo de la primera página
        const shownCards = wantedRef.current === 1 ? [...myl, ...indexedCards] : indexedCards;
        setState({ results: shownCards, searching: false, exhausted: wantedRef.current >= indexed.pages, pages: indexed.pages || 1, total: (indexed.total || indexedCards.length) + myl.length });
        loopRef.current = null;
        return;
      }
    } catch (_) { /* fallback al catálogo existente */ }
    while (id === searchId.current && !signal.aborted && listRef.current.length <= wantedRef.current * INFO_PAGE && !allDone()) {
      const pending = games.filter((name) => !cursors.current[name]?.done);
      const rounds = await Promise.all(pending.map((name) => scanGame(name, signal).catch(() => ({ exact: [], similar: [] }))));
      if (id !== searchId.current || signal.aborted) return;
      const fresh = [...rounds.flatMap((round) => round.exact), ...rounds.flatMap((round) => round.similar)].filter((card) => !seenRef.current.has(card.id));
      fresh.forEach((card) => seenRef.current.add(card.id));
      listRef.current = [...listRef.current, ...fresh];
      setState({ results: listRef.current, searching: true, exhausted: allDone() });
    }
    if (id === searchId.current && !signal.aborted) {
      loopRef.current = null;
      setState({ results: listRef.current, searching: false, exhausted: allDone() });
    }
  };

  // Texto o juego nuevo: se empieza de cero
  useEffect(() => {
    searchId.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    loopRef.current = null;
    cursors.current = {};
    mylRef.current = null;
    listRef.current = [];
    seenRef.current = new Set();
    setState({ results: [], searching: false, exhausted: false, pages: 1, total: 0 });
  }, [enabled, term, gamesKey, sort]);

  // Página pedida: se completa lo que falte
  useEffect(() => {
    wantedRef.current = page;
    if (!enabled || term.length < 2 || loopRef.current === searchId.current) return;
    loopRef.current = searchId.current;
    fill(searchId.current, controllerRef.current.signal);
  }, [enabled, term, gamesKey, page, sort]);

  return state;
}
