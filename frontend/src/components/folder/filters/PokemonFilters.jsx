import React, { useEffect, useRef, useState } from 'react';
import LiquidTabs from '../../ui/LiquidTabs';

const typesList = ["Colorless", "Fire", "Water", "Grass", "Lightning", "Fighting", "Fairy", "Metal", "Darkness", "Dragon", "Psychic"];

// Desplegable propio (siempre hacia abajo, con scroll y el estilo de la página).
// Con `searchable`, la primera opción queda fija arriba y justo debajo aparece un buscador para filtrar el resto.
const normalizeText = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function ThemedSelect({ value, options, onChange, className = '', searchable = false, searchPlaceholder = 'Buscar...' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const inputRef = useRef(null);
  const current = options.find(o => String(o.value) === String(value));

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    if (searchable) inputRef.current?.focus();
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, searchable]);

  const select = (v) => { onChange(v); setOpen(false); };
  const optionClass = (active) => `cursor-pointer px-3.5 py-2 text-sm font-bold transition-colors ${active ? 'bg-blue-900 text-yellow-400' : 'text-blue-900 hover:bg-yellow-400/20'}`;
  const renderOption = (o) => {
    const active = String(o.value) === String(value);
    return (
      <li key={o.value} role="option" aria-selected={active} onClick={() => select(o.value)} className={optionClass(active)}>
        {o.label}
      </li>
    );
  };

  const [pinned, ...rest] = options;
  const q = normalizeText(query.trim());
  const filtered = searchable && q ? rest.filter(o => normalizeText(o.label).includes(q)) : rest;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 bg-white border-2 rounded-xl px-3 py-2.5 text-sm text-left text-blue-900 font-bold shadow-sm transition-all outline-none hover:bg-slate-50 ${open ? 'border-yellow-400 ring-4 ring-yellow-400/20' : 'border-blue-900'}`}
      >
        <span className="truncate">{current?.label ?? ''}</span>
        <svg className={`w-5 h-5 shrink-0 transition-transform ${open ? 'rotate-180 text-yellow-500' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-[120] mt-2 flex max-h-72 flex-col overflow-hidden rounded-xl border-2 border-blue-900 bg-white shadow-[0_12px_30px_rgba(30,64,175,0.25)]"
        >
          {searchable ? (
            <>
              <ul className="shrink-0 pt-1">{pinned && renderOption(pinned)}</ul>
              <div className="shrink-0 border-y border-blue-900/10 bg-slate-50 px-3 py-2">
                <div className="relative">
                  <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-900/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); if (filtered[0]) select(filtered[0].value); }
                    }}
                    placeholder={searchPlaceholder}
                    className="w-full rounded-lg border-2 border-blue-900/20 bg-white py-2 pl-9 pr-3 text-sm font-semibold text-blue-900 placeholder-blue-900/40 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  />
                </div>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 custom-scrollbar">
                {filtered.map(renderOption)}
                {filtered.length === 0 && <li className="px-4 py-3 text-sm font-semibold text-blue-900/50">Sin resultados</li>}
              </ul>
            </>
          ) : (
            <ul className="max-h-60 overflow-y-auto overscroll-contain py-1 custom-scrollbar">
              {options.map(renderOption)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function PokemonFilters({
  searchQuery,
  setSearchQuery,
  selectedType,
  onTypeChange,
  selectedSupertype,
  onSupertypeChange,
  searchSet,
  availableSets,
  onSelectSet,
  searchLang,
  onLangChange
}) {
  const supertypes = [
    { id: '', label: 'Todo', short: 'Todo' },
    { id: 'Pokémon', label: 'Pokémon', short: 'Pokémon' },
    { id: 'Trainer', label: 'Entrenadores', short: 'Entren.' },
    { id: 'Energy', label: 'Energía', short: 'Energía' }
  ];

  return (
    <div className="w-full bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border-2 border-blue-900/10 p-1 sm:p-3 relative">
      <div className="flex flex-col gap-2.5 sm:gap-3 relative z-[80] p-1 sm:p-1.5">
        
        {/* Search Bar */}
        <div className="relative w-full group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-blue-900 group-focus-within:text-yellow-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <input 
            type="text" 
            placeholder="Nombre o código de carta..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border-2 border-blue-900/20 text-blue-900 rounded-xl pl-10 pr-3 py-2.5 text-sm font-semibold placeholder-blue-900/50 outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/20 focus:bg-white transition-all shadow-sm"
          />
        </div>

        {/* Supertype Tabs */}
        <LiquidTabs
          ariaLabel="Categoría"
          className="w-full overflow-hidden rounded-xl border-2 border-blue-900/10 bg-slate-50 shadow-sm"
          buttonClassName="flex cursor-pointer items-center justify-center px-0.5 py-2.5"
          value={selectedSupertype}
          onChange={(id) => {
            onSupertypeChange(id);
            if (id !== 'Pokémon' && id !== 'Energy') onTypeChange('');
          }}
          options={supertypes.map(st => ({
            value: st.id,
            label: (
              <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-normal sm:text-sm sm:tracking-wider">
                <span className="sm:hidden">{st.short}</span>
                <span className="hidden sm:inline">{st.label}</span>
              </span>
            ),
          }))}
        />

        {/* Type Icons Container (Centered horizontally) */}
        {(selectedSupertype === 'Pokémon' || selectedSupertype === 'Energy') && (
          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2.5 px-0 sm:px-1 py-0.5 sm:py-1 animate-fadeInOverlay">
            {selectedType !== '' && (
              <button type="button"
                onClick={() => onTypeChange('')}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-red-50 text-red-500 hover:bg-red-100 hover:scale-110 hover:shadow-md transition-all outline-none flex items-center justify-center border-2 border-red-200 shrink-0"
                title="Limpiar filtro de tipo"
              >
                <span translate="no" className="material-symbols-outlined text-xl sm:text-2xl font-bold">close</span>
              </button>
            )}
            {typesList.map(type => (
              <button type="button"
                key={type}
                onClick={() => onTypeChange(selectedType === type ? '' : type)}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:scale-110 hover:shadow-md transition-all outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-900 ${selectedType === type ? 'ring-2 ring-offset-2 ring-blue-900 scale-110 shadow-md' : 'bg-white'}`}
              >
                <img src={`/types/${type}.png`} alt={type} className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        )}

        {/* Language + Set Dropdown */}
        <div className="w-full flex flex-col gap-2 sm:flex-row">
          {onLangChange && (
            <>
              {/* Móvil: dos botones; escritorio: desplegable */}
              <LiquidTabs
                ariaLabel="Idioma"
                className="overflow-hidden rounded-xl border-2 border-blue-900 bg-white sm:hidden"
                buttonClassName="py-2 text-sm font-bold"
                value={searchLang}
                onChange={onLangChange}
                options={[{ value: 'en', label: 'Inglés' }, { value: 'ja', label: 'Japonés' }]}
              />
              <ThemedSelect
                className="hidden w-36 shrink-0 sm:block"
                value={searchLang}
                onChange={onLangChange}
                options={[{ value: 'en', label: 'Inglés' }, { value: 'ja', label: 'Japonés' }]}
              />
            </>
          )}
          <ThemedSelect
            className="flex-1 min-w-0"
            value={searchSet}
            onChange={onSelectSet}
            searchable
            searchPlaceholder="Escribe una edición..."
            options={[{ value: '', label: 'Todas las ediciones' }, ...availableSets.map(x => ({ value: x.groupId, label: x.name }))]}
          />
        </div>

      </div>
    </div>
  );
}
