import { useEffect, useRef } from 'react';

const hideScrollbar = '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]';

const Count = ({ value, alert, active }) => {
  if (!value) return null;
  return (
    <span aria-label={`${value} pendientes`} className={`ml-auto min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-center text-xs font-extrabold tabular-nums ${alert ? 'bg-red-600 text-white' : active ? 'bg-[#facc15] text-[#12315f]' : 'bg-[#facc15] text-[#12315f]'}`}>{value > 99 ? '99+' : value}</span>
  );
};

// Navegación del panel: riel vertical en pantallas grandes, barra horizontal pegada arriba en el teléfono (una sola fila)
export default function ModNav({ items, value, onChange }) {
  const barRef = useRef(null);

  // En el teléfono la sección activa se centra sola en la barra
  useEffect(() => {
    const active = barRef.current?.querySelector('[aria-selected="true"]');
    active?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [value]);

  return (
    <>
      <nav aria-label="Secciones de moderación" className="sticky top-0 z-30 -mx-3 mb-3 bg-[#dbeafe]/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4 lg:hidden">
        <div ref={barRef} role="tablist" className={`flex gap-1.5 overflow-x-auto ${hideScrollbar}`}>
          {items.map((item) => (
            <button key={item.id} role="tab" type="button" aria-selected={value === item.id} onClick={() => onChange(item.id)} className={`flex h-11 shrink-0 items-center gap-2 rounded-full pl-3 pr-4 text-sm font-bold transition-colors ${value === item.id ? 'bg-[#12315f] text-white' : 'bg-white text-[#12315f] ring-1 ring-slate-300'}`}>
              <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {item.label}
              {item.count > 0 && <span className={`rounded-full px-1.5 text-xs font-extrabold tabular-nums ${item.alert ? 'bg-red-600 text-white' : 'bg-[#facc15] text-[#12315f]'}`}>{item.count > 99 ? '99+' : item.count}</span>}
            </button>
          ))}
        </div>
      </nav>

      <nav aria-label="Secciones de moderación" className="hidden w-60 shrink-0 self-start lg:sticky lg:top-4 lg:block">
        <div role="tablist" aria-orientation="vertical" className="flex flex-col gap-1">
          {items.map((item) => (
            <button key={item.id} role="tab" type="button" aria-selected={value === item.id} onClick={() => onChange(item.id)} className={`relative flex h-12 items-center gap-3 rounded-xl pl-4 pr-3 text-left text-[15px] font-bold transition-colors ${value === item.id ? 'bg-white text-[#12315f] shadow-sm ring-1 ring-slate-900/5' : 'text-slate-700 hover:bg-white/60'}`}>
              {value === item.id && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#facc15]" />}
              <span translate="no" aria-hidden="true" className={`material-symbols-outlined text-[22px] ${value === item.id ? 'text-[#1e40af]' : 'text-slate-500'}`}>{item.icon}</span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <Count value={item.count} alert={item.alert} active={value === item.id} />
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
