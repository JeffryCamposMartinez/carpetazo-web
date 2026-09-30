import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../utils/api';
import FolderAddSearchFilters from './folder/filters/FolderAddSearchFilters';
import {
  fetchPokemonGroupCards,
  fetchPokemonGroups,
  filterPokemonCards,
} from '../utils/tcgcsvPokemon';

// Juegos del sitio. Solo los marcados tienen buscador con filtros; en el resto se escribe la carta a mano.
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

export default function WishlistCardFinder({ onAdd, addedKeys = new Set(), busyKey = '' }) {
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

  // Manual
  const [manualName, setManualName] = useState('');
  const [manualDetail, setManualDetail] = useState('');

  const isPokemon = game === 'Pokémon';
  const isMyl = game === 'Mitos y Leyendas';
  const selectedGame = WISHLIST_GAMES.find((item) => item.name === game);

  const resetFilters = () => {
    setSearchQuery(''); setSearchSet(''); setSelectedSupertype(''); setSelectedType('');
    setSearchBlock(''); setSearchPhysicalProduct(''); setMylType(''); setMylRace(''); setMylCost('');
    setResults([]); setHint(''); setVisible(PAGE);
  };

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

  const manualReady = manualName.trim().length >= 1;
  const addManual = async () => {
    if (!manualReady) return;
    await onAdd({ name: manualName.trim(), detail: manualDetail.trim() || undefined, game }, manualName.trim());
    setManualName(''); setManualDetail('');
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
          El buscador de {game} llegará pronto. Mientras tanto, escribe la carta a mano abajo.
        </p>
      )}

      {selectedGame?.available && (
        <div aria-live="polite">
          {hint && <p className="px-1 text-sm text-slate-500">{hint}</p>}
          {searching && results.length === 0 && <p className="px-1 text-sm text-slate-500">Buscando…</p>}
          {!hint && !searching && results.length === 0 && <p className="px-1 text-sm text-slate-500">No encontramos cartas con esos filtros.</p>}
          {results.length > 0 && (
            <>
              <p className="mb-1.5 px-1 text-xs font-semibold text-slate-500">{results.length.toLocaleString('es-CL')} {results.length === 1 ? 'resultado' : 'resultados'}</p>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {results.slice(0, visible).map((row) => (
                  <li key={row.key} className="flex items-center gap-3 p-2.5">
                    <span className="h-14 w-10 shrink-0 overflow-hidden rounded bg-slate-100">
                      {row.imageUrl && <img src={row.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[#12315f]">{row.label}</span>
                      <span className="block truncate text-xs text-slate-500">{row.sub}</span>
                    </span>
                    <button
                      type="button"
                      disabled={busyKey === row.key}
                      onClick={() => onAdd({ ...row.payload }, row.label, row.key)}
                      className={`h-10 shrink-0 rounded-full px-4 text-sm font-extrabold disabled:opacity-60 ${addedKeys.has(row.key) ? 'bg-emerald-100 text-emerald-800' : 'bg-[#facc15] text-[#12315f]'}`}
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

      <details className="rounded-2xl bg-white ring-1 ring-slate-200" open={!selectedGame?.available}>
        <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 text-sm font-extrabold text-[#12315f]">
          <span translate="no" className="material-symbols-outlined text-[20px]">edit</span>
          ¿No la encuentras? Escríbela a mano
        </summary>
        <div className="space-y-2 px-4 pb-4">
          <input type="text" value={manualName} maxLength={100} onChange={(event) => setManualName(event.target.value)} placeholder="Nombre de la carta" aria-label="Nombre de la carta a mano" className={inputClass} />
          <input type="text" value={manualDetail} maxLength={100} onChange={(event) => setManualDetail(event.target.value)} placeholder="Edición o versión (opcional)" aria-label="Edición o versión" className={inputClass} />
          <button type="button" disabled={!manualReady || busyKey === 'manual'} onClick={addManual} className="h-11 w-full rounded-full bg-[#12315f] text-sm font-extrabold text-white disabled:opacity-40">
            Agregar a mi lista
          </button>
        </div>
      </details>
    </div>
  );
}
