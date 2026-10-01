import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Grupo de opciones con un indicador que se desliza de una a otra como un líquido: el borde que avanza se
// adelanta y el otro lo alcanza después. El movimiento usa solo `transform` (lo resuelve la tarjeta gráfica, sin
// recalcular el diseño), así se mantiene a 60 o 120 cuadros por segundo aunque la página cargue datos al mismo tiempo.
const DURATION_MS = 420;
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

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
  layout = 'grid', // 'grid': columnas iguales · 'inline': cada opción con su ancho
  // 'x': el indicador ocupa todo el alto y se desliza en horizontal (comportamiento original)
  // 'auto': toma la caja exacta del botón activo y se estira en la dirección del cambio (sirve en fila o en columna)
  axis = 'x',
  indicatorStyle,
  activeTextStyle,
  inactiveTextStyle,
}) {
  const containerRef = useRef(null);
  const buttonRefs = useRef([]);
  const indicatorRef = useRef(null);
  const previousBox = useRef(null);
  const animateRef = useRef(false);
  const [box, setBox] = useState(null); // { left, width } del botón activo
  const foundIndex = options.findIndex(o => String(o.value) === String(value));
  const hasActive = foundIndex >= 0; // si ninguna coincide, no se muestra el indicador
  const activeIndex = Math.max(0, foundIndex);

  const measure = () => {
    const btn = buttonRefs.current[activeIndex];
    if (!containerRef.current || !btn) return;
    const next = { left: btn.offsetLeft, width: btn.offsetWidth, top: btn.offsetTop, height: btn.offsetHeight };
    setBox((previous) => (previous && ['left', 'width', 'top', 'height'].every((key) => previous[key] === next[key]) ? previous : next));
  };

  const measureRef = useRef(measure);
  measureRef.current = measure;

  useLayoutEffect(measure, [activeIndex, options.length]);

  // Posición final y animación del cambio: la forma final se fija de una vez y se anima solo con transform
  useLayoutEffect(() => {
    const el = indicatorRef.current;
    if (!el || !box) return;
    const before = previousBox.current;
    previousBox.current = box;
    el.style.width = `${box.width}px`;
    if (axis === 'auto') {
      el.style.height = `${box.height}px`;
      el.style.transform = `translate3d(${box.left}px, ${box.top}px, 0)`;
    } else {
      el.style.transform = `translate3d(${box.left}px, 0, 0)`;
    }
    if (!before || !animateRef.current || typeof el.animate !== 'function') return;
    if (['left', 'width', 'top', 'height'].every((key) => before[key] === box[key])) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    if (axis === 'auto') {
      // Igual que en horizontal, pero en los dos ejes: primero cubre ambas opciones y luego se recoge en la nueva
      const minLeft = Math.min(before.left, box.left);
      const maxRight = Math.max(before.left + before.width, box.left + box.width);
      const minTop = Math.min(before.top, box.top);
      const maxBottom = Math.max(before.top + before.height, box.top + box.height);
      el.getAnimations?.().forEach((animation) => animation.cancel());
      el.animate(
        [
          { transform: `translate3d(${before.left}px, ${before.top}px, 0) scale(${before.width / box.width}, ${before.height / box.height})` },
          { transform: `translate3d(${minLeft}px, ${minTop}px, 0) scale(${(maxRight - minLeft) / box.width}, ${(maxBottom - minTop) / box.height})`, offset: 0.45 },
          { transform: `translate3d(${box.left}px, ${box.top}px, 0) scale(1, 1)` },
        ],
        { duration: DURATION_MS, easing: EASING }
      );
      return;
    }

    const minLeft = Math.min(before.left, box.left);
    const maxRight = Math.max(before.left + before.width, box.left + box.width);
    el.getAnimations?.().forEach((animation) => animation.cancel());
    el.animate(
      [
        { transform: `translate3d(${before.left}px, 0, 0) scaleX(${before.width / box.width})` },
        { transform: `translate3d(${minLeft}px, 0, 0) scaleX(${(maxRight - minLeft) / box.width})`, offset: 0.45 },
        { transform: `translate3d(${box.left}px, 0, 0) scaleX(1)` },
      ],
      { duration: DURATION_MS, easing: EASING }
    );
  }, [box, hasActive]);

  // Al cambiar el tamaño se recoloca el indicador sin animar
  useEffect(() => {
    const id = setTimeout(() => { animateRef.current = true; }, 50); // sin animación en el primer pintado
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => { animateRef.current = false; measureRef.current(); setTimeout(() => { animateRef.current = true; }, 50); })
      : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);
    return () => { clearTimeout(id); ro?.disconnect(); };
  }, []);

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={ariaLabel}
      className={`relative ${layout === 'inline' ? 'flex items-center' : 'grid'} ${className}`}
      style={layout === 'inline' ? undefined : { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {box && hasActive && (
        <span
          ref={indicatorRef}
          aria-hidden="true"
          className={`pointer-events-none absolute left-0 top-0 ${axis === 'auto' ? '' : 'bottom-0'} ${indicatorClassName}`}
          style={{ transformOrigin: axis === 'auto' ? '0 0' : '0 50%', willChange: 'transform', ...indicatorStyle }}
        />
      )}
      {options.map((o, i) => {
        const active = hasActive && i === activeIndex;
        return (
          <button
            type="button"
            key={o.value}
            ref={el => { buttonRefs.current[i] = el; }}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            style={active ? activeTextStyle : inactiveTextStyle}
            className={`relative z-10 outline-none transition-colors duration-300 ${active ? activeTextClassName : inactiveTextClassName} ${buttonClassName}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
