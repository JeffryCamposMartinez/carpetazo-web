import React, { useEffect, useMemo, useState } from 'react';
import ThemedSelect from '../../ui/ThemedSelect';
import {
  DG_ATTRIBUTES, DG_COLLECTIONS, DG_COLORS, DG_COLOR_MODES, DG_COSTS, DG_DP, DG_FORMS, DG_LEVELS, DG_RARITIES, DG_TYPES, DG_VERSIONS,
  EMPTY_DG_FILTERS, countDigimonFilters,
} from '../../../services/tcgcsvDigimon';
import SvgIcon from '../../ui/SvgIcon';

const compact = '!h-10 !min-h-10 !rounded-xl !text-[13px]';
const any = (label) => ({ value: '', label });

// Tipos de Digimon (Dragon, Royal Knight, X Antibody...): lista fija generada con los datos del catálogo (public/digimon-types.json)
let typesCache = null;
const loadTypes = () => {
  if (!typesCache) typesCache = fetch('/digimon-types.json').then((response) => (response.ok ? response.json() : [])).catch(() => []);
  return typesCache;
};

export default function DigimonFilters({ searchQuery, setSearchQuery, filters, setFilters, searchSet, availableSets, onSelectSet, loadedCards = [], hideSearch = false }) {
  const [types, setTypes] = useState([]);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { loadTypes().then(setTypes); }, []);

  const set = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
  const active = countDigimonFilters(filters);
  const moreActive = ['dp', 'form', 'attribute', 'trait', 'version', 'collection', 'text'].filter((key) => filters[key] !== '').length;

  // Los tipos nuevos (de ediciones que aún no están en la lista fija) se suman a medida que se cargan cartas
  const traitOptions = useMemo(() => {
    const names = new Set(types);
    loadedCards.forEach((card) => (card.extData?.dg?.traits || []).forEach((name) => names.add(name)));
    return [any('Todos los tipos'), ...[...names].sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name }))];
  }, [types, loadedCards]);

  const toggleColor = (color) => set({ colors: filters.colors.includes(color) ? filters.colors.filter((item) => item !== color) : [...filters.colors, color] });

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
              placeholder="Nombre, código (BT1-001) o tipo (Dragon)..."
              className="w-full rounded-xl border-2 border-blue-900/20 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-semibold text-blue-900 placeholder-blue-900/50 shadow-sm outline-none transition-all focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-400/20"
            />
          </div>
        )}

        {/* Colores: se pueden elegir varios; el modo dice cómo se comparan (hay cartas de dos colores) */}
        <div className="flex flex-wrap items-center gap-2">
          {DG_COLORS.map((color) => {
            const on = filters.colors.includes(color.value);
            return (
              <button
                key={color.value}
                type="button"
                aria-pressed={on}
                aria-label={color.label}
                title={color.label}
                onClick={() => toggleColor(color.value)}
                className={`relative h-12 w-12 shrink-0 rounded-full outline-none transition-[transform,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2 active:scale-90 ${on ? 'scale-110 ring-[3px] ring-[#facc15] ring-offset-2 ring-offset-white' : 'opacity-80 [@media(hover:hover)]:hover:scale-110 [@media(hover:hover)]:hover:opacity-100'}`}
              >
                <img src={color.icon} alt="" loading="lazy" draggable="false" className="h-full w-full rounded-full object-cover drop-shadow-sm" />
                {on && <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1e40af] text-white ring-2 ring-white"><SvgIcon name="check" translate="no" aria-hidden="true" className="text-[13px]" /></span>}
              </button>
            );
          })}
          {filters.colors.length > 0 && (
            <ThemedSelect className="w-32" value={filters.colorMode} onChange={(value) => set({ colorMode: value })} ariaLabel="Cómo comparar los colores" buttonClassName="!h-9 !min-h-9 !rounded-full !text-xs" options={DG_COLOR_MODES} />
          )}
        </div>

        {/* Tipo de carta, rareza, nivel y edición */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ThemedSelect value={filters.type} onChange={(value) => set({ type: value })} ariaLabel="Tipo de carta" buttonClassName={compact} listMinWidth={200} options={[any('Tipo'), ...DG_TYPES]} />
          <ThemedSelect value={filters.rarity} onChange={(value) => set({ rarity: value })} ariaLabel="Rareza" buttonClassName={compact} options={[any('Rareza'), ...DG_RARITIES]} />
          <ThemedSelect value={filters.level} onChange={(value) => set({ level: value })} ariaLabel="Nivel" buttonClassName={compact} options={[any('Nivel'), ...DG_LEVELS.map((value) => ({ value, label: `Nivel ${value}` }))]} />
          <ThemedSelect
            className="col-span-2 sm:col-span-1"
            value={searchSet}
            onChange={onSelectSet}
            searchable
            searchPlaceholder="Escribe una edición..."
            ariaLabel="Edición"
            listMinWidth={320}
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
            <ThemedSelect className="col-span-2 sm:col-span-3" value={filters.trait} onChange={(value) => set({ trait: value })} searchable searchPlaceholder="Escribe un tipo (Dragon, Royal Knight)..." ariaLabel="Tipo de Digimon" buttonClassName={compact} listMinWidth={260} options={traitOptions} />
            <ThemedSelect value={filters.cost} onChange={(value) => set({ cost: value })} ariaLabel="Coste de jugar" buttonClassName={compact} options={[any('Coste'), ...DG_COSTS.map((value) => ({ value, label: `Coste ${value}` }))]} />
            <ThemedSelect value={filters.dp} onChange={(value) => set({ dp: value })} ariaLabel="Poder (DP)" buttonClassName={compact} options={[any('DP'), ...DG_DP.map((value) => ({ value, label: `DP ${Number(value).toLocaleString('es-CL')}` }))]} />
            <ThemedSelect value={filters.form} onChange={(value) => set({ form: value })} ariaLabel="Forma" buttonClassName={compact} listMinWidth={200} options={[any('Forma'), ...DG_FORMS]} />
            <ThemedSelect value={filters.attribute} onChange={(value) => set({ attribute: value })} ariaLabel="Atributo" buttonClassName={compact} options={[any('Atributo'), ...DG_ATTRIBUTES]} />
            <ThemedSelect value={filters.version} onChange={(value) => set({ version: value })} ariaLabel="Versión de la carta" buttonClassName={compact} listMinWidth={230} options={[any('Versión'), ...DG_VERSIONS]} />
            <ThemedSelect className="col-span-2 sm:col-span-1" value={filters.collection} onChange={(value) => set({ collection: value })} ariaLabel="Línea de producto" buttonClassName={compact} listMinWidth={230} options={[any('Producto'), ...DG_COLLECTIONS]} />
          </div>
        )}

        {active > 0 && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_DG_FILTERS)}
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
