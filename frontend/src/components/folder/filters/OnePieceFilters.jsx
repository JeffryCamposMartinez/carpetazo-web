import React, { useEffect, useMemo, useState } from 'react';
import LiquidTabs from '../../ui/LiquidTabs';
import ThemedSelect from '../../ui/ThemedSelect';
import {
  EMPTY_OP_FILTERS, OP_ATTRIBUTES, OP_CARD_TYPES, OP_COLLECTIONS, OP_COLORS, OP_COSTS, OP_COUNTERS, OP_LIFES,
  OP_POWERS, OP_RARITIES, OP_VARIANTS, countOnePieceFilters,
} from '../../../services/tcgcsvOnePiece';

const compact = '!h-10 !min-h-10 !rounded-xl !text-[13px]';
const any = (label) => ({ value: '', label });

// Familias (Straw Hat Crew, Navy…): lista fija generada con scripts/catalog/build_onepiece_families.cjs
let familiesCache = null;
const loadFamilies = () => {
  if (!familiesCache) familiesCache = fetch('/onepiece-families.json').then((response) => (response.ok ? response.json() : [])).catch(() => []);
  return familiesCache;
};

export default function OnePieceFilters({ searchQuery, setSearchQuery, filters, setFilters, searchSet, availableSets, onSelectSet, loadedCards = [] }) {
  const [families, setFamilies] = useState([]);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { loadFamilies().then(setFamilies); }, []);

  const set = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
  const active = countOnePieceFilters(filters);
  const moreActive = ['power', 'counter', 'attribute', 'family', 'variant', 'collection', 'life'].filter((key) => filters[key] !== '').length;

  // Las familias nuevas (de ediciones que aún no están en la lista fija) se suman a medida que se cargan cartas
  const familyOptions = useMemo(() => {
    const names = new Set(families);
    loadedCards.forEach((card) => (card.extData?.op?.families || []).forEach((family) => names.add(family)));
    return [any('Todas las familias'), ...[...names].sort((a, b) => a.localeCompare(b)).map((family) => ({ value: family, label: family }))];
  }, [families, loadedCards]);

  const toggleColor = (color) => set({ colors: filters.colors.includes(color) ? filters.colors.filter((item) => item !== color) : [...filters.colors, color] });

  return (
    <div className="relative w-full rounded-2xl border-2 border-blue-900/10 bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.08)] sm:p-3">
      <div className="flex flex-col gap-2.5 p-1 sm:gap-3 sm:p-1.5">
        {/* Búsqueda: nombre, código (OP08-001) o familia */}
        <div className="group relative w-full">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-blue-900 transition-colors group-focus-within:text-yellow-500">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Nombre, código (OP08-001) o familia..."
            className="w-full rounded-xl border-2 border-blue-900/20 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-semibold text-blue-900 placeholder-blue-900/50 shadow-sm outline-none transition-all focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-400/20"
          />
        </div>

        {/* Colores: se pueden elegir varios (cartas de cualquiera de ellos) */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {OP_COLORS.map((color) => {
              const on = filters.colors.includes(color.value);
              return (
                <button
                  key={color.value}
                  type="button"
                  aria-pressed={on}
                  aria-label={color.label}
                  title={color.label}
                  onClick={() => toggleColor(color.value)}
                  style={{ backgroundColor: color.hex }}
                  className={`flex h-9 w-9 items-center justify-center rounded-full shadow-sm outline-none transition-transform focus-visible:ring-2 focus-visible:ring-blue-900 active:scale-90 sm:h-10 sm:w-10 ${on ? 'scale-110 ring-2 ring-blue-900 ring-offset-2' : 'opacity-85 hover:scale-105 hover:opacity-100'}`}
                >
                  {on && <span translate="no" aria-hidden="true" className={`material-symbols-outlined text-[20px] font-bold ${color.value === 'Yellow' ? 'text-blue-900' : 'text-white'}`}>check</span>}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={filters.multicolor}
              onClick={() => set({ multicolor: !filters.multicolor })}
              className={`h-9 rounded-full border-2 px-3 text-xs font-extrabold transition-colors sm:h-10 ${filters.multicolor ? 'border-blue-900 bg-blue-900 text-yellow-400' : 'border-blue-900/25 bg-white text-blue-900 hover:border-blue-900/50'}`}
            >
              Multicolor
            </button>
          </div>
        </div>

        {/* Tipo de carta */}
        <LiquidTabs
          ariaLabel="Tipo de carta"
          className="w-full overflow-hidden rounded-xl border-2 border-blue-900/10 bg-slate-50 shadow-sm"
          buttonClassName="flex cursor-pointer items-center justify-center px-0.5 py-2.5"
          value={filters.cardType}
          onChange={(value) => set({ cardType: value, ...(value !== 'Leader' && value !== '' ? { life: '' } : {}) })}
          options={OP_CARD_TYPES.map((type) => ({
            value: type.value,
            label: (
              <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-normal sm:text-sm sm:tracking-wider">
                <span className="sm:hidden">{type.short}</span>
                <span className="hidden sm:inline">{type.label}</span>
              </span>
            ),
          }))}
        />

        {/* Edición, rareza y coste */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
          <ThemedSelect value={filters.rarity} onChange={(value) => set({ rarity: value })} ariaLabel="Rareza" buttonClassName={compact} listMinWidth={200} options={[any('Rareza'), ...OP_RARITIES]} />
          <ThemedSelect value={filters.cost} onChange={(value) => set({ cost: value })} ariaLabel="Coste" buttonClassName={compact} options={[any('Coste'), ...OP_COSTS.map((cost) => ({ value: cost, label: `Coste ${cost}` }))]} />
        </div>

        {/* Más filtros */}
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
            <ThemedSelect value={filters.family} onChange={(value) => set({ family: value })} searchable searchPlaceholder="Escribe una familia..." ariaLabel="Familia" className="col-span-2 sm:col-span-3" buttonClassName={compact} listMinWidth={280} options={familyOptions} />
            <ThemedSelect value={filters.attribute} onChange={(value) => set({ attribute: value })} ariaLabel="Atributo" buttonClassName={compact} options={[any('Atributo'), ...OP_ATTRIBUTES]} />
            <ThemedSelect value={filters.power} onChange={(value) => set({ power: value })} ariaLabel="Poder" buttonClassName={compact} options={[any('Poder'), ...OP_POWERS.map((power) => ({ value: power, label: `Poder ${power}` }))]} />
            <ThemedSelect value={filters.counter} onChange={(value) => set({ counter: value })} ariaLabel="Contador" buttonClassName={compact} options={[any('Contador'), ...OP_COUNTERS]} />
            <ThemedSelect value={filters.variant} onChange={(value) => set({ variant: value })} ariaLabel="Versión de la carta" buttonClassName={compact} listMinWidth={200} options={[any('Versión'), ...OP_VARIANTS]} />
            <ThemedSelect value={filters.collection} onChange={(value) => set({ collection: value })} ariaLabel="Línea de producto" buttonClassName={compact} listMinWidth={220} options={[any('Producto'), ...OP_COLLECTIONS]} />
            {(filters.cardType === '' || filters.cardType === 'Leader') && (
              <ThemedSelect value={filters.life} onChange={(value) => set({ life: value })} ariaLabel="Vida del líder" buttonClassName={compact} options={[any('Vida'), ...OP_LIFES.map((life) => ({ value: life, label: `Vida ${life}` }))]} />
            )}
          </div>
        )}

        {active > 0 && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_OP_FILTERS)}
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
