import React, { useEffect, useMemo, useState } from 'react';
import ThemedSelect from '../../ui/ThemedSelect';
import {
  EMPTY_MAGIC_FILTERS, MAGIC_COLLECTIONS, MAGIC_COLORS, MAGIC_COLOR_MODES, MAGIC_FORMAT_LABELS, MAGIC_MV, MAGIC_RARITIES,
  MAGIC_STATS, MAGIC_SUPERTYPES, MAGIC_TYPES, MAGIC_VERSIONS, countMagicFilters, loadMagicMeta,
} from '../../../services/tcgcsvMagic';

const compact = '!h-10 !min-h-10 !rounded-xl !text-[13px]';
const any = (label) => ({ value: '', label });

export default function MagicFilters({ searchQuery, setSearchQuery, filters, setFilters, searchSet, availableSets, onSelectSet, loadedCards = [] }) {
  const [meta, setMeta] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { loadMagicMeta().then(setMeta); }, []);

  const set = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
  const active = countMagicFilters(filters);
  const moreKeys = ['subtype', 'keyword', 'format', 'power', 'toughness', 'supertype', 'version', 'collection', 'text'];
  const moreActive = moreKeys.filter((key) => filters[key] !== '').length + (filters.identity ? 1 : 0) + (filters.commander ? 1 : 0);

  // Subtipos y habilidades: la lista completa viene de Scryfall; los subtipos que aparezcan en las cartas cargadas se suman
  const subtypeOptions = useMemo(() => {
    const names = new Set(meta?.subtypes || []);
    loadedCards.forEach((card) => (card.extData?.magic?.subtypes || []).forEach((name) => names.add(name)));
    return [any('Todos los subtipos'), ...[...names].sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name }))];
  }, [meta, loadedCards]);
  const keywordOptions = useMemo(() => [any('Todas las habilidades'), ...(meta?.keywords || []).map((name) => ({ value: name, label: name }))], [meta]);
  const formatOptions = useMemo(() => [any('Formato legal'), ...(meta?.formats || Object.keys(MAGIC_FORMAT_LABELS)).map((name) => ({ value: name, label: MAGIC_FORMAT_LABELS[name] || name }))], [meta]);

  const toggleColor = (color) => set({ colors: filters.colors.includes(color) ? filters.colors.filter((item) => item !== color) : [...filters.colors, color] });
  const stat = (label, key) => (
    <ThemedSelect value={filters[key]} onChange={(value) => set({ [key]: value })} ariaLabel={label} buttonClassName={compact}
      options={[any(label), ...MAGIC_STATS.map((value) => ({ value, label: value === '*' ? `${label} variable (*)` : `${label} ${value}` }))]} />
  );

  return (
    <div className="relative w-full rounded-2xl border-2 border-blue-900/10 bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.08)] sm:p-3">
      <div className="flex flex-col gap-2.5 p-1 sm:gap-3 sm:p-1.5">
        <div className="group relative w-full">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-blue-900 transition-colors group-focus-within:text-yellow-500">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Nombre, número o tipo de carta..."
            className="w-full rounded-xl border-2 border-blue-900/20 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-semibold text-blue-900 placeholder-blue-900/50 shadow-sm outline-none transition-all focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-400/20"
          />
        </div>

        {/* Colores (W U B R G) e incoloro; el modo dice cómo se comparan */}
        <div className="flex flex-wrap items-center gap-2">
          {MAGIC_COLORS.map((color) => {
            const on = filters.colors.includes(color.value);
            return (
              <button
                key={color.value}
                type="button"
                aria-pressed={on}
                aria-label={color.label}
                title={color.label}
                onClick={() => toggleColor(color.value)}
                className={`relative h-10 w-10 rounded-full shadow-sm outline-none transition-[transform,opacity,filter] focus-visible:ring-2 focus-visible:ring-blue-900 active:scale-90 sm:h-11 sm:w-11 ${on ? 'scale-110 ring-2 ring-blue-900 ring-offset-2' : 'opacity-60 saturate-75 hover:scale-105 hover:opacity-100'}`}
              >
                <img src={`/images/magic/${color.value}.webp`} alt="" width="44" height="44" draggable="false" className="h-full w-full select-none rounded-full" />
              </button>
            );
          })}
          {filters.colors.length > 0 && (
            <ThemedSelect className="w-32" value={filters.colorMode} onChange={(value) => set({ colorMode: value })} ariaLabel="Cómo comparar los colores" buttonClassName="!h-9 !min-h-9 !rounded-full !text-xs" options={MAGIC_COLOR_MODES} />
          )}
        </div>

        {/* Tipo, edición, rareza y valor de maná */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ThemedSelect value={filters.type} onChange={(value) => set({ type: value })} ariaLabel="Tipo de carta" buttonClassName={compact} options={[any('Tipo'), ...MAGIC_TYPES]} />
          <ThemedSelect value={filters.rarity} onChange={(value) => set({ rarity: value })} ariaLabel="Rareza" buttonClassName={compact} listMinWidth={190} options={[any('Rareza'), ...MAGIC_RARITIES]} />
          <ThemedSelect value={filters.mv} onChange={(value) => set({ mv: value })} ariaLabel="Valor de maná" buttonClassName={compact} options={[any('Valor de maná'), ...MAGIC_MV.map((value) => ({ value, label: `Maná ${value}` }))]} />
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
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">tune</span>
            Más filtros
            {moreActive > 0 && <span className="rounded-full bg-blue-900 px-2 py-0.5 text-[11px] text-yellow-400">{moreActive}</span>}
          </span>
          <span translate="no" aria-hidden="true" className={`material-symbols-outlined text-[22px] transition-transform ${moreOpen ? 'rotate-180' : ''}`}>expand_more</span>
        </button>

        {moreOpen && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <input
              type="text"
              value={filters.text}
              onChange={(event) => set({ text: event.target.value })}
              placeholder="Texto de reglas (en inglés)..."
              aria-label="Texto de reglas"
              className="col-span-2 h-10 rounded-xl border-2 border-blue-900/20 bg-slate-50 px-3 text-[13px] font-semibold text-blue-900 placeholder-blue-900/50 outline-none transition-all focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-400/20 sm:col-span-3"
            />
            <ThemedSelect className="col-span-2 sm:col-span-1" value={filters.subtype} onChange={(value) => set({ subtype: value })} searchable searchPlaceholder="Escribe un subtipo..." ariaLabel="Subtipo" buttonClassName={compact} listMinWidth={240} options={subtypeOptions} />
            <ThemedSelect className="col-span-2 sm:col-span-1" value={filters.keyword} onChange={(value) => set({ keyword: value })} searchable searchPlaceholder="Escribe una habilidad..." ariaLabel="Habilidad clave" buttonClassName={compact} listMinWidth={240} options={keywordOptions} />
            <ThemedSelect className="col-span-2 sm:col-span-1" value={filters.format} onChange={(value) => set({ format: value })} ariaLabel="Formato legal" buttonClassName={compact} options={formatOptions} />
            {stat('Fuerza', 'power')}
            {stat('Resistencia', 'toughness')}
            <ThemedSelect value={filters.supertype} onChange={(value) => set({ supertype: value })} ariaLabel="Supertipo" buttonClassName={compact} options={[any('Supertipo'), ...MAGIC_SUPERTYPES]} />
            <ThemedSelect value={filters.version} onChange={(value) => set({ version: value })} ariaLabel="Versión de la carta" buttonClassName={compact} listMinWidth={220} options={[any('Versión'), ...MAGIC_VERSIONS]} />
            <ThemedSelect value={filters.collection} onChange={(value) => set({ collection: value })} ariaLabel="Línea de producto" buttonClassName={compact} listMinWidth={230} options={[any('Producto'), ...MAGIC_COLLECTIONS]} />
            <button
              type="button"
              aria-pressed={filters.commander}
              onClick={() => set({ commander: !filters.commander })}
              className={`col-span-2 h-10 rounded-xl border-2 px-3 text-[13px] font-extrabold transition-colors sm:col-span-3 ${filters.commander ? 'border-blue-900 bg-blue-900 text-yellow-400' : 'border-blue-900/25 bg-white text-blue-900 hover:border-blue-900/50'}`}
            >
              Puede ser comandante
            </button>
            <button
              type="button"
              aria-pressed={filters.identity}
              onClick={() => set({ identity: !filters.identity })}
              className={`col-span-2 h-10 rounded-xl border-2 px-3 text-[13px] font-extrabold transition-colors sm:col-span-3 ${filters.identity ? 'border-blue-900 bg-blue-900 text-yellow-400' : 'border-blue-900/25 bg-white text-blue-900 hover:border-blue-900/50'}`}
            >
              Usar identidad de color (Commander)
            </button>
          </div>
        )}

        {active > 0 && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_MAGIC_FILTERS)}
            className="flex h-9 items-center justify-center gap-1.5 self-start rounded-full border-2 border-red-200 bg-red-50 px-3.5 text-xs font-extrabold text-red-600 transition-colors hover:bg-red-100"
          >
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[18px]">filter_alt_off</span>
            Quitar {active} {active === 1 ? 'filtro' : 'filtros'}
          </button>
        )}
      </div>
    </div>
  );
}
