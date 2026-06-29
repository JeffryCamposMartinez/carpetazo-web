const TYPE_COLORS = {
  "Grass": { color: "#5FBD58", label: "Planta" },
  "Fire": { color: "#E87C26", label: "Fuego" },
  "Water": { color: "#539DDF", label: "Agua" },
  "Lightning": { color: "#F2D94E", label: "Eléctrico" },
  "Psychic": { color: "#B97FC9", label: "Psíquico" },
  "Fighting": { color: "#D14424", label: "Lucha" },
  "Darkness": { color: "#595761", label: "Siniestro" },
  "Metal": { color: "#979B9B", label: "Metálico" },
  "Fairy": { color: "#EE90E6", label: "Hada" },
  "Dragon": { color: "#8A55FD", label: "Dragón" },
  "Colorless": { color: "#A0A29F", label: "Incoloro" }
};

export default function Filters({ 
  selectedType, 
  onTypeChange, 
  selectedSupertype, 
  onSupertypeChange, 
  counts = {},
  showCounts = true,
  title = "Catálogo de Cartas",
  subtitle = "Explora nuestra colección premium de cartas Pokémon.",
  segmentedControlAddon = null
}) {
  
  return (
    <div className="flex flex-col gap-md w-full">
      {title && (
        <div className="mb-2">
          <h1 className="font-headline-lg md:font-display-lg text-headline-lg md:text-display-lg text-[#1a2b4b] mb-xs">{title}</h1>
          {subtitle && <p className="font-body-md text-body-md text-gray-500">{subtitle}</p>}
        </div>
      )}
      
      {/* Supertype Segmented Control and Addon Row */}
      <div className="flex flex-col md:flex-row gap-4 w-full mb-4">
        <div className="flex flex-1 border border-gray-300 rounded-xl overflow-hidden bg-white shadow-sm">
          <button 
          type="button"
          onClick={() => {
            onSupertypeChange('');
            onTypeChange('');
          }}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 px-1 border-r border-gray-200 transition-colors relative ${selectedSupertype === '' ? 'bg-blue-50' : 'hover:bg-gray-50 bg-white'}`}
        >
          <span className={`font-label-sm text-[10px] sm:text-xs tracking-wider ${selectedSupertype === '' ? 'text-[#1e40af] font-bold' : 'text-gray-500'}`}>TODO</span>
          {showCounts && <span className={`font-headline-md text-headline-md ${selectedSupertype === '' ? 'text-[#1e40af]' : 'text-gray-700'}`}>
            {(counts.pokemon || 0) + (counts.trainers || 0) + (counts.energy || 0)}
          </span>}
          {selectedSupertype === '' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1e40af]"></div>}
        </button>

        <button 
          type="button"
          onClick={() => {
            onSupertypeChange(selectedSupertype === 'Pokémon' ? '' : 'Pokémon');
            onTypeChange(''); // Reset type when changing supertype
          }}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 px-1 border-r border-gray-200 transition-colors relative ${selectedSupertype === 'Pokémon' ? 'bg-blue-50' : 'hover:bg-gray-50 bg-white'}`}
        >
          <span className={`font-label-sm text-[10px] sm:text-xs tracking-wider ${selectedSupertype === 'Pokémon' ? 'text-[#1e40af] font-bold' : 'text-gray-500'}`}>POKÉMON</span>
          {showCounts && <span className={`font-headline-md text-headline-md ${selectedSupertype === 'Pokémon' ? 'text-[#1e40af]' : 'text-gray-700'}`}>{counts.pokemon || 0}</span>}
          {selectedSupertype === 'Pokémon' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1e40af]"></div>}
        </button>
        
        <button 
          type="button"
          onClick={() => {
            onSupertypeChange(selectedSupertype === 'Trainer' ? '' : 'Trainer');
            onTypeChange(''); 
          }}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 px-1 border-r border-gray-200 transition-colors relative ${selectedSupertype === 'Trainer' ? 'bg-blue-50' : 'hover:bg-gray-50 bg-white'}`}
        >
          <span className={`font-label-sm text-[10px] sm:text-xs tracking-wider ${selectedSupertype === 'Trainer' ? 'text-[#1e40af] font-bold' : 'text-gray-500'}`}>ENTRENADORES</span>
          {showCounts && <span className={`font-headline-md text-headline-md ${selectedSupertype === 'Trainer' ? 'text-[#1e40af]' : 'text-gray-700'}`}>{counts.trainers || 0}</span>}
          {selectedSupertype === 'Trainer' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1e40af]"></div>}
        </button>
        
        <button 
          type="button"
          onClick={() => {
            onSupertypeChange(selectedSupertype === 'Energy' ? '' : 'Energy');
            onTypeChange('');
          }}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 px-1 transition-colors relative ${selectedSupertype === 'Energy' ? 'bg-blue-50' : 'hover:bg-gray-50 bg-white'}`}
        >
          <span className={`font-label-sm text-[10px] sm:text-xs tracking-wider ${selectedSupertype === 'Energy' ? 'text-[#1e40af] font-bold' : 'text-gray-500'}`}>ENERGÍA</span>
          {showCounts && <span className={`font-headline-md text-headline-md ${selectedSupertype === 'Energy' ? 'text-[#1e40af]' : 'text-gray-700'}`}>{counts.energy || 0}</span>}
          {selectedSupertype === 'Energy' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1e40af]"></div>}
        </button>
      </div>

      {segmentedControlAddon && (
        <div className="w-full md:w-64 flex-shrink-0">
          {segmentedControlAddon}
        </div>
      )}
      </div>

      {/* Filter Chips (Type) - Only show if Pokemon or Energy is selected */}
      {(selectedSupertype === 'Pokémon' || selectedSupertype === 'Energy') && (
        <div className="border border-gray-300 rounded-xl bg-white overflow-hidden shadow-sm">
          <div className="flex justify-between items-center px-3 py-1.5 border-b border-gray-200 bg-gray-50">
            <span className="font-bold text-[9px] sm:text-[10px] tracking-wider text-gray-700 uppercase">
              TIPO DE {selectedSupertype === 'Pokémon' ? 'POKÉMON' : 'ENERGÍA'}
            </span>
            
            <label className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-200 px-2 py-0.5 rounded transition-colors">
              <span className="font-bold text-[9px] tracking-wider text-gray-700">SELECCIONAR TODO</span>
              <input 
                type="checkbox" 
                checked={selectedType === ''}
                onChange={() => onTypeChange('')}
                className="w-3 h-3 rounded text-[#1e40af] focus:ring-[#1e40af] bg-white border-gray-300" 
              />
            </label>
          </div>
          
          <div className="flex flex-wrap gap-1.5 px-2 py-2 justify-center md:justify-start">
            {Object.entries(TYPE_COLORS).map(([type, { color, label }]) => (
              <button 
                key={type}
                type="button"
                onClick={() => onTypeChange(type)}
                title={label}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 relative ${selectedType === type ? 'ring-2 ring-[#1e40af] ring-offset-1 ring-offset-white shadow-md' : 'opacity-80 hover:opacity-100 shadow-sm'}`}
              >
                <img 
                  src={`/types/${type}.png`} 
                  alt={type} 
                  className="w-full h-full object-contain" 
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
