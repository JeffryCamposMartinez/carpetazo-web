import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const normalize = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const GAP = 6; // px entre el botón y la lista
const MAX_LIST = 288; // alto máximo de la lista (18rem)

// Lista desplegable con el estilo de Carpetazo (reemplaza al <select> del navegador).
// options: [{ value, label, group? }]. La lista sale en un portal: no la recorta ningún panel ni ventana con scroll.
export default function ThemedSelect({
  value, onChange, options, placeholder = 'Selecciona', searchable = false, searchPlaceholder = 'Buscar…', emptyLabel = 'Sin resultados',
  icon, disabled = false, ariaLabel, className = '', buttonClassName = ''
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [box, setBox] = useState(null); // posición de la lista en pantalla
  const [moreBelow, setMoreBelow] = useState(false); // la lista tiene más opciones por ver hacia abajo
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const id = useId();

  const current = options.find((option) => String(option.value) === String(value));
  const q = normalize(query.trim());
  const visible = useMemo(() => (q ? options.filter((option) => normalize(option.label).includes(q) || (option.group && normalize(option.group).includes(q))) : options), [options, q]);

  // Posición: debajo del botón si cabe; si no, encima (con el espacio que haya)
  const place = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - GAP - 8;
    const above = rect.top - GAP - 8;
    const goUp = below < 200 && above > below;
    const room = Math.max(120, goUp ? above : below);
    setBox({ left: rect.left, width: rect.width, maxHeight: Math.min(MAX_LIST + (searchable ? 56 : 0), room), ...(goUp ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }) });
  };

  const close = () => { setOpen(false); setQuery(''); setActive(-1); };

  useEffect(() => {
    if (!open) return undefined;
    place();
    const onDown = (event) => { if (!buttonRef.current?.contains(event.target) && !listRef.current?.contains(event.target)) close(); };
    const onKey = (event) => { if (event.key === 'Escape') { close(); buttonRef.current?.focus(); } };
    const onMove = (event) => { if (!listRef.current?.contains(event.target)) place(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onMove, true);
    if (searchable) setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onMove, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // La opción elegida queda a la vista al abrir
  useEffect(() => {
    if (!open || !box) return;
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' });
  }, [open, !box]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkScroll = () => {
    const list = listRef.current?.querySelector('ul');
    if (list) setMoreBelow(list.scrollHeight - list.scrollTop - list.clientHeight > 8);
  };
  useEffect(() => { if (open && box) requestAnimationFrame(checkScroll); }, [open, !box, visible.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (option) => { onChange(option.value); close(); buttonRef.current?.focus(); };

  const onListKey = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(visible.length - 1, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(0, index - 1)); }
    else if (event.key === 'Enter' && visible[active]) { event.preventDefault(); choose(visible[active]); }
    else if (event.key === 'Enter' && searchable && visible.length === 1) { event.preventDefault(); choose(visible[0]); }
  };
  useEffect(() => { listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active]);

  let lastGroup = null;
  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(event) => { if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); setOpen(true); } }}
        className={`flex min-h-12 w-full items-center gap-2 rounded-xl border-2 bg-white px-3.5 text-left text-[15px] font-bold shadow-sm transition-[border-color,box-shadow,background-color] duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${open ? 'border-[#facc15] text-[#12315f]/70 ring-4 ring-[#facc15]/25' : value ? 'border-[#12315f] text-[#12315f]' : 'border-[#12315f]/25 text-[#12315f]/60 hover:border-[#12315f]/50'} ${buttonClassName}`}
      >
        {icon && <span translate="no" aria-hidden="true" className="material-symbols-outlined shrink-0 text-[20px] text-[#1e40af]">{icon}</span>}
        <span className={`min-w-0 flex-1 truncate ${current ? 'text-[#12315f]' : ''}`}>{current?.label || placeholder}</span>
        <span translate="no" aria-hidden="true" className={`material-symbols-outlined shrink-0 text-[22px] text-[#12315f] transition-transform duration-150 ${open ? 'rotate-180 text-[#b45309]' : ''}`}>expand_more</span>
      </button>

      {open && box && createPortal(
        <div
          ref={listRef}
          id={id}
          role="listbox"
          onKeyDown={onListKey}
          style={{ position: 'fixed', left: box.left, width: box.width, top: box.top, bottom: box.bottom, maxHeight: box.maxHeight }}
          className="select-pop relative z-[3100] flex flex-col overflow-hidden rounded-xl border-2 border-[#12315f] bg-white shadow-[0_16px_36px_-8px_rgba(18,49,95,0.45)]"
        >
          {searchable && (
            <div className="shrink-0 border-b border-[#12315f]/10 bg-slate-50 p-2">
              <div className="relative">
                <span translate="no" aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[#12315f]/50">search</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setActive(0); }}
                  onKeyDown={onListKey}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="h-10 w-full rounded-lg border-2 border-[#12315f]/15 bg-white pl-10 pr-3 text-base font-semibold text-[#12315f] placeholder-[#12315f]/40 outline-none focus:border-[#facc15] focus:ring-2 focus:ring-[#facc15]/25"
                />
              </div>
            </div>
          )}
          <ul onScroll={checkScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 custom-scrollbar">
            {visible.map((option, index) => {
              const header = option.group && option.group !== lastGroup ? option.group : null;
              lastGroup = option.group || lastGroup;
              const selected = String(option.value) === String(value);
              return (
                <li key={`${option.group || ''}-${option.value}`} role="presentation">
                  {header && <p className="px-3.5 pb-1 pt-2.5 text-xs font-extrabold text-[#12315f]/55">{header}</p>}
                  <div
                    role="option"
                    aria-selected={selected}
                    data-active={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(option)}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 px-3.5 text-[15px] font-bold transition-colors ${selected ? 'bg-[#12315f] text-[#facc15]' : index === active ? 'bg-[#facc15]/25 text-[#12315f]' : 'text-[#12315f] hover:bg-[#facc15]/20'}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {selected && <span translate="no" aria-hidden="true" className="material-symbols-outlined shrink-0 text-[20px]">check</span>}
                  </div>
                </li>
              );
            })}
            {visible.length === 0 && <li className="px-3.5 py-3 text-sm font-semibold text-[#12315f]/55">{emptyLabel}</li>}
          </ul>
          {moreBelow && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 flex h-9 items-end justify-center bg-gradient-to-t from-white via-white/90 to-transparent pb-0.5">
              <span translate="no" className="material-symbols-outlined text-[22px] text-[#12315f]">keyboard_arrow_down</span>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
