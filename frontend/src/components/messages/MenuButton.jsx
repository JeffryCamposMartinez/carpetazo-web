import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useEscape from '../../hooks/useEscape';
import SvgIcon from '../ui/SvgIcon';

// Botón de tres puntos con su menú desplegable (portal: no lo recorta ningún contenedor). Teclado: flechas, Enter y Esc.
export default function MenuButton({ items, label = 'Más opciones', icon = 'more_vert', buttonClassName = '', onDark = false }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState({ top: 0, right: 8 });
  const button = useRef(null);
  const menu = useRef(null);
  const shown = items.filter((item) => !item.hidden);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onKey = (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const nodes = [...menu.current.querySelectorAll('button')];
      const at = nodes.indexOf(document.activeElement);
      nodes[(at + (event.key === 'ArrowDown' ? 1 : -1) + nodes.length) % nodes.length]?.focus();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    menu.current?.querySelector('button')?.focus({ preventScroll: true });
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', close); };
  }, [open]);

  useEscape(open, () => { setOpen(false); button.current?.focus(); });

  const toggle = () => {
    const rect = button.current?.getBoundingClientRect();
    if (rect) setPlace({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
    setOpen((value) => !value);
  };

  return (
    <>
      <button ref={button} type="button" onClick={toggle} aria-label={label} aria-haspopup="menu" aria-expanded={open} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] ${onDark ? 'text-white hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'} ${buttonClassName}`}>
        <SvgIcon name={icon} translate="no" aria-hidden="true" />
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[85]" role="presentation">
          <button type="button" aria-label="Cerrar menú" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0 cursor-default" />
          <ul ref={menu} role="menu" aria-label={label} className="chat-pop absolute w-60 overflow-hidden rounded-2xl bg-white py-1 shadow-[0_12px_36px_-8px_rgba(8,18,42,0.45)] ring-1 ring-black/5" style={{ top: place.top, right: place.right }}>
            {shown.map((item) => (
              <li key={item.id} role="none">
                <button type="button" role="menuitem" onClick={() => { setOpen(false); item.onClick(); }} className={`flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] font-semibold transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-100 ${item.danger ? 'text-red-600' : 'text-slate-800'}`}>
                  {item.icon && <SvgIcon name={item.icon} translate="no" aria-hidden="true" className={`text-[22px] ${item.danger ? 'text-red-500' : 'text-slate-500'}`} />}
                  <span className="flex-1">{item.label}</span>
                  {item.badge > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#facc15] px-1.5 text-[11px] font-black text-[#12315f]">{item.badge}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </>
  );
}
