import { useEffect, useRef } from 'react';

const hideScrollbar = '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]';

const Count = ({ value, alert, active }) => {
  if (!value) return null;
  const tone = alert ? 'bg-red-600 text-white' : active ? 'bg-[#facc15] text-[#12315f]' : 'bg-[#12315f]/10 text-[#12315f]';
  return <span aria-label={`${value} pendientes`} className={`ml-auto min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-center text-xs font-extrabold tabular-nums ${tone}`}>{value > 99 ? '99+' : value}</span>;
};

// Navegación del panel: riel con secciones agrupadas en pantallas grandes, barra horizontal pegada arriba en el teléfono (una sola fila)
export default function ModNav({ items, groups, value, onChange }) {
  const barRef = useRef(null);
  const railRef = useRef(null);

  // En el teléfono la sección activa se centra sola en la barra
  useEffect(() => {
    const active = barRef.current?.querySelector('[aria-selected="true"]');
    active?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [value]);

  // Flechas, Inicio y Fin mueven el foco entre secciones; Enter o Espacio abren la que tiene el foco
  const onRailKeys = (event) => {
    const tabs = [...railRef.current.querySelectorAll('[role="tab"]')];
    const at = tabs.indexOf(document.activeElement);
    if (at < 0) return;
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: tabs.length - 1 }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    tabs[(to + tabs.length) % tabs.length].focus();
  };

  return (
    <>
      <nav aria-label="Secciones de moderación" className="sticky top-0 z-30 border-b border-[#dbe3f0] bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
        <div ref={barRef} role="tablist" className={`flex gap-1.5 overflow-x-auto ${hideScrollbar}`}>
          {items.map((item) => (
            <button key={item.id} role="tab" type="button" aria-selected={value === item.id} onClick={() => onChange(item.id)} className={`flex h-11 shrink-0 items-center gap-2 rounded-full pl-3 pr-4 text-sm font-bold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-1 ${value === item.id ? 'bg-[#12315f] text-white' : 'bg-[#eef2fa] text-[#12315f]'}`}>
              <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">{item.icon}</span>
              {item.shortLabel || item.label}
              {item.count > 0 && <span className={`rounded-full px-1.5 text-xs font-extrabold tabular-nums ${item.alert ? 'bg-red-600 text-white' : 'bg-[#facc15] text-[#12315f]'}`}>{item.count > 99 ? '99+' : item.count}</span>}
            </button>
          ))}
        </div>
      </nav>

      <nav aria-label="Secciones de moderación" className="hidden w-64 shrink-0 border-r border-[#dbe3f0] bg-[#f6f8fd] px-3 pb-6 pt-2 lg:block">
        <div ref={railRef} role="tablist" aria-orientation="vertical" onKeyDown={onRailKeys} className="sticky top-4">
          {groups.map((group) => {
            const members = items.filter((item) => item.group === group.id);
            if (!members.length) return null;
            return (
              <div key={group.id} role="presentation" className="pt-4 first:pt-2">
                <p className="px-3 pb-1.5 text-xs font-bold text-slate-500">{group.label}</p>
                <div role="presentation" className="flex flex-col gap-0.5">
                  {members.map((item) => {
                    const active = value === item.id;
                    return (
                      <button key={item.id} role="tab" type="button" aria-selected={active} tabIndex={active ? 0 : -1} onClick={() => onChange(item.id)} className={`flex h-11 items-center gap-3 rounded-lg px-3 text-left text-[15px] font-bold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${active ? 'bg-[#12315f] text-white shadow-[0_4px_12px_-4px_rgba(18,49,95,0.55)]' : 'text-slate-700 [@media(hover:hover)]:hover:bg-[#e6ecf7]'}`}>
                        <span translate="no" aria-hidden="true" className={`material-symbols-outlined text-[22px] ${active ? 'text-[#facc15]' : 'text-slate-500'}`}>{item.icon}</span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <Count value={item.count} alert={item.alert} active={active} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </nav>
    </>
  );
}
