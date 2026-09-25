import React from 'react';

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
  <select
    value={value}
    onChange={onChange}
    disabled={disabled}
    className={`w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 transition-colors focus:border-[#1e40af] focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 sm:text-sm lg:text-xs ${className}`}
  >
    {children}
  </select>
);

const EditionDropdown = ({
  searchSet,
  availableSets,
  filteredSearchSets,
  isSetDropdownOpen,
  setIsSetDropdownOpen,
  onSelectSet,
  label = 'Edición',
}) => (
  <div className="relative w-full">
    <button
      type="button"
      className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 transition-colors hover:border-[#1e40af] sm:text-sm lg:text-xs"
      onClick={() => setIsSetDropdownOpen(!isSetDropdownOpen)}
    >
      <span className="truncate font-bold">{searchSet === '' ? label : availableSets.find(s => s.groupId == searchSet)?.name || 'Seleccionado'}</span>
      <span translate="no" className="material-symbols-outlined ml-2 text-gray-500">expand_more</span>
    </button>
    {isSetDropdownOpen && (
      <>
        <div className="fixed inset-0 z-10" onClick={() => setIsSetDropdownOpen(false)} />
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg custom-scrollbar">
          <button
            type="button"
            className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-gray-50 lg:text-xs ${searchSet === '' ? 'font-bold text-[#1e40af]' : 'text-gray-700'}`}
            onClick={() => onSelectSet('')}
          >
            {searchSet === '' && <span translate="no" className="material-symbols-outlined text-sm">check</span>}
            <span className={searchSet !== '' ? 'ml-6' : ''}>{label}</span>
          </button>
          {filteredSearchSets.map(set => (
            <button
              type="button"
              key={set.groupId}
              className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 lg:text-xs ${searchSet == set.groupId ? 'font-bold text-[#1e40af]' : 'text-gray-700'}`}
              onClick={() => onSelectSet(set.groupId)}
            >
              {searchSet == set.groupId && <span translate="no" className="material-symbols-outlined text-sm">check</span>}
              <span className={searchSet != set.groupId ? 'ml-6' : ''}>{set.name}</span>
            </button>
          ))}
        </div>
      </>
    )}
  </div>
);

const MylFilters = ({
  searchBlock,
  setSearchBlock,
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
        <option value="2">Primer Bloque</option>
        <option value="3">Primera Era</option>
        <option value="1">Furia Extendido</option>
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

      {availableRarities.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <span className="text-sm font-bold text-gray-700">Rareza</span>
          <SelectField
            value={filterRarity}
            onChange={(e) => {
              setFilterRarity(e.target.value);
              scrollToTopIfNeeded();
            }}
            className="flex-1"
          >
            <option value="">Todas</option>
            {availableRarities.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </SelectField>
        </div>
      )}
    </>
  );
};

export default function FolderAddSearchFilters({
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
  filterType,
  setFilterType,
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
}) {
  const isMyl = searchCategory === '99' || tcg === 'Mitos y Leyendas';

  const onSelectSet = (nextSet) => {
    setSearchSet(nextSet);
    setIsSetDropdownOpen(false);
    scrollToTopIfNeeded();
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={isMyl ? 'Nombre de carta, tipo o raza...' : 'Nombre o código de carta...'}
        className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs text-gray-900 transition-colors focus:border-[#1e40af] focus:outline-none focus:ring-1 focus:ring-[#1e40af] sm:text-sm lg:text-xs"
      />

      {isMyl ? (
        <MylFilters
          searchBlock={searchBlock}
          setSearchBlock={setSearchBlock}
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
      ) : (
        <GenericTcgFilters
          tcg={tcg}
          filterType={filterType}
          setFilterType={setFilterType}
          availableRarities={availableRarities}
          filterRarity={filterRarity}
          setFilterRarity={setFilterRarity}
          searchSet={searchSet}
          availableSets={availableSets}
          filteredSearchSets={filteredSearchSets}
          isSetDropdownOpen={isSetDropdownOpen}
          setIsSetDropdownOpen={setIsSetDropdownOpen}
          onSelectSet={onSelectSet}
          scrollToTopIfNeeded={scrollToTopIfNeeded}
        />
      )}
    </div>
  );
}
