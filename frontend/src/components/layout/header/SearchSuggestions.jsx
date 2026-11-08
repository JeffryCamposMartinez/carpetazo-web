import SvgIcon from '../../ui/SvgIcon';

// Panel bajo el buscador: lo que esta persona buscó hace poco (solo en su navegador) y lo que más buscan todos
export default function SearchSuggestions({ recent, popular, onPick, onRemove, onClear }) {
  if (!recent.length && !popular.length) return null;
  return (
    // onMouseDown: el campo conserva el foco, así el panel no se cierra antes de que el toque llegue al botón
    <div onMouseDown={(e) => e.preventDefault()} className="absolute inset-x-0 top-full z-50 mt-2 max-h-[min(24rem,60svh)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-2 text-left shadow-[0_18px_40px_-12px_rgba(8,18,42,0.55),0_2px_6px_rgba(8,18,42,0.25)] ring-1 ring-[#12315f]/10">
      {recent.length > 0 && (
        <section aria-label="Búsquedas recientes">
          <div className="flex items-center justify-between px-2 pb-1 pt-1">
            <h2 className="text-xs font-bold text-[#12315f]/70">Búsquedas recientes</h2>
            <button type="button" onClick={onClear} className="rounded-full px-2 py-0.5 text-xs font-semibold text-[#1e40af] transition-colors hover:bg-[#1e40af]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">Borrar todo</button>
          </div>
          <ul>
            {recent.map((term) => (
              <li key={term} className="group flex items-center rounded-xl transition-colors hover:bg-[#facc15]/25 focus-within:bg-[#facc15]/25">
                <button type="button" onClick={() => onPick(term)} className="flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left text-[15px] font-medium text-[#12315f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
                  <SvgIcon name="history" translate="no" aria-hidden="true" className="shrink-0 text-[20px] text-[#1e40af]/70" />
                  <span className="truncate">{term}</span>
                </button>
                <button type="button" onClick={() => onRemove(term)} aria-label={`Quitar ${term} de las recientes`} className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#12315f]/50 transition-[color,background-color,transform] hover:bg-[#12315f]/10 hover:text-[#12315f] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">
                  <SvgIcon name="close" translate="no" aria-hidden="true" className="text-[18px]" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {popular.length > 0 && (
        <section aria-label="Búsquedas populares" className={recent.length > 0 ? 'mt-1 border-t border-[#12315f]/10 pt-2' : ''}>
          <h2 className="px-2 pb-1.5 text-xs font-bold text-[#12315f]/70">Búsquedas populares</h2>
          <ul className="flex flex-wrap gap-1.5 px-1 pb-1">
            {popular.map((term) => (
              <li key={term}>
                <button type="button" onClick={() => onPick(term)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#12315f]/[0.06] px-3 text-sm font-semibold text-[#12315f] transition-[background-color,transform] hover:bg-[#facc15] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
                  <SvgIcon name="local_fire_department" translate="no" aria-hidden="true" className="text-[16px] text-[#1e40af]" />
                  {term}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
