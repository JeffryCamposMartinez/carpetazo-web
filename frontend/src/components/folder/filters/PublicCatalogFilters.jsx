import React from 'react';
import Filters from './Filters';
import ThemedSelect from '../../ui/ThemedSelect';
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
  onSelectSet,
  variant = 'bar',
}) => (
  <div className="relative w-full h-full">
    <ThemedSelect
      value={searchSet || ''}
      onChange={(next) => onSelectSet(next)}
      options={[{ value: '', label: 'Todas las ediciones' }, ...availableSets.map((setName) => ({ value: setName, label: setName }))]}
      placeholder="Todas las ediciones"
      ariaLabel="Edición"
      searchable
      searchPlaceholder="Buscar edición…"
      listMinWidth={260}
      className="h-full"
      buttonClassName={variant === 'sidebar' ? '!h-11 !rounded-2xl' : '!h-full !min-h-10 !rounded-lg md:!rounded-xl !text-xs'}
    />
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
