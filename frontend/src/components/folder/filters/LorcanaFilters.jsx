import React, { useEffect, useMemo, useState } from 'react';
import ThemedSelect from '../../ui/ThemedSelect';
import {
  EMPTY_LC_FILTERS, LC_COLLECTIONS, LC_COSTS, LC_INKS, LC_INK_MODES, LC_INKWELL, LC_LORE, LC_RARITIES, LC_STATS, LC_TYPES, LC_VERSIONS, LC_WILLPOWER,
  countLorcanaFilters,
} from '../../../services/tcgcsvLorcana';
import SvgIcon from '../../ui/SvgIcon';

const compact = '!h-10 !min-h-10 !rounded-xl !text-[13px]';
const any = (label) => ({ value: '', label });

// Clasificaciones y franquicias: lista fija generada con los datos del catálogo (public/lorcana-lists.json)
let listsCache = null;
const loadLists = () => {
  if (!listsCache) listsCache = fetch('/lorcana-lists.json').then((response) => (response.ok ? response.json() : { classes: [], properties: [] })).catch(() => ({ classes: [], properties: [] }));
  return listsCache;
};

export default function LorcanaFilters({ searchQuery, setSearchQuery, filters, setFilters, searchSet, availableSets, onSelectSet, loadedCards = [], hideSearch = false }) {
  const [lists, setLists] = useState({ classes: [], properties: [] });
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { loadLists().then(setLists); }, []);

  const set = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
  const active = countLorcanaFilters(filters);
  const moreActive = ['strength', 'willpower', 'lore', 'inkwell', 'classification', 'franchise', 'version', 'collection', 'text'].filter((key) => filters[key] !== '').length;

  // Lo que aparezca en las cartas cargadas se suma a la lista fija
  const classOptions = useMemo(() => {
    const names = new Set(lists.classes);
    loadedCards.forEach((card) => (card.extData?.lc?.classes || []).forEach((name) => names.add(name)));
    return [any('Todas las clasificaciones'), ...[...names].sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name }))];
  }, [lists, loadedCards]);
  const franchiseOptions = useMemo(() => {
    const names = new Set(lists.properties);
    loadedCards.forEach((card) => { const name = card.extData?.lc?.franchise; if (name) names.add(name); });
    return [any('Todas las franquicias'), ...[...names].sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name }))];
  }, [lists, loadedCards]);

  const toggleInk = (ink) => set({ inks: filters.inks.includes(ink) ? filters.inks.filter((item) => item !== ink) : [...filters.inks, ink] });

  return (
    <div className="relative w-full rounded-2xl border-2 border-blue-900/10 bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.08)] sm:p-3">
      <div className="flex flex-col gap-2.5 p-1 sm:gap-3 sm:p-1.5">
        {!hideSearch && (
          <div className="group relative w-full">
            <SvgIcon name="search" translate="no" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-blue-900 transition-colors group-focus-within:text-yellow-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Nombre, número o clasificación (Elsa, Hero)..."
              className="w-full rounded-xl border-2 border-blue-900/20 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-semibold text-blue-900 placeholder-blue-900/50 shadow-sm outline-none transition-all focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-400/20"
            />
          </div>
        )}

        {/* Tintas: se pueden elegir varias; el modo dice cómo se comparan (hay cartas de dos tintas) */}
        <div className="flex flex-wrap items-center gap-2">
          {LC_INKS.map((ink) => {
            const on = filters.inks.includes(ink.value);
            return (
              <button
                key={ink.value}
                type="button"
                aria-pressed={on}
                aria-label={ink.label}
                title={ink.label}
                onClick={() => toggleInk(ink.value)}
                style={{ backgroundColor: ink.color }}
                className={`relative flex h-11 w-11 items-center justify-center rounded-full text-white shadow-sm outline-none ring-1 ring-black/10 transition-[transform,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-blue-900 active:scale-90 ${on ? 'scale-110 ring-[3px] ring-[#facc15] ring-offset-2 ring-offset-white' : 'opacity-80 [@media(hover:hover)]:hover:scale-110 [@media(hover:hover)]:hover:opacity-100'}`}
              >
                {on ? <SvgIcon name="check" translate="no" aria-hidden="true" className="text-[20px] drop-shadow" /> : <span aria-hidden="true" className="text-[11px] font-black drop-shadow">{ink.label.slice(0, 3)}</span>}
              </button>
            );
          })}
          {filters.inks.length > 0 && (
            <ThemedSelect className="w-32" value={filters.inkMode} onChange={(value) => set({ inkMode: value })} ariaLabel="Cómo comparar las tintas" buttonClassName="!h-9 !min-h-9 !rounded-full !text-xs" options={LC_INK_MODES} />
          )}
        </div>

        {/* Tipo, rareza, coste y edición */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ThemedSelect value={filters.type} onChange={(value) => set({ type: value })} ariaLabel="Tipo de carta" buttonClassName={compact} listMinWidth={200} options={[any('Tipo'), ...LC_TYPES]} />
          <ThemedSelect value={filters.rarity} onChange={(value) => set({ rarity: value })} ariaLabel="Rareza" buttonClassName={compact} listMinWidth={210} options={[any('Rareza'), ...LC_RARITIES]} />
          <ThemedSelect value={filters.cost} onChange={(value) => set({ cost: value })} ariaLabel="Coste de tinta" buttonClassName={compact} options={[any('Coste'), ...LC_COSTS.map((value) => ({ value, label: `Coste ${value}` }))]} />
          <ThemedSelect
            className="col-span-2 sm:col-span-1"
            value={searchSet}
            onChange={onSelectSet}
            searchable
            searchPlaceholder="Escribe una edición..."
            ariaLabel="Edición"
            listMinWidth={300}
            buttonClassName={compact}
            options={[any('Todas las ediciones'), ...availableSets.map((item) => ({ value: item.groupId, label: item.name }))]}
          />
        </div>

        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          className="flex h-10 w-full items-center justify-between rounded-xl border-2 border-blue-900/15 bg-slate-50 px-3 text-[13px] font-extrabold text-blue-900 transition-colors hover:border-blue-900/35"
        >
          <span className="flex items-center gap-2">
            <SvgIcon name="tune" translate="no" aria-hidden="true" className="text-[20px]" />
            Más filtros
            {moreActive > 0 && <span className="rounded-full bg-blue-900 px-2 py-0.5 text-[11px] text-yellow-400">{moreActive}</span>}
          </span>
          <SvgIcon name="expand_more" translate="no" aria-hidden="true" className={`text-[22px] transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
        </button>

        {moreOpen && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <input
              type="text"
              value={filters.text}
              onChange={(event) => set({ text: event.target.value })}
              placeholder="Texto de la carta (en inglés)..."
              aria-label="Texto de la carta"
              className="col-span-2 h-10 rounded-xl border-2 border-blue-900/20 bg-slate-50 px-3 text-[13px] font-semibold text-blue-900 placeholder-blue-900/50 outline-none transition-all focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-400/20 sm:col-span-3"
            />
            <ThemedSelect className="col-span-2 sm:col-span-3" value={filters.classification} onChange={(value) => set({ classification: value })} searchable searchPlaceholder="Escribe una clasificación (Hero, Storyborn)..." ariaLabel="Clasificación" buttonClassName={compact} listMinWidth={240} options={classOptions} />
            <ThemedSelect className="col-span-2 sm:col-span-3" value={filters.franchise} onChange={(value) => set({ franchise: value })} searchable searchPlaceholder="Escribe una franquicia (Frozen, Moana)..." ariaLabel="Franquicia" buttonClassName={compact} listMinWidth={260} options={franchiseOptions} />
            <ThemedSelect value={filters.strength} onChange={(value) => set({ strength: value })} ariaLabel="Fuerza" buttonClassName={compact} options={[any('Fuerza'), ...LC_STATS.map((value) => ({ value, label: `Fuerza ${value}` }))]} />
            <ThemedSelect value={filters.willpower} onChange={(value) => set({ willpower: value })} ariaLabel="Voluntad" buttonClassName={compact} options={[any('Voluntad'), ...LC_WILLPOWER.map((value) => ({ value, label: `Voluntad ${value}` }))]} />
            <ThemedSelect value={filters.lore} onChange={(value) => set({ lore: value })} ariaLabel="Lore" buttonClassName={compact} options={[any('Lore'), ...LC_LORE.map((value) => ({ value, label: `Lore ${value}` }))]} />
            <ThemedSelect value={filters.inkwell} onChange={(value) => set({ inkwell: value })} ariaLabel="Tintero" buttonClassName={compact} options={[any('Tintero'), ...LC_INKWELL]} />
            <ThemedSelect value={filters.version} onChange={(value) => set({ version: value })} ariaLabel="Versión de la carta" buttonClassName={compact} listMinWidth={210} options={[any('Versión'), ...LC_VERSIONS]} />
            <ThemedSelect value={filters.collection} onChange={(value) => set({ collection: value })} ariaLabel="Línea de producto" buttonClassName={compact} listMinWidth={230} options={[any('Producto'), ...LC_COLLECTIONS]} />
          </div>
        )}

        {active > 0 && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_LC_FILTERS)}
            className="flex h-9 items-center justify-center gap-1.5 self-start rounded-full border-2 border-red-200 bg-red-50 px-3.5 text-xs font-extrabold text-red-600 transition-colors hover:bg-red-100"
          >
            <SvgIcon name="filter_alt_off" translate="no" aria-hidden="true" className="text-[18px]" />
            Quitar {active} {active === 1 ? 'filtro' : 'filtros'}
          </button>
        )}
      </div>
    </div>
  );
}
