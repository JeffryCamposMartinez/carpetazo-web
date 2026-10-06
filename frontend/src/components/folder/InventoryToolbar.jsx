import { SORT_OPTIONS } from '../../hooks/useInventoryTools';
import ThemedSelect from '../ui/ThemedSelect';

const CHIP = 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold ring-1 transition-[background-color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]';

// Ordenar, filtros rápidos y entrada a la selección en bloque (solo vista cuadrícula)
export default function InventoryToolbar({ counts, draftCount, onSaveDrafts, onSaveOrder, onStartSelecting, onQuickFilter, onSort, quickFilter, saving, selecting, sortKey }) {
  const chips = [
    { key: 'noStock', label: 'Sin stock', count: counts.noStock, on: 'bg-red-600 text-white ring-red-600', off: 'bg-red-50 text-red-700 ring-red-100 hover:bg-red-100' },
    { key: 'noPrice', label: 'Sin precio', count: counts.noPrice, on: 'bg-amber-500 text-white ring-amber-500', off: 'bg-amber-50 text-amber-800 ring-amber-100 hover:bg-amber-100' },
  ];

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 max-md:pr-16">
      <ThemedSelect
        value={sortKey}
        onChange={onSort}
        options={SORT_OPTIONS}
        icon="swap_vert"
        ariaLabel="Ordenar cartas"
        listMinWidth={256}
        className="w-auto"
        buttonClassName="!h-9 !min-h-9 !gap-1.5 !rounded-full !px-3 !text-xs"
      />

      {sortKey !== 'manual' && (
        <button type="button" onClick={onSaveOrder} disabled={saving} title="Los compradores verán la carpeta en este orden" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#facc15] px-3.5 text-xs font-extrabold text-[#12315f] shadow-sm transition-[filter,transform] duration-150 hover:brightness-95 active:scale-[0.97] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[18px]">{saving ? 'hourglass_empty' : 'bookmark_added'}</span>
          {saving ? 'Guardando…' : <><span className="sm:hidden">Usar este orden</span><span className="hidden sm:inline">Usar como orden de la carpeta</span></>}
        </button>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((chip) => (
          counts[chip.key] > 0 || quickFilter === chip.key ? (
            <button key={chip.key} type="button" aria-pressed={quickFilter === chip.key} onClick={() => onQuickFilter(quickFilter === chip.key ? '' : chip.key)} className={`${CHIP} ${quickFilter === chip.key ? chip.on : chip.off}`}>
              {chip.label}
              <span className="tabular-nums">{counts[chip.key]}</span>
            </button>
          ) : null
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {draftCount > 0 && !selecting && (
          <button type="button" onClick={onSaveDrafts} disabled={saving} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#1e40af] px-3.5 text-xs font-extrabold text-white shadow-sm transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 disabled:opacity-60">
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[18px]">{saving ? 'hourglass_empty' : 'save'}</span>
            {saving ? 'Guardando...' : `Guardar ${draftCount} ${draftCount === 1 ? 'cambio' : 'cambios'}`}
          </button>
        )}
        {!selecting && (
          <button type="button" onClick={onStartSelecting} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3.5 text-xs font-bold text-[#1e40af] shadow-sm transition-[background-color,transform] duration-150 hover:bg-blue-50 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[18px]">checklist</span>
            Seleccionar
          </button>
        )}
      </div>
    </div>
  );
}
