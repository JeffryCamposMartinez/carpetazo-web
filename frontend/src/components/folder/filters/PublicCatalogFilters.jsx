import React from 'react';
import Filters from '../../Filters';

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

const SelectField = ({ value, onChange, children }) => (
  <select
    value={value}
    onChange={onChange}
    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-all hover:bg-blue-50/30 focus:border-[#1e40af] focus:outline-none focus:ring-1 focus:ring-[#1e40af] md:rounded-xl md:px-4 md:py-2.5 md:text-sm md:font-bold"
  >
    {children}
  </select>
);

const EditionDropdown = ({
  searchSet,
  availableSets,
  isSetDropdownOpen,
  setIsSetDropdownOpen,
  onSelectSet,
}) => (
  <div className="relative w-full h-full">
    <button
      type="button"
      className="flex h-full w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900 transition-all hover:border-[#1e40af] hover:bg-blue-50/30 md:rounded-xl md:px-4 md:py-2.5"
      onClick={() => setIsSetDropdownOpen(!isSetDropdownOpen)}
    >
      <span className="truncate text-xs font-bold">{searchSet === '' ? 'Todas las ediciones' : searchSet}</span>
      <span translate="no" className="material-symbols-outlined ml-2 text-[18px] text-gray-500 md:text-[20px]">expand_more</span>
    </button>
    {isSetDropdownOpen && (
      <>
        <div className="fixed inset-0 z-[100]" onClick={() => setIsSetDropdownOpen(false)} />
        <div className="absolute z-[110] mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl custom-scrollbar">
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
    <div className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_220px_180px_180px]">
      {editionDropdown}

      <SelectField value={mylType} onChange={(e) => setMylType(e.target.value)}>
        <option value="">Todos los tipos</option>
        {mylOptions.types.map(type => (
          <option key={type} value={type}>{prettyMylLabel(type)}</option>
        ))}
      </SelectField>

      <SelectField value={mylRace} onChange={(e) => setMylRace(e.target.value)}>
        <option value="">Todas las razas</option>
        {mylOptions.races.map(race => (
          <option key={race} value={race}>{prettyMylLabel(race)}</option>
        ))}
      </SelectField>

      <SelectField value={mylCost} onChange={(e) => setMylCost(e.target.value)}>
        <option value="">Todos los costes</option>
        {mylOptions.costs.map(cost => (
          <option key={cost} value={cost}>{cost}</option>
        ))}
      </SelectField>
    </div>
  );
}
