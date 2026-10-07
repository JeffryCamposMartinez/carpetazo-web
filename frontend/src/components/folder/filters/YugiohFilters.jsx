import React, { useEffect, useMemo, useState } from 'react';
import LiquidTabs from '../../ui/LiquidTabs';
import ThemedSelect from '../../ui/ThemedSelect';
import {
  EMPTY_YGO_FILTERS, YGO_ATTRIBUTES, YGO_BANLIST, YGO_COLLECTIONS, YGO_KINDS, YGO_LANGUAGES, YGO_LEVELS, YGO_LINKS, YGO_MONSTER_CATEGORIES,
  YGO_RACES, YGO_RARITIES, YGO_SPELL_CATEGORIES, YGO_STATS, YGO_TRAP_CATEGORIES, YGO_VERSIONS, countYugiohFilters, loadYugiohMeta,
} from '../../../services/tcgcsvYugioh';

const compact = '!h-10 !min-h-10 !rounded-xl !text-[13px]';
const any = (label) => ({ value: '', label });

export default function YugiohFilters({ searchQuery, setSearchQuery, filters, setFilters, searchSet, availableSets, onSelectSet, loadedCards = [] }) {
  const [meta, setMeta] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { loadYugiohMeta().then(setMeta); }, []);

  const set = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
  const active = countYugiohFilters(filters);
  const moreKeys = ['race', 'level', 'atk', 'def', 'link', 'scale', 'archetype', 'banlist', 'language', 'version', 'collection', 'text'];
  const moreActive = moreKeys.filter((key) => filters[key] !== '').length;
  const showMonster = filters.kind === '' || filters.kind === 'Monster';

  const categoryOptions = filters.kind === 'Spell' ? YGO_SPELL_CATEGORIES : filters.kind === 'Trap' ? YGO_TRAP_CATEGORIES : YGO_MONSTER_CATEGORIES;
  const categoryLabel = filters.kind === 'Spell' ? 'Tipo de mágica' : filters.kind === 'Trap' ? 'Tipo de trampa' : 'Categoría';

  // Las rarezas conocidas más las que aparezcan en las cartas cargadas (hay muchas y salen nuevas)
  const rarityOptions = useMemo(() => {
    const known = new Map(YGO_RARITIES.map((item) => [item.value, item.label]));
    loadedCards.forEach((card) => { const value = card.extData?.Rarity; if (value && !known.has(value)) known.set(value, value); });
    return [any('Rareza'), ...[...known].map(([value, label]) => ({ value, label }))];
  }, [loadedCards]);
  const archetypeOptions = useMemo(() => [any('Todos los arquetipos'), ...(meta?.archetypes || []).map((name) => ({ value: name, label: name }))], [meta]);

  const toggleAttribute = (attribute) => set({ attributes: filters.attributes.includes(attribute) ? filters.attributes.filter((item) => item !== attribute) : [...filters.attributes, attribute] });

  return (
    <div className="relative w-full rounded-2xl border-2 border-blue-900/10 bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.08)] sm:p-3">
      <div className="flex flex-col gap-2.5 p-1 sm:gap-3 sm:p-1.5">
        <div className="group relative w-full">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-blue-900 transition-colors group-focus-within:text-yellow-500">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Nombre, código (SDMY-EN001) o arquetipo..."
            className="w-full rounded-xl border-2 border-blue-900/20 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-semibold text-blue-900 placeholder-blue-900/50 shadow-sm outline-none transition-all focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-400/20"
          />
        </div>

        {/* Monstruo, mágica o trampa */}
        <LiquidTabs
          ariaLabel="Tipo de carta"
          className="w-full overflow-hidden rounded-xl border-2 border-blue-900/10 bg-slate-50 shadow-sm"
          buttonClassName="flex cursor-pointer items-center justify-center px-0.5 py-2.5"
          value={filters.kind}
          onChange={(value) => set({ kind: value, category: '', ...(value === 'Spell' || value === 'Trap' ? { attributes: [], race: '', level: '', scale: '', link: '', atk: '', def: '' } : {}) })}
          options={YGO_KINDS.map((kind) => ({
            value: kind.value,
            label: <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-normal sm:text-sm sm:tracking-wider">{kind.label}</span>,
          }))}
        />

        {/* Atributo (solo monstruos) */}
        {showMonster && (
          <div className="flex flex-wrap items-center gap-2">
            {YGO_ATTRIBUTES.map((attribute) => {
              const on = filters.attributes.includes(attribute.value);
              return (
                <button
                  key={attribute.value}
                  type="button"
                  aria-pressed={on}
                  aria-label={attribute.label}
                  title={attribute.label}
                  onClick={() => toggleAttribute(attribute.value)}
                  style={{ backgroundColor: attribute.hex }}
                  className={`flex h-10 min-w-[2.5rem] items-center justify-center rounded-full px-2.5 text-[11px] font-black text-white shadow-sm outline-none transition-[transform,opacity] focus-visible:ring-2 focus-visible:ring-blue-900 active:scale-90 ${on ? 'scale-105 ring-2 ring-blue-900 ring-offset-2' : 'opacity-70 hover:scale-105 hover:opacity-100'}`}
                >
                  {on ? <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[18px]">check</span> : attribute.label.slice(0, 3)}
                </button>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <ThemedSelect value={filters.category} onChange={(value) => set({ category: value })} ariaLabel={categoryLabel} buttonClassName={compact} listMinWidth={200} options={[any(categoryLabel), ...categoryOptions]} />
          <ThemedSelect value={filters.rarity} onChange={(value) => set({ rarity: value })} ariaLabel="Rareza" buttonClassName={compact} listMinWidth={240} options={rarityOptions} />
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
              placeholder="Texto del efecto (en inglés)..."
              aria-label="Texto del efecto"
              className="col-span-2 h-10 rounded-xl border-2 border-blue-900/20 bg-slate-50 px-3 text-[13px] font-semibold text-blue-900 placeholder-blue-900/50 outline-none transition-all focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-400/20 sm:col-span-3"
            />
            <ThemedSelect className="col-span-2 sm:col-span-3" value={filters.archetype} onChange={(value) => set({ archetype: value })} searchable searchPlaceholder="Escribe un arquetipo..." ariaLabel="Arquetipo" buttonClassName={compact} listMinWidth={260} options={archetypeOptions} />
            {showMonster && (
              <>
                <ThemedSelect className="col-span-2 sm:col-span-1" value={filters.race} onChange={(value) => set({ race: value })} searchable searchPlaceholder="Escribe un tipo..." ariaLabel="Tipo de monstruo" buttonClassName={compact} listMinWidth={220} options={[any('Tipo de monstruo'), ...YGO_RACES]} />
                <ThemedSelect value={filters.level} onChange={(value) => set({ level: value })} ariaLabel="Nivel o rango" buttonClassName={compact} options={[any('Nivel / Rango'), ...YGO_LEVELS.map((value) => ({ value, label: `Nivel / Rango ${value}` }))]} />
                <ThemedSelect value={filters.link} onChange={(value) => set({ link: value })} ariaLabel="Enlace" buttonClassName={compact} options={[any('Enlace'), ...YGO_LINKS.map((value) => ({ value, label: `Enlace ${value}` }))]} />
                <ThemedSelect value={filters.atk} onChange={(value) => set({ atk: value })} ariaLabel="ATK" buttonClassName={compact} listMinWidth={180} options={[any('ATK'), ...YGO_STATS.map((item) => ({ value: item.value, label: `ATK ${item.label}` }))]} />
                <ThemedSelect value={filters.def} onChange={(value) => set({ def: value })} ariaLabel="DEF" buttonClassName={compact} listMinWidth={180} options={[any('DEF'), ...YGO_STATS.map((item) => ({ value: item.value, label: `DEF ${item.label}` }))]} />
                <ThemedSelect value={filters.scale} onChange={(value) => set({ scale: value })} ariaLabel="Escala de péndulo" buttonClassName={compact} options={[any('Escala péndulo'), ...YGO_LEVELS.map((value) => ({ value, label: `Escala ${value}` }))]} />
              </>
            )}
            <ThemedSelect value={filters.banlist} onChange={(value) => set({ banlist: value })} ariaLabel="Lista de prohibidas" buttonClassName={compact} listMinWidth={190} options={[any('Lista de prohibidas'), ...YGO_BANLIST]} />
            <ThemedSelect value={filters.language} onChange={(value) => set({ language: value })} ariaLabel="Idioma de la carta" buttonClassName={compact} options={[any('Idioma'), ...YGO_LANGUAGES]} />
            <ThemedSelect value={filters.version} onChange={(value) => set({ version: value })} ariaLabel="Versión de la carta" buttonClassName={compact} listMinWidth={190} options={[any('Versión'), ...YGO_VERSIONS]} />
            <ThemedSelect className="col-span-2 sm:col-span-3" value={filters.collection} onChange={(value) => set({ collection: value })} ariaLabel="Línea de producto" buttonClassName={compact} listMinWidth={230} options={[any('Producto'), ...YGO_COLLECTIONS]} />
          </div>
        )}

        {active > 0 && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_YGO_FILTERS)}
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
