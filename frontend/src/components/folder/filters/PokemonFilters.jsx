import React from 'react';

const typesList = ["Colorless", "Fire", "Water", "Grass", "Lightning", "Fighting", "Fairy", "Metal", "Darkness", "Dragon", "Psychic"];

export default function PokemonFilters({
  searchQuery,
  setSearchQuery,
  selectedType,
  onTypeChange,
  selectedSupertype,
  onSupertypeChange,
  searchSet,
  availableSets,
  onSelectSet
}) {
  const supertypes = [
    { id: '', label: 'Todo' },
    { id: 'Pokémon', label: 'Pokémon' },
    { id: 'Trainer', label: 'Entrenadores' },
    { id: 'Energy', label: 'Energía' }
  ];

  return (
    <div className="w-full bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border-2 border-blue-900/10 p-2 sm:p-4 relative overflow-hidden">
      <div className="flex flex-col gap-4 relative z-10 p-2">
        
        {/* Search Bar */}
        <div className="relative w-full group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-6 h-6 text-blue-900 group-focus-within:text-yellow-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <input 
            type="text" 
            placeholder="Nombre o código de carta..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border-2 border-blue-900/20 text-blue-900 rounded-xl pl-12 pr-4 py-4 text-base font-semibold placeholder-blue-900/50 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/20 focus:bg-white transition-all shadow-sm"
          />
        </div>

        {/* Supertype Tabs */}
        <div className="w-full grid grid-cols-4 bg-slate-50 border-2 border-blue-900/10 rounded-xl overflow-hidden shadow-sm">
          {supertypes.map((st, i) => {
            const isActive = selectedSupertype === st.id;
            const activeClasses = "bg-blue-900 text-yellow-400 border-b-4 border-yellow-400 active";
            const inactiveClasses = "bg-transparent text-blue-900 border-b-4 border-transparent hover:bg-blue-900/5";
            let extraClasses = "";
            if (i === 2) extraClasses = " border-l border-r border-blue-900/10";
            
            return (
              <button 
                key={st.id}
                onClick={() => {
                  onSupertypeChange(st.id);
                  if (st.id !== 'Pokémon' && st.id !== 'Energy') {
                    onTypeChange('');
                  }
                }}
                className={`flex items-center justify-center py-4 cursor-pointer transition-all duration-300 outline-none group ${isActive ? activeClasses : inactiveClasses}${extraClasses}`}
              >
                <span className="text-[11px] sm:text-sm font-bold uppercase tracking-wider group-hover:scale-105 transition-transform">{st.label}</span>
              </button>
            );
          })}
        </div>

        {/* Type Icons Container (Centered horizontally) */}
        {(selectedSupertype === 'Pokémon' || selectedSupertype === 'Energy') && (
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 px-1 py-2 animate-fadeInOverlay">
            {selectedType !== '' && (
              <button 
                onClick={() => onTypeChange('')}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-50 text-red-500 hover:bg-red-100 hover:scale-110 hover:shadow-md transition-all outline-none flex items-center justify-center border-2 border-red-200 shrink-0"
                title="Limpiar filtro de tipo"
              >
                <span translate="no" className="material-symbols-outlined text-xl sm:text-2xl font-bold">close</span>
              </button>
            )}
            {typesList.map(type => (
              <button 
                key={type}
                onClick={() => onTypeChange(selectedType === type ? '' : type)}
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full hover:scale-110 hover:shadow-md transition-all outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-900 ${selectedType === type ? 'ring-2 ring-offset-2 ring-blue-900 scale-110 shadow-md' : 'bg-white'}`}
              >
                <img src={`/types/${type}.png`} alt={type} className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        )}

        {/* Set Dropdown */}
        <div className="w-full relative group">
          <select 
            value={searchSet}
            onChange={(e) => onSelectSet(e.target.value)}
            style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
            className="w-full appearance-none bg-white border-2 border-blue-900 text-blue-900 font-bold rounded-xl px-4 py-4 cursor-pointer outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/20 transition-all shadow-sm hover:bg-slate-50"
          >
            <option value="">Todas las ediciones</option>
            {availableSets.map(s => (
              <option key={s.groupId} value={s.groupId}>{s.name}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-blue-900 group-focus-within:text-yellow-500 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
        </div>

      </div>
    </div>
  );
}
