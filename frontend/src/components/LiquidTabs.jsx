import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Grupo de opciones con un indicador azul que se desliza de una a otra como un líquido:
// el borde que avanza se mueve primero y el otro lo alcanza después.
export default function LiquidTabs({
  options,
  value,
  onChange,
  className = '',
  buttonClassName = '',
  ariaLabel,
  indicatorClassName = 'rounded-[inherit] border-b-4 border-yellow-400 bg-blue-900',
  activeTextClassName = 'text-yellow-400',
  inactiveTextClassName = 'text-blue-900 hover:text-blue-900/70',
}) {
  const containerRef = useRef(null);
  const buttonRefs = useRef([]);
  const prevIndexRef = useRef(null);
  const [box, setBox] = useState(null); // { left, right, forward }
  const [animate, setAnimate] = useState(false);
  const activeIndex = Math.max(0, options.findIndex(o => String(o.value) === String(value)));

  const measure = () => {
    const container = containerRef.current;
    const btn = buttonRefs.current[activeIndex];
    if (!container || !btn) return;
    const prev = prevIndexRef.current;
    setBox({
      left: btn.offsetLeft,
      right: container.clientWidth - (btn.offsetLeft + btn.offsetWidth),
      forward: prev === null ? true : activeIndex >= prev,
    });
    prevIndexRef.current = activeIndex;
  };

  const measureRef = useRef(measure);
  measureRef.current = measure;

  useLayoutEffect(measure, [activeIndex, options.length]);

  // Al cambiar el tamaño se recoloca el indicador sin animar
  useEffect(() => {
    const id = setTimeout(() => setAnimate(true), 50); // sin animación en el primer pintado
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => { setAnimate(false); measureRef.current(); setTimeout(() => setAnimate(true), 50); })
      : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);
    return () => { clearTimeout(id); ro?.disconnect(); };
  }, []);

  // El borde delantero usa una transición corta y el trasero una más larga: efecto "gota"
  const lead = '280ms cubic-bezier(0.22, 1, 0.36, 1)';
  const trail = '460ms cubic-bezier(0.22, 1, 0.36, 1) 40ms';
  const transition = !animate || !box ? 'none' : box.forward ? `right ${lead}, left ${trail}` : `left ${lead}, right ${trail}`;

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={ariaLabel}
      className={`relative grid ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {box && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-0 top-0 ${indicatorClassName}`}
          style={{ left: box.left, right: box.right, transition }}
        />
      )}
      {options.map((o, i) => {
        const active = i === activeIndex;
        return (
          <button
            type="button"
            key={o.value}
            ref={el => { buttonRefs.current[i] = el; }}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`relative z-10 outline-none transition-colors duration-300 ${active ? activeTextClassName : inactiveTextClassName} ${buttonClassName}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
