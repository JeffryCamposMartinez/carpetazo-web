import React, { useEffect, useMemo, useState } from 'react';
import ThemedSelect from '../../ui/ThemedSelect';
import {
  EMPTY_RB_FILTERS, RB_COLLECTIONS, RB_DOMAINS, RB_DOMAIN_MODES, RB_ENERGY, RB_MIGHT, RB_POWER, RB_RARITIES, RB_TYPES,
  RB_VERSIONS, countRiftboundFilters,
} from '../../../services/tcgcsvRiftbound';

const compact = '!h-10 !min-h-10 !rounded-xl !text-[13px]';
const any = (label) => ({ value: '', label });

// Etiquetas (regiones, razas, campeones): lista fija generada con scripts/catalog/build_riftbound_tags.cjs
let tagsCache = null;
const loadTags = () => {
  if (!tagsCache) tagsCache = fetch('/riftbound-tags.json').then((response) => (response.ok ? response.json() : [])).catch(() => []);
  return tagsCache;
};

export default function RiftboundFilters({ searchQuery, setSearchQuery, filters, setFilters, searchSet, availableSets, onSelectSet, loadedCards = [] }) {
  const [tags, setTags] = useState([]);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { loadTags().then(setTags); }, []);

  const set = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
  const active = countRiftboundFilters(filters);
  const moreActive = ['tag', 'power', 'might', 'version', 'collection', 'text'].filter((key) => filters[key] !== '').length + (filters.signature ? 1 : 0);

  // Las etiquetas nuevas (de ediciones que aún no están en la lista fija) se suman a medida que se cargan cartas
  const tagOptions = useMemo(() => {
    const names = new Set(tags);
    loadedCards.forEach((card) => (card.extData?.rb?.tags || []).forEach((tag) => names.add(tag)));
    return [any('Todas las etiquetas'), ...[...names].sort((a, b) => a.localeCompare(b)).map((tag) => ({ value: tag, label: tag }))];
  }, [tags, loadedCards]);

  const toggleDomain = (domain) => set({ domains: filters.domains.includes(domain) ? filters.domains.filter((item) => item !== domain) : [...filters.domains, domain] });

  return (
    <div className="relative w-full rounded-2xl border-2 border-blue-900/10 bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.08)] sm:p-3">
      <div className="flex flex-col gap-2.5 p-1 sm:gap-3 sm:p-1.5">
        <div className="group relative w-full">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-blue-900 transition-colors group-focus-within:text-yellow-500">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Nombre, número o etiqueta (Ionia, Ahri)..."
            className="w-full rounded-xl border-2 border-blue-900/20 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-semibold text-blue-900 placeholder-blue-900/50 shadow-sm outline-none transition-all focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-400/20"
          />
        </div>

        {/* Dominios: se pueden elegir varios; el modo dice cómo se comparan */}
        <div className="flex flex-wrap items-center gap-2">
          {RB_DOMAINS.map((domain) => {
            const on = filters.domains.includes(domain.value);
            return (
              <button
                key={domain.value}
                type="button"
                aria-pressed={on}
                aria-label={domain.label}
                title={domain.label}
                onClick={() => toggleDomain(domain.value)}
                className={`relative h-12 w-9 rounded-lg shadow-sm outline-none transition-[transform,opacity,filter] focus-visible:ring-2 focus-visible:ring-blue-900 active:scale-90 sm:h-14 sm:w-[42px] ${on ? '-translate-y-0.5 scale-110 ring-2 ring-blue-900 ring-offset-2' : 'opacity-60 saturate-75 hover:-translate-y-0.5 hover:opacity-100'}`}
              >
                <img src={`/images/riftbound/${domain.value}.webp`} alt="" width="42" height="58" draggable="false" className="h-full w-full select-none rounded-lg" />
              </button>
            );
          })}
          {filters.domains.length > 0 && (
            <ThemedSelect className="w-32" value={filters.domainMode} onChange={(value) => set({ domainMode: value })} ariaLabel="Cómo comparar los dominios" buttonClassName="!h-9 !min-h-9 !rounded-full !text-xs" options={RB_DOMAIN_MODES} />
          )}
        </div>

        {/* Tipo, rareza, coste de energía y edición */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ThemedSelect value={filters.type} onChange={(value) => set({ type: value })} ariaLabel="Tipo de carta" buttonClassName={compact} listMinWidth={200} options={[any('Tipo'), ...RB_TYPES]} />
          <ThemedSelect value={filters.rarity} onChange={(value) => set({ rarity: value })} ariaLabel="Rareza" buttonClassName={compact} options={[any('Rareza'), ...RB_RARITIES]} />
          <ThemedSelect value={filters.energy} onChange={(value) => set({ energy: value })} ariaLabel="Coste de energía" buttonClassName={compact} options={[any('Energía'), ...RB_ENERGY.map((value) => ({ value, label: `Energía ${value}` }))]} />
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
              placeholder="Texto de la carta (en inglés)..."
              aria-label="Texto de la carta"
              className="col-span-2 h-10 rounded-xl border-2 border-blue-900/20 bg-slate-50 px-3 text-[13px] font-semibold text-blue-900 placeholder-blue-900/50 outline-none transition-all focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-400/20 sm:col-span-3"
            />
            <ThemedSelect className="col-span-2 sm:col-span-3" value={filters.tag} onChange={(value) => set({ tag: value })} searchable searchPlaceholder="Escribe una región, raza o campeón..." ariaLabel="Etiqueta" buttonClassName={compact} listMinWidth={260} options={tagOptions} />
            <ThemedSelect value={filters.power} onChange={(value) => set({ power: value })} ariaLabel="Coste de poder" buttonClassName={compact} options={[any('Poder'), ...RB_POWER.map((value) => ({ value, label: `Poder ${value}` }))]} />
            <ThemedSelect value={filters.might} onChange={(value) => set({ might: value })} ariaLabel="Might (fuerza)" buttonClassName={compact} options={[any('Might'), ...RB_MIGHT.map((value) => ({ value, label: `Might ${value}` }))]} />
            <ThemedSelect value={filters.version} onChange={(value) => set({ version: value })} ariaLabel="Versión de la carta" buttonClassName={compact} listMinWidth={210} options={[any('Versión'), ...RB_VERSIONS]} />
            <ThemedSelect className="col-span-2 sm:col-span-1" value={filters.collection} onChange={(value) => set({ collection: value })} ariaLabel="Línea de producto" buttonClassName={compact} listMinWidth={230} options={[any('Producto'), ...RB_COLLECTIONS]} />
            <button
              type="button"
              aria-pressed={filters.signature}
              onClick={() => set({ signature: !filters.signature })}
              className={`col-span-2 h-10 rounded-xl border-2 px-3 text-[13px] font-extrabold transition-colors ${filters.signature ? 'border-blue-900 bg-blue-900 text-yellow-400' : 'border-blue-900/25 bg-white text-blue-900 hover:border-blue-900/50'}`}
            >
              Solo cartas de firma (Signature)
            </button>
          </div>
        )}

        {active > 0 && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_RB_FILTERS)}
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
