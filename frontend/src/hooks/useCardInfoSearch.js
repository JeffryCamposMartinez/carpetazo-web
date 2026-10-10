import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { fetchPokemonGroupCards, fetchPokemonGroups, filterPokemonCards } from '../services/tcgcsvPokemon';
import { fetchGameGroupCards, fetchGameGroups, filterGameCards } from '../services/tcgcsvGames';
import { EMPTY_OP_FILTERS } from '../services/tcgcsvOnePiece';
import { EMPTY_MAGIC_FILTERS } from '../services/tcgcsvMagic';
import { EMPTY_RB_FILTERS } from '../services/tcgcsvRiftbound';
import { EMPTY_YGO_FILTERS } from '../services/tcgcsvYugioh';
import { isSimilarName } from '../utils/similarName';

export const INFO_PAGE = 60; // cartas por página
export const INFO_GAMES = ['Pokémon', 'Mitos y Leyendas', 'One Piece', 'Magic', 'Yu-Gi-Oh!', 'Riftbound'];
const GAME_FILTERS = { 'One Piece': EMPTY_OP_FILTERS, Magic: EMPTY_MAGIC_FILTERS, 'Yu-Gi-Oh!': EMPTY_YGO_FILTERS, Riftbound: EMPTY_RB_FILTERS };
const MYL_CATEGORY = '99';
const BATCH = 3; // ediciones que se descargan a la vez
const ROUND_EDITIONS = 24; // ediciones revisadas por juego en cada tanda; las tandas se repiten hasta llenar la página
const SIMILAR_FROM = 4; // desde este largo del texto también se buscan nombres parecidos

const label = (name, number) => (number && !name.includes(number) ? `${name} - ${number}` : name);

const fromTcgcsv = (card, game) => ({
  id: `tcgcsv:${card.catId}:${card.productId}`,
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
export default function useCardInfoSearch({ query, game, enabled, page }) {
  const term = query.trim();
  const [state, setState] = useState({ results: [], searching: false, exhausted: false });
  const searchId = useRef(0);
  const loopRef = useRef(null);
  const wantedRef = useRef(1);
  const cursors = useRef({});
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
      lists.forEach((list) => {
        const matches = isPokemon ? filterPokemonCards(list, { query: term }) : filterGameCards(name, list, term, GAME_FILTERS[name]);
        const matched = new Set(matches);
        exact.push(...matches.map((card) => fromTcgcsv(card, name)));
        if (term.length >= SIMILAR_FROM) similar.push(...list.filter((card) => !matched.has(card) && isSimilarName(card.name, term)).map((card) => fromTcgcsv(card, name)));
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
    listRef.current = [];
    seenRef.current = new Set();
    setState({ results: [], searching: false, exhausted: false });
  }, [enabled, term, gamesKey]);

  // Página pedida: se completa lo que falte
  useEffect(() => {
    wantedRef.current = page;
    if (!enabled || term.length < 2 || loopRef.current === searchId.current) return;
    loopRef.current = searchId.current;
    fill(searchId.current, controllerRef.current.signal);
  }, [enabled, term, gamesKey, page]);

  return state;
}
