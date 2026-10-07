import PokemonFilters from './PokemonFilters';
import OnePieceFilters from './OnePieceFilters';
import MagicFilters from './MagicFilters';
import RiftboundFilters from './RiftboundFilters';
import YugiohFilters from './YugiohFilters';
import React from 'react';
import ThemedSelect from '../../ui/ThemedSelect';
import Select from '../../ui/Select';

const typeTabsByTcg = {
  Pokemon: [
    { value: 'all', label: 'Todo' },
    { value: 'cards', label: 'Cartas' },
    { value: 'sealed', label: 'Sellado' },
  ],
  YuGiOh: [
    { value: 'all', label: 'Todo' },
    { value: 'cards', label: 'Cartas' },
    { value: 'sealed', label: 'Sellado' },
  ],
  Magic: [
    { value: 'all', label: 'Todo' },
    { value: 'cards', label: 'Cartas' },
    { value: 'sealed', label: 'Sellado' },
  ],
  OnePiece: [
    { value: 'all', label: 'Todo' },
    { value: 'cards', label: 'Cartas' },
    { value: 'sealed', label: 'Sellado' },
  ],
};

const SelectField = ({ value, onChange, disabled, children, className = '' }) => (
  <Select
    value={value}
    onChange={onChange}
    disabled={disabled}
    className={`h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-900 transition-colors focus:border-[#1e40af] focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 sm:text-sm lg:text-xs ${className}`}
  >
    {children}
  </Select>
);

const EditionDropdown = ({
  wrapperClassName = '',
  searchSet,
  filteredSearchSets,
  onSelectSet,
  label = 'Edición',
}) => (
  <div className={`relative w-full ${wrapperClassName}`}>
    <ThemedSelect
      value={searchSet === '' || searchSet == null ? '' : String(searchSet)}
      onChange={(next) => onSelectSet(filteredSearchSets.find((set) => String(set.groupId) === next)?.groupId ?? '')}
      options={[{ value: '', label }, ...filteredSearchSets.map((set) => ({ value: String(set.groupId), label: set.name }))]}
      placeholder={label}
      ariaLabel={label}
      searchable
      searchPlaceholder="Buscar edición…"
      listMinWidth={260}
      buttonClassName="!h-9 !min-h-9 !rounded-lg !px-2.5 !text-xs"
    />
  </div>
);

const MylFilters = ({
  searchBlock,
  setSearchBlock,
  availableBlocks = [],
  searchPhysicalProduct,
  setSearchPhysicalProduct,
  availablePhysicalProducts,
  searchSet,
  availableSets,
  filteredSearchSets,
  isSetDropdownOpen,
  setIsSetDropdownOpen,
  onSelectSet,
  mylType,
  setMylType,
  mylRace,
  setMylRace,
  mylCost,
  setMylCost,
  scrollToTopIfNeeded,
}) => (
  <>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <SelectField
        value={searchBlock}
        onChange={(e) => {
          setSearchBlock(e.target.value);
          onSelectSet('');
          setSearchPhysicalProduct('');
          scrollToTopIfNeeded();
        }}
      >
        <option value="">Todos los Bloques</option>
        {[...availableBlocks].sort((a, b) => a.id === 2 ? -1 : b.id === 2 ? 1 : a.name.localeCompare(b.name)).map(block => (
          <option key={block.id} value={block.id}>{block.name}</option>
        ))}
      </SelectField>

      <SelectField
        value={searchPhysicalProduct}
        onChange={(e) => {
          setSearchPhysicalProduct(e.target.value);
          scrollToTopIfNeeded();
        }}
        disabled={!searchBlock}
      >
        <option value="">Producto</option>
        {availablePhysicalProducts.filter(p => !searchBlock || p.blockId === parseInt(searchBlock)).map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </SelectField>

      <EditionDropdown
        wrapperClassName="col-span-2 sm:col-span-1"
        searchSet={searchSet}
        availableSets={availableSets}
        filteredSearchSets={filteredSearchSets}
        isSetDropdownOpen={isSetDropdownOpen}
        setIsSetDropdownOpen={setIsSetDropdownOpen}
        onSelectSet={onSelectSet}
        label="Edición"
      />
    </div>

    <div className="grid grid-cols-3 gap-2">
      <SelectField value={mylType} onChange={(e) => { setMylType(e.target.value); scrollToTopIfNeeded(); }}>
        <option value="">Tipo</option>
        <option value="ALIADO">Aliado</option>
        <option value="ARMA">Arma</option>
        <option value="ORO">Oro</option>
        <option value="TALISMAN">Talismán</option>
        <option value="TOTEM">Tótem</option>
      </SelectField>

      <SelectField value={mylRace} onChange={(e) => { setMylRace(e.target.value); scrollToTopIfNeeded(); }}>
        <option value="">Raza</option>
        {(searchBlock === '2'
          ? ['CABALLERO', 'DEFENSOR', 'DESAFIANTE', 'DRAGON', 'ETERNO', 'FAERIE', 'FARAON', 'HEROE', 'OLIMPICO', 'SACERDOTE', 'SOMBRA', 'TITAN']
          : ['CABALLERO', 'DRAGON', 'FAERIE', 'GUERRERO', 'SOMBRA', 'BESTIA', 'DIOS', 'HEROE', 'SACERDOTE', 'SIN_RAZA', 'DESAFIANTE', 'ANCESTRAL']
        ).map(race => (
          <option key={race} value={race}>{race.replace('_', ' ')}</option>
        ))}
      </SelectField>

      <SelectField value={mylCost} onChange={(e) => { setMylCost(e.target.value); scrollToTopIfNeeded(); }}>
        <option value="">Costo</option>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
          <option key={i} value={i}>{i}</option>
        ))}
      </SelectField>
    </div>
  </>
);

