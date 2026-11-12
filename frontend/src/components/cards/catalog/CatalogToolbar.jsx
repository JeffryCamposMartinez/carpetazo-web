import SvgIcon from '../../ui/SvgIcon';
import ThemedSelect from '../../ui/ThemedSelect';

export const SORTS = [
  { value: 'num', label: 'Número ↑' },
  { value: 'num-desc', label: 'Número ↓' },
  { value: 'az', label: 'Nombre A–Z' },
  { value: 'za', label: 'Nombre Z–A' },
];
export const VIEWS = [
  { value: 'grid', label: 'Cartas grandes', icon: 'grid_view' },
  { value: 'compact', label: 'Cartas pequeñas', icon: 'apps' },
  { value: 'list', label: 'Lista', icon: 'view_list' },
];

// Orden y forma de ver las cartas de la edición
export default function CatalogToolbar({ sort, onSort, view, onView }) {
  return (
    <div className="mt-3 flex items-center justify-center gap-2">
      <ThemedSelect
        ariaLabel="Ordenar cartas"
        icon="swap_vert"
        value={sort}
        onChange={onSort}
        options={SORTS}
        className="min-w-0 flex-1 sm:max-w-xs"
        buttonClassName="h-11 rounded-full bg-white ring-1 ring-slate-900/10 text-sm font-extrabold text-[#12315f]"
      />
      <div role="group" aria-label="Forma de ver las cartas" className="flex h-11 shrink-0 items-center gap-0.5 rounded-full bg-white p-1 ring-1 ring-slate-900/10">
        {VIEWS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onView(item.value)}
            aria-pressed={view === item.value}
            aria-label={item.label}
            title={item.label}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${view === item.value ? 'bg-[#12315f] text-white' : 'text-[#12315f] [@media(hover:hover)]:hover:bg-blue-50'}`}
          >
            <SvgIcon name={item.icon} translate="no" aria-hidden="true" className="text-[20px]" />
          </button>
        ))}
      </div>
    </div>
  );
}
