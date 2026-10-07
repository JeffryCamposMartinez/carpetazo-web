import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/api';
import FolderAddSearchFilters from '../folder/filters/FolderAddSearchFilters';
import LoadableImage from '../ui/LoadableImage';
import {
  fetchPokemonGroupCards,
  fetchPokemonGroups,
  filterPokemonCards,
} from '../../services/tcgcsvPokemon';
import Select from '../ui/Select';
import { fetchGameGroupCards, fetchGameGroups, filterGameCards, tcgcsvGameInfo } from '../../services/tcgcsvGames';
import { EMPTY_OP_FILTERS, countOnePieceFilters } from '../../services/tcgcsvOnePiece';
import { EMPTY_MAGIC_FILTERS, countMagicFilters } from '../../services/tcgcsvMagic';
import { EMPTY_RB_FILTERS, countRiftboundFilters } from '../../services/tcgcsvRiftbound';

// Juegos del sitio. Solo los marcados tienen buscador con filtros; el resto llegará pronto.
export const WISHLIST_GAMES = [
  { name: 'Pokémon', available: true },
  { name: 'Mitos y Leyendas', available: true },
  { name: 'One Piece', available: true },
  { name: 'Magic', available: true },
  { name: 'Yu-Gi-Oh!', available: false },
  { name: 'Riftbound', available: true },
];

const MYL_CATEGORY = '99';
const SCAN_BATCH = 3; // ediciones de Pokémon que se descargan a la vez cuando no se elige una (igual que al agregar cartas a una carpeta)
const PAGE = 20;

const cardLabel = (name, number) => (number && !name.includes(number) ? `${name} - ${number}` : name);

const pokemonRow = (card) => ({
  key: `tcgcsv:${card.catId}:${card.productId}`,
  payload: { external: { categoryId: card.catId, productId: card.productId }, name: cardLabel(card.name, card.number), imageUrl: card.imageUrl, detail: `${card.setName} · ${card.language}`, game: 'Pokémon' },
  label: cardLabel(card.name, card.number),
  sub: `${card.setName} · ${card.language}`,
  imageUrl: card.imageUrl,
});

// Carta de One Piece, Magic o Riftbound (TCGCSV)
const gameRow = (card, game) => ({
  key: `tcgcsv:${card.catId}:${card.productId}`,
  payload: { external: { categoryId: card.catId, productId: card.productId }, name: cardLabel(card.name, card.number), imageUrl: card.imageUrl, detail: `${card.setName} · ${card.language}`, game },
  label: cardLabel(card.name, card.number),
  sub: `${card.setName} · ${card.language}`,
  imageUrl: card.imageUrl,
  extData: card.extData,
});

