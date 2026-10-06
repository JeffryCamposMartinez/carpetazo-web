import React from 'react';
import Filters from './Filters';
import Select from '../../ui/Select';

const normalize = (value) => (value || '').toString().trim();

const prettyMylLabel = (value) => {
  const special = {
    DRAGON: 'Dragón',
    FARAON: 'Faraón',
    HEROE: 'Héroe',
    OLIMPICO: 'Olímpico',
    TALISMAN: 'Talismán',
    TOTEM: 'Tótem',
    SIN_RAZA: 'Sin raza',
  };
  if (special[value]) return special[value];
  return String(value || '')
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const SelectField = ({ value, onChange, children, variant = 'bar' }) => (
  <Select
    value={value}
    onChange={onChange}
    className={variant === 'sidebar'
      ? 'h-11 w-full rounded-2xl border border-white/20 bg-white/90 px-3 text-[12px] font-black text-[#102142] shadow-[0_10px_22px_-18px_rgba(15,23,42,0.9)] outline-none transition hover:bg-white focus:border-[#ffcb05] focus:ring-2 focus:ring-[#ffcb05]/35'
      : 'w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-all hover:bg-blue-50/30 focus:border-[#1e40af] focus:outline-none focus:ring-1 focus:ring-[#1e40af] md:rounded-xl md:px-4 md:py-2.5 md:text-sm md:font-bold'
    }
  >
    {children}
  </Select>
);

const EditionDropdown = ({
  searchSet,
  availableSets,
  isSetDropdownOpen,
  setIsSetDropdownOpen,
  onSelectSet,
  variant = 'bar',
}) => (
  <div className="relative w-full h-full">
    <button
      type="button"
      className={variant === 'sidebar'
        ? 'flex h-11 w-full cursor-pointer items-center justify-between rounded-2xl border border-white/20 bg-white/90 px-3 text-[#102142] shadow-[0_10px_22px_-18px_rgba(15,23,42,0.9)] transition hover:bg-white focus:border-[#ffcb05] focus:outline-none focus:ring-2 focus:ring-[#ffcb05]/35'
        : 'flex h-full w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900 transition-all hover:border-[#1e40af] hover:bg-blue-50/30 md:rounded-xl md:px-4 md:py-2.5'
      }
      onClick={() => setIsSetDropdownOpen(!isSetDropdownOpen)}
    >
      <span className="truncate text-xs font-bold">{searchSet === '' ? 'Todas las ediciones' : searchSet}</span>
      <span translate="no" className={`material-symbols-outlined ml-2 text-[18px] md:text-[20px] ${variant === 'sidebar' ? 'text-[#1e40af]' : 'text-gray-500'}`}>expand_more</span>
    </button>
    {isSetDropdownOpen && (
      <>
        <div className="fixed inset-0 z-[100]" onClick={() => setIsSetDropdownOpen(false)} />
        <div className={`absolute z-[110] mt-2 max-h-60 w-full overflow-y-auto border bg-white shadow-xl custom-scrollbar ${
          variant === 'sidebar' ? 'rounded-2xl border-white/70' : 'rounded-xl border-gray-200'
        }`}>
          <button
            type="button"
            className={`flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50 ${searchSet === '' ? 'font-bold text-[#1e40af]' : 'text-gray-700'}`}
            onClick={() => onSelectSet('')}
          >
            {searchSet === '' && <span translate="no" className="material-symbols-outlined text-sm">check</span>}
            <span className={searchSet !== '' ? 'ml-6' : ''}>Todas las ediciones</span>
          </button>
          {availableSets.map(setName => (
            <button
              type="button"
              key={setName}
              className={`flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50 ${searchSet === setName ? 'font-bold text-[#1e40af]' : 'text-gray-700'}`}
              onClick={() => onSelectSet(setName)}
            >
              {searchSet === setName && <span translate="no" className="material-symbols-outlined text-sm">check</span>}
              <span className={searchSet !== setName ? 'ml-6' : ''}>{setName}</span>
            </button>
          ))}
        </div>
      </>
    )}
  </div>
);

export const getMylPublicFilterOptions = (cards = []) => ({
  types: [...new Set(cards.map(card => normalize(card.type || card.cardType || card.supertype)).filter(Boolean))].sort(),
  races: [...new Set(cards.map(card => normalize(card.race || card.subtype || card.types?.[0])).filter(Boolean))].sort(),
  costs: [...new Set(cards.map(card => normalize(card.cost || card.manaCost)).filter(Boolean))]
    .filter(cost => Number.isFinite(Number(cost)) && Number(cost) >= 0 && Number(cost) <= 10)
    .sort((a, b) => Number(a) - Number(b)),
});

export default function PublicCatalogFilters({
  tcg,
  cards,
  counts,
  selectedSupertype,
  onSupertypeChange,
  selectedType,
  onTypeChange,
  searchSet,
  setSearchSet,
  availableSets,
  isSetDropdownOpen,
  setIsSetDropdownOpen,
  mylType,
  setMylType,
  mylRace,
  setMylRace,
  mylCost,
  setMylCost,
  mylFilterOptions,
  variant = 'bar',
}) {
  const isMyl = tcg === 'Mitos y Leyendas';
  const fallbackMylOptions = getMylPublicFilterOptions(cards);
  const mylOptions = {
    types: mylFilterOptions?.types?.length ? mylFilterOptions.types : fallbackMylOptions.types,
    races: mylFilterOptions?.races?.length ? mylFilterOptions.races : fallbackMylOptions.races,
    costs: (mylFilterOptions?.costs?.length ? mylFilterOptions.costs : fallbackMylOptions.costs)
      .filter(cost => Number.isFinite(Number(cost)) && Number(cost) >= 0 && Number(cost) <= 10),
  };

  const editionDropdown = (
    <EditionDropdown
      searchSet={searchSet}
      availableSets={availableSets}
      isSetDropdownOpen={isSetDropdownOpen}
      setIsSetDropdownOpen={setIsSetDropdownOpen}
      onSelectSet={(nextSet) => {
        setSearchSet(nextSet);
        setIsSetDropdownOpen(false);
      }}
      variant={variant}
    />
  );

  if (!isMyl) {
    return (
      <Filters
        title=""
        subtitle=""
        selectedSupertype={selectedSupertype}
        onSupertypeChange={onSupertypeChange}
        selectedType={selectedType}
        onTypeChange={onTypeChange}
        counts={counts}
        showCounts={false}
        segmentedControlAddon={editionDropdown}
      />
    );
  }

  return (
    <div className={variant === 'sidebar' ? 'flex w-full flex-col gap-2' : 'grid grid-cols-2 gap-2 md:grid-cols-[1fr_220px_180px_180px]'}>
      {editionDropdown}

      <SelectField value={mylType} onChange={(e) => setMylType(e.target.value)} variant={variant}>
        <option value="">Todos los tipos</option>
        {mylOptions.types.map(type => (
          <option key={type} value={type}>{prettyMylLabel(type)}</option>
        ))}
      </SelectField>

      <SelectField value={mylRace} onChange={(e) => setMylRace(e.target.value)} variant={variant}>
        <option value="">Todas las razas</option>
        {mylOptions.races.map(race => (
          <option key={race} value={race}>{prettyMylLabel(race)}</option>
        ))}
      </SelectField>

      <SelectField value={mylCost} onChange={(e) => setMylCost(e.target.value)} variant={variant}>
        <option value="">Todos los costes</option>
        {mylOptions.costs.map(cost => (
          <option key={cost} value={cost}>{cost}</option>
        ))}
      </SelectField>
    </div>
  );
}
