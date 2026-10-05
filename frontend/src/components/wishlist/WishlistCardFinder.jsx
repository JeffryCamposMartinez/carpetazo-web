import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/api';
import FolderAddSearchFilters from '../folder/filters/FolderAddSearchFilters';
import {
  fetchPokemonGroupCards,
  fetchPokemonGroups,
  filterPokemonCards,
} from '../../services/tcgcsvPokemon';

// Juegos del sitio. Solo los marcados tienen buscador con filtros; el resto llegará pronto.
export const WISHLIST_GAMES = [
  { name: 'Pokémon', available: true },
  { name: 'Mitos y Leyendas', available: true },
  { name: 'One Piece', available: false },
  { name: 'Magic', available: false },
  { name: 'Yu-Gi-Oh!', available: false },
  { name: 'Riftbound', available: false },
];

const MYL_CATEGORY = '99';
const SCAN_BATCH = 6; // ediciones de Pokémon que se revisan por vez cuando no se elige una
const PAGE = 20;

const cardLabel = (name, number) => (number && !name.includes(number) ? `${name} - ${number}` : name);

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
  const [pokemonGroups, setPokemonGroups] = useState([]);
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

  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [moreEditions, setMoreEditions] = useState(false);
  const [hint, setHint] = useState('');
  const seq = useRef(0);

  const isPokemon = game === 'Pokémon';
  const isMyl = game === 'Mitos y Leyendas';
  const selectedGame = WISHLIST_GAMES.find((item) => item.name === game);

  const resetFilters = () => {
    setSearchQuery(''); setSearchSet(''); setSelectedSupertype(''); setSelectedType('');
    setSearchBlock(''); setSearchPhysicalProduct(''); setMylType(''); setMylRace(''); setMylCost('');
    setResults([]); setHint(''); setVisible(PAGE);
  };
  if (resetRef) resetRef.current = resetFilters;

  // Datos de cada juego: ediciones, bloques y productos
  useEffect(() => {
    const controller = new AbortController();
    if (isPokemon) {
      setPokemonGroups([]);
      fetchPokemonGroups(searchLang, controller.signal).then(setPokemonGroups).catch(() => {});
    }
    if (isMyl) {
      api.getTcgBlocks(MYL_CATEGORY).then((res) => { if (res.success) setBlocks(res.data); }).catch(() => {});
      api.getTcgPhysicalProducts().then((res) => { if (res.success) setPhysicalProducts(res.data); }).catch(() => {});
      api.getTcgGroups(MYL_CATEGORY).then((res) => { if (res.success) setMylGroups([...res.data].sort((a, b) => new Date(b.publishedOn || 0) - new Date(a.publishedOn || 0))); }).catch(() => {});
    }
    return () => controller.abort();
  }, [isPokemon, isMyl, searchLang]);

  const availableSets = isPokemon ? pokemonGroups : mylGroups;
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

      // Pokémon
      const filters = { query: term, supertype: selectedSupertype, type: selectedType };
      const toRow = (card) => ({
        key: `tcgcsv:${card.catId}:${card.productId}`,
        payload: { external: { categoryId: card.catId, productId: card.productId }, name: cardLabel(card.name, card.number), imageUrl: card.imageUrl, detail: `${card.setName} · ${card.language}`, game: 'Pokémon' },
        label: cardLabel(card.name, card.number),
        sub: `${card.setName} · ${card.language}`,
        imageUrl: card.imageUrl,
      });
      setMoreEditions(false);
      if (searchSet) {
        const group = pokemonGroups.find((item) => String(item.groupId) === String(searchSet));
        if (!group) return;
        setHint(''); setSearching(true);
        try {
          const cards = filterPokemonCards(await fetchPokemonGroupCards(searchLang, group, controller.signal), filters);
          if (mine === seq.current) setResults(cards.map(toRow));
        } catch (_error) {
          if (mine === seq.current) setResults([]);
        } finally {
          if (mine === seq.current) setSearching(false);
        }
        return;
      }
      if (term.length < 2) { setResults([]); setHint('Elige una edición o escribe el nombre de la carta.'); return; }
      if (pokemonGroups.length === 0) return;
      // Sin edición: se revisan las más nuevas primero, de a varias por vez
      setHint(''); setSearching(true); scanned.current = 0;
      try {
        const found = [];
        const batch = pokemonGroups.slice(0, SCAN_BATCH);
        const lists = await Promise.all(batch.map((group) => fetchPokemonGroupCards(searchLang, group, controller.signal).catch(() => [])));
        lists.forEach((list) => found.push(...filterPokemonCards(list, filters)));
        scanned.current = batch.length;
        if (mine === seq.current) { setResults(found.map(toRow)); setMoreEditions(pokemonGroups.length > batch.length); }
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    };

    const timer = setTimeout(run, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [game, searchQuery, searchSet, searchLang, selectedSupertype, selectedType, pokemonGroups, mylFilters]);

  const scanMoreEditions = async () => {
    const term = searchQuery.trim();
    const filters = { query: term, supertype: selectedSupertype, type: selectedType };
    const batch = pokemonGroups.slice(scanned.current, scanned.current + SCAN_BATCH);
    if (batch.length === 0) return;
    setSearching(true);
    const mine = seq.current;
    try {
      const lists = await Promise.all(batch.map((group) => fetchPokemonGroupCards(searchLang, group).catch(() => [])));
      const extra = lists.flatMap((list) => filterPokemonCards(list, filters)).map((card) => ({
        key: `tcgcsv:${card.catId}:${card.productId}`,
        payload: { external: { categoryId: card.catId, productId: card.productId }, name: cardLabel(card.name, card.number), imageUrl: card.imageUrl, detail: `${card.setName} · ${card.language}`, game: 'Pokémon' },
        label: cardLabel(card.name, card.number),
        sub: `${card.setName} · ${card.language}`,
        imageUrl: card.imageUrl,
      }));
      if (mine !== seq.current) return;
      scanned.current += batch.length;
      setResults((previous) => [...previous, ...extra]);
      setMoreEditions(scanned.current < pokemonGroups.length);
    } finally {
      setSearching(false);
    }
  };

  const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#facc15]/70';

  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold text-slate-600">
        Juego
        <select
          value={game}
          onChange={(event) => { setGame(event.target.value); resetFilters(); }}
          aria-label="Juego de la carta"
          className={`${inputClass} mt-1 h-12 font-extrabold text-[#12315f]`}
        >
          {WISHLIST_GAMES.map((item) => <option key={item.name} value={item.name}>{item.name}{item.available ? '' : ' (buscador próximamente)'}</option>)}
        </select>
      </label>

      {selectedGame?.available && (
        <div className="rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-200">
          <FolderAddSearchFilters
            availableBlocks={blocks}
            tcg={game}
            searchCategory={isMyl ? MYL_CATEGORY : '1'}
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
                    <span className="block aspect-[5/7] w-full overflow-hidden rounded-lg bg-slate-100">
                      {row.imageUrl ? <img src={row.imageUrl} alt={row.label} loading="lazy" className="h-full w-full object-contain" /> : <span className="flex h-full items-center justify-center px-1 text-center text-[11px] font-semibold text-slate-500">Sin imagen</span>}
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