export default function WishlistCardFinder({ onAdd, addedKeys = new Set(), busyKey = '', resetRef = null }) {
  const [game, setGame] = useState('Pokémon');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSet, setSearchSet] = useState('');
  const [isSetDropdownOpen, setIsSetDropdownOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE);

  // Pokémon
  const [searchLang, setSearchLang] = useState('en');
  const [selectedSupertype, setSelectedSupertype] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [editionGroups, setEditionGroups] = useState([]); // ediciones de Pokémon, One Piece, Magic o Riftbound (TCGCSV)
  const scanned = useRef(0);

  // Mitos y Leyendas
  const [blocks, setBlocks] = useState([]);
  const [physicalProducts, setPhysicalProducts] = useState([]);
  const [mylGroups, setMylGroups] = useState([]);
  const [searchBlock, setSearchBlock] = useState('');
  const [searchPhysicalProduct, setSearchPhysicalProduct] = useState('');
  const [mylType, setMylType] = useState('');
  const [mylRace, setMylRace] = useState('');
  const [mylCost, setMylCost] = useState('');

  // One Piece, Magic y Riftbound
  const [opFilters, setOpFilters] = useState(EMPTY_OP_FILTERS);
  const [magicFilters, setMagicFilters] = useState(EMPTY_MAGIC_FILTERS);
  const [rbFilters, setRbFilters] = useState(EMPTY_RB_FILTERS);

  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [moreEditions, setMoreEditions] = useState(false);
  const [hint, setHint] = useState('');
  const seq = useRef(0);

  const isPokemon = game === 'Pokémon';
  const isMyl = game === 'Mitos y Leyendas';
  const selectedGame = WISHLIST_GAMES.find((item) => item.name === game);
  const gameInfo = tcgcsvGameInfo(game); // One Piece, Magic o Riftbound
  const gameFilters = game === 'One Piece' ? opFilters : game === 'Magic' ? magicFilters : rbFilters;
  const gameFilterCount = game === 'One Piece' ? countOnePieceFilters(opFilters) : game === 'Magic' ? countMagicFilters(magicFilters) : countRiftboundFilters(rbFilters);
  const loadCards = (group, signal) => (gameInfo ? fetchGameGroupCards(game, group, signal) : fetchPokemonGroupCards(searchLang, group, signal));
  const rowOf = (card) => (gameInfo ? gameRow(card, game) : pokemonRow(card));
  // Texto de búsqueda y filtros del juego sobre las cartas de una edición
  const filterCards = (list, term) => (gameInfo
    ? filterGameCards(game, list, term, gameFilters)
    : filterPokemonCards(list, { query: term, supertype: selectedSupertype, type: selectedType }));

  const resetFilters = () => {
    setSearchQuery(''); setSearchSet(''); setSelectedSupertype(''); setSelectedType('');
    setSearchBlock(''); setSearchPhysicalProduct(''); setMylType(''); setMylRace(''); setMylCost('');
    setOpFilters(EMPTY_OP_FILTERS); setMagicFilters(EMPTY_MAGIC_FILTERS); setRbFilters(EMPTY_RB_FILTERS);
    setResults([]); setHint(''); setVisible(PAGE);
  };
  if (resetRef) resetRef.current = resetFilters;

  // Datos de cada juego: ediciones, bloques y productos
  useEffect(() => {
    const controller = new AbortController();
    if (isPokemon) {
      setEditionGroups([]);
      fetchPokemonGroups(searchLang, controller.signal).then(setEditionGroups).catch(() => {});
    }
    if (tcgcsvGameInfo(game)) {
      setEditionGroups([]);
      fetchGameGroups(game, controller.signal).then(setEditionGroups).catch(() => {});
    }
    if (isMyl) {
      api.getTcgBlocks(MYL_CATEGORY).then((res) => { if (res.success) setBlocks(res.data); }).catch(() => {});
      api.getTcgPhysicalProducts().then((res) => { if (res.success) setPhysicalProducts(res.data); }).catch(() => {});
      api.getTcgGroups(MYL_CATEGORY).then((res) => { if (res.success) setMylGroups([...res.data].sort((a, b) => new Date(b.publishedOn || 0) - new Date(a.publishedOn || 0))); }).catch(() => {});
    }
    return () => controller.abort();
  }, [isPokemon, isMyl, searchLang, game]);

  const availableSets = isMyl ? mylGroups : editionGroups;
  const filteredSearchSets = isMyl && searchBlock !== '' ? availableSets.filter((set) => set.blockId == searchBlock) : availableSets;
  const mylFilters = useMemo(() => ({ type: mylType, race: mylRace, cost: mylCost, blockId: searchBlock, physicalProductId: searchPhysicalProduct }), [mylType, mylRace, mylCost, searchBlock, searchPhysicalProduct]);

  // Búsqueda: se lanza un momento después del último cambio de filtro
  useEffect(() => {
    if (!selectedGame?.available) { setResults([]); setHint(''); return undefined; }
    const term = searchQuery.trim();
    const controller = new AbortController();
    const mine = ++seq.current;
    setVisible(PAGE);

    const run = async () => {
      if (isMyl) {
        const hasFilter = term.length >= 2 || searchSet || searchBlock || searchPhysicalProduct || mylType || mylRace || mylCost;
        if (!hasFilter) { setResults([]); setHint('Escribe el nombre o elige un bloque, producto o edición.'); return; }
        setHint(''); setSearching(true);
        try {
          const response = searchSet && !term
            ? await api.getTcgProducts(MYL_CATEGORY, searchSet, mylFilters)
            : await api.searchTcgProducts(term, MYL_CATEGORY, searchSet, mylFilters);
          if (mine !== seq.current) return;
          setResults((response.data || []).map((product) => ({
            key: product.productId,
            payload: { productId: product.productId },
            label: product.name,
            sub: product.group?.name || 'Catálogo',
            imageUrl: product.imageUrl,
          })));
        } catch (_error) {
          if (mine === seq.current) setResults([]);
        } finally {
          if (mine === seq.current) setSearching(false);
        }
        return;
      }

      // Pokémon, One Piece, Magic y Riftbound (TCGCSV)
      setMoreEditions(false);
      if (searchSet) {
        const group = editionGroups.find((item) => String(item.groupId) === String(searchSet));
        if (!group) return;
        setHint(''); setSearching(true);
        try {
          const cards = filterCards(await loadCards(group, controller.signal), term);
          if (mine === seq.current) setResults(cards.map(rowOf));
        } catch (_error) {
          if (mine === seq.current) setResults([]);
        } finally {
          if (mine === seq.current) setSearching(false);
        }
        return;
      }
      // Todas las ediciones: mismo criterio que al agregar a una carpeta (coincide nombre o número, de la edición más nueva a la más vieja)
      if (!term && !selectedSupertype && !selectedType && gameFilterCount === 0) { setResults([]); setHint('Elige una edición o escribe el nombre de la carta.'); return; }
      if (editionGroups.length === 0) return;
      setHint(''); setSearching(true); scanned.current = 0;
      try {
        const { found, next } = await scanEditions(0, term, controller.signal);
        if (mine === seq.current) { scanned.current = next; setResults(found); setMoreEditions(next < editionGroups.length); }
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    };

    const timer = setTimeout(run, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [game, searchQuery, searchSet, searchLang, selectedSupertype, selectedType, editionGroups, mylFilters, opFilters, magicFilters, rbFilters]);

  // Descarga ediciones de a 3, de la más nueva a la más vieja, hasta juntar una página de coincidencias (o llegar a la última)
  const scanEditions = async (from, term, signal) => {
    const found = [];
    let at = from;
    while (found.length < PAGE && at < editionGroups.length && !signal?.aborted) {
      const batch = editionGroups.slice(at, at + SCAN_BATCH);
      const lists = await Promise.all(batch.map((group) => loadCards(group, signal).catch(() => [])));
      lists.forEach((list) => found.push(...filterCards(list, term).map(rowOf)));
      at += batch.length;
    }
    return { found, next: at };
  };

  const scanMoreEditions = async () => {
    if (scanned.current >= editionGroups.length) return;
    setSearching(true);
    const mine = seq.current;
    try {
      const { found, next } = await scanEditions(scanned.current, searchQuery.trim());
      if (mine !== seq.current) return;
      scanned.current = next;
      setResults((previous) => [...previous, ...found]);
      setMoreEditions(next < editionGroups.length);
      setVisible((value) => value + PAGE);
    } finally {
      setSearching(false);
    }
  };

  const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#facc15]/70';

  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold text-slate-600">
        Juego
        <Select
          value={game}
          onChange={(event) => { setGame(event.target.value); resetFilters(); }}
          aria-label="Juego de la carta"
          className={`${inputClass} mt-1 h-12 font-extrabold text-[#12315f]`}
        >
          {WISHLIST_GAMES.map((item) => <option key={item.name} value={item.name}>{item.name}{item.available ? '' : ' (buscador próximamente)'}</option>)}
        </Select>
      </label>

      {selectedGame?.available && (
        <div className="rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-200">
          <FolderAddSearchFilters
            availableBlocks={blocks}
            tcg={game}
            searchCategory={isMyl ? MYL_CATEGORY : gameInfo ? gameInfo.marker : '1'}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchSet={searchSet}
            availableSets={availableSets}
            filteredSearchSets={filteredSearchSets}
            isSetDropdownOpen={isSetDropdownOpen}
            setIsSetDropdownOpen={setIsSetDropdownOpen}
            setSearchSet={setSearchSet}
            searchLang={searchLang}
            setSearchLang={setSearchLang}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            selectedSupertype={selectedSupertype}
            setSelectedSupertype={setSelectedSupertype}
            searchBlock={searchBlock}
            setSearchBlock={setSearchBlock}
            searchPhysicalProduct={searchPhysicalProduct}
            setSearchPhysicalProduct={setSearchPhysicalProduct}
            availablePhysicalProducts={physicalProducts}
            mylType={mylType}
            setMylType={setMylType}
            mylRace={mylRace}
            setMylRace={setMylRace}
            mylCost={mylCost}
            setMylCost={setMylCost}
            opFilters={opFilters}
            setOpFilters={setOpFilters}
            magicFilters={magicFilters}
            setMagicFilters={setMagicFilters}
            rbFilters={rbFilters}
            setRbFilters={setRbFilters}
            loadedCards={results}
            scrollToTopIfNeeded={() => {}}
          />
        </div>
      )}

      {!selectedGame?.available && (
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          El buscador de {game} llegará pronto.
        </p>
      )}

      {selectedGame?.available && (
        <div aria-live="polite">
          {hint && results.length === 0 && <p className="px-1 text-sm text-slate-500 lg:hidden">{hint}</p>}
          {searching && results.length === 0 && <p className="px-1 text-sm text-slate-500">Buscando…</p>}
          {!hint && !searching && results.length === 0 && <p className="px-1 text-sm text-slate-500">No encontramos cartas con esos filtros.</p>}
          {results.length > 0 && (
            <>
              <p className="mb-1.5 px-1 text-xs font-semibold text-slate-500">{results.length.toLocaleString('es-CL')} {results.length === 1 ? 'resultado' : 'resultados'}</p>
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                {results.slice(0, visible).map((row) => (
                  <li key={row.key} className="flex min-w-0 flex-col gap-1.5 rounded-xl bg-white p-1.5 ring-1 ring-slate-200 sm:p-2">
                    <span className="relative block aspect-[5/7] w-full overflow-hidden rounded-lg bg-slate-100">
                      {row.imageUrl ? <LoadableImage src={row.imageUrl} alt={row.label} loading="lazy" className="h-full w-full object-contain" /> : <span className="flex h-full items-center justify-center px-1 text-center text-[11px] font-semibold text-slate-500">Sin imagen</span>}
                    </span>
                    <span className="min-w-0 px-0.5">
                      <span className="line-clamp-2 block text-[12px] font-bold leading-tight text-[#12315f] sm:text-[13px]" title={row.label}>{row.label}</span>
                      <span className="mt-0.5 line-clamp-1 block text-[11px] text-slate-500" title={row.sub}>{row.sub}</span>
                    </span>
                    <button
                      type="button"
                      disabled={busyKey === row.key}
                      onClick={() => onAdd({ ...row.payload }, row.label, row.key)}
                      className={`mt-auto h-10 w-full rounded-full text-[13px] font-extrabold transition-[transform,filter] duration-150 hover:brightness-95 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] disabled:opacity-60 ${addedKeys.has(row.key) ? 'bg-emerald-100 text-emerald-800' : 'bg-[#facc15] text-[#12315f]'}`}
                    >
                      {addedKeys.has(row.key) ? 'Sumar otra' : 'Agregar'}
                    </button>
                  </li>
                ))}
              </ul>
              {results.length > visible && (
                <button type="button" onClick={() => setVisible((value) => value + PAGE)} className="mt-2 h-11 w-full rounded-full border-2 border-[#12315f]/20 text-sm font-bold text-[#12315f]">Ver más resultados</button>
              )}
              {moreEditions && results.length <= visible && (
                <button type="button" onClick={scanMoreEditions} disabled={searching} className="mt-2 h-11 w-full rounded-full border-2 border-[#12315f]/20 text-sm font-bold text-[#12315f] disabled:opacity-60">
                  {searching ? 'Buscando…' : 'Buscar en ediciones anteriores'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
