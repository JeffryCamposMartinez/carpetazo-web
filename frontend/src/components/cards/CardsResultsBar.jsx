const SORT_OPTIONS = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
];
export const SORT_VALUES = SORT_OPTIONS.map((option) => option.value);

const REMOVABLE = 'inline-flex h-9 items-center gap-1 rounded-full bg-white pl-3 pr-1.5 text-xs font-bold text-[#12315f] ring-1 ring-slate-900/10 transition-[background-color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] [@media(hover:hover)]:hover:bg-blue-50';

// Cantidad de cartas, filtros activos (cada uno se quita con un toque), orden y vista (cuadrícula o lista en el celular)
export default function CardsResultsBar({ failed, loading, onClearAll, onQuery, onSort, onTcg, onView, query, sort, tcg, total, view }) {
  const hasFilters = Boolean(query || tcg);
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
        <p className="min-w-0 basis-full text-[15px] sm:basis-auto font-extrabold text-[#12315f]" aria-live="polite">
          {loading ? <span className="font-semibold text-slate-500">Buscando cartas…</span> : failed ? '' : (
            <><span className="tabular-nums">{total.toLocaleString('es-CL')}</span> {total === 1 ? 'carta a la venta' : 'cartas a la venta'}</>
          )}
        </p>
        <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
          <label className="relative flex min-w-0 flex-1 items-center sm:flex-none">
            <span className="sr-only">Ordenar</span>
            <select value={sort} onChange={(event) => onSort(event.target.value)} className="h-10 w-full appearance-none rounded-full border-0 bg-white pl-3.5 pr-9 text-[13px] font-bold text-[#12315f] ring-1 ring-slate-900/10 focus:outline-none focus:ring-2 focus:ring-[#1e40af]">
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span translate="no" aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute right-2 text-[20px] text-slate-500">expand_more</span>
          </label>
          <div role="group" aria-label="Vista" className="flex h-10 items-center rounded-full bg-white p-1 ring-1 ring-slate-900/10 lg:hidden">
            {[{ value: 'grid', icon: 'grid_view', label: 'Cuadrícula' }, { value: 'list', icon: 'view_agenda', label: 'Lista' }].map((option) => (
              <button key={option.value} type="button" aria-pressed={view === option.value} aria-label={option.label} onClick={() => onView(option.value)} className={`flex h-8 w-9 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${view === option.value ? 'bg-[#12315f] text-white' : 'text-slate-500'}`}>
                <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">{option.icon}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {tcg && <button type="button" onClick={() => onTcg('')} className={REMOVABLE}>{tcg}<span translate="no" aria-hidden="true" className="material-symbols-outlined text-[18px] text-slate-500">close</span><span className="sr-only">Quitar filtro</span></button>}
          {query && <button type="button" onClick={() => onQuery('')} className={REMOVABLE}>“{query}”<span translate="no" aria-hidden="true" className="material-symbols-outlined text-[18px] text-slate-500">close</span><span className="sr-only">Quitar búsqueda</span></button>}
          {tcg && query && <button type="button" onClick={onClearAll} className="h-9 rounded-full px-3 text-xs font-bold text-[#1e40af] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">Quitar todo</button>}
        </div>
      )}
    </div>
  );
}