const GenericTcgFilters = ({
  tcg,
  filterType,
  setFilterType,
  availableRarities,
  filterRarity,
  setFilterRarity,
  searchSet,
  availableSets,
  filteredSearchSets,
  isSetDropdownOpen,
  setIsSetDropdownOpen,
  onSelectSet,
  scrollToTopIfNeeded,
}) => {
  const tabs = typeTabsByTcg[tcg] || typeTabsByTcg.Pokemon;

  return (
    <>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_240px]">
        <div className="flex items-center rounded-lg border border-gray-200 bg-white p-1">
          {tabs.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setFilterType(tab.value);
                scrollToTopIfNeeded();
              }}
              className={`flex-1 rounded-md px-4 py-2 text-xs font-black uppercase tracking-wide transition-colors ${
                filterType === tab.value ? 'bg-[#1e40af] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <EditionDropdown
          searchSet={searchSet}
          availableSets={availableSets}
          filteredSearchSets={filteredSearchSets}
          isSetDropdownOpen={isSetDropdownOpen}
          setIsSetDropdownOpen={setIsSetDropdownOpen}
          onSelectSet={onSelectSet}
          label="Todas las ediciones"
        />
      </div>
    </>
  );
};

export default function FolderAddSearchFilters({
  availableBlocks,
  tcg,
  searchCategory,
  searchQuery,
  setSearchQuery,
  searchSet,
  availableSets,
  filteredSearchSets,
  isSetDropdownOpen,
  setIsSetDropdownOpen,
  setSearchSet,
  searchLang,
  setSearchLang,
  filterType,
  setFilterType,
  selectedType,
  setSelectedType,
  selectedSupertype,
  setSelectedSupertype,
  filterCounts,
  availableRarities,
  filterRarity,
  setFilterRarity,
  searchBlock,
  setSearchBlock,
  searchPhysicalProduct,
  setSearchPhysicalProduct,
  availablePhysicalProducts,
  mylType,
  setMylType,
  mylRace,
  setMylRace,
  mylCost,
  setMylCost,
  scrollToTopIfNeeded,
  opFilters,
  setOpFilters,
  magicFilters,
  setMagicFilters,
  rbFilters,
  setRbFilters,
  ygFilters,
  setYgFilters,
  loadedCards,
}) {
  const isMyl = searchCategory === '99' || tcg === 'Mitos y Leyendas';

  const onSelectSet = (nextSet) => {
    setSearchSet(nextSet);
    setIsSetDropdownOpen(false);
    scrollToTopIfNeeded();
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {isMyl ? (
        <>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nombre de carta, tipo o raza..."
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs text-gray-900 transition-colors focus:border-[#1e40af] focus:outline-none focus:ring-1 focus:ring-[#1e40af] sm:text-sm lg:text-xs"
          />
          <MylFilters
            searchBlock={searchBlock}
            setSearchBlock={setSearchBlock}
            availableBlocks={availableBlocks}
            searchPhysicalProduct={searchPhysicalProduct}
            setSearchPhysicalProduct={setSearchPhysicalProduct}
            availablePhysicalProducts={availablePhysicalProducts}
            searchSet={searchSet}
            availableSets={availableSets}
            filteredSearchSets={filteredSearchSets}
            isSetDropdownOpen={isSetDropdownOpen}
            setIsSetDropdownOpen={setIsSetDropdownOpen}
            onSelectSet={onSelectSet}
            mylType={mylType}
            setMylType={setMylType}
            mylRace={mylRace}
            setMylRace={setMylRace}
            mylCost={mylCost}
            setMylCost={setMylCost}
            scrollToTopIfNeeded={scrollToTopIfNeeded}
          />
        </>
      ) : searchCategory === 'yugioh' ? (
        <YugiohFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filters={ygFilters}
          setFilters={setYgFilters}
          searchSet={searchSet}
          availableSets={availableSets}
          onSelectSet={onSelectSet}
          loadedCards={loadedCards}
        />
      ) : searchCategory === 'riftbound' ? (
        <RiftboundFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filters={rbFilters}
          setFilters={setRbFilters}
          searchSet={searchSet}
          availableSets={availableSets}
          onSelectSet={onSelectSet}
          loadedCards={loadedCards}
        />
      ) : searchCategory === 'magic' ? (
        <MagicFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filters={magicFilters}
          setFilters={setMagicFilters}
          searchSet={searchSet}
          availableSets={availableSets}
          onSelectSet={onSelectSet}
          loadedCards={loadedCards}
        />
      ) : searchCategory === '68' ? (
        <OnePieceFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filters={opFilters}
          setFilters={setOpFilters}
          searchSet={searchSet}
          availableSets={availableSets}
          onSelectSet={onSelectSet}
          loadedCards={loadedCards}
        />
      ) : (
        <PokemonFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          selectedSupertype={selectedSupertype}
          onSupertypeChange={setSelectedSupertype}
          searchSet={searchSet}
          availableSets={availableSets}
          onSelectSet={onSelectSet}
          searchLang={searchLang}
          onLangChange={(l) => { setSearchLang(l); setSearchSet(''); }}
        />
      )}
    </div>
  );
}
