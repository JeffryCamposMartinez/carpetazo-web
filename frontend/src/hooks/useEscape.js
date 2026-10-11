import { useEffect, useRef } from 'react';

// Esc cierra solo lo que está más arriba (p. ej. el visor de una foto abierto sobre el panel de datos), no todo a la vez.
// Cada panel que se abre se apila; el último en abrirse es el que responde.
const stack = [];
let bound = false;

const onKey = (event) => {
  if (event.key !== 'Escape' || stack.length === 0) return;
  stack[stack.length - 1].handler(event);
};

export default function useEscape(active, handler) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!active) return undefined;
    const entry = { handler: (event) => latest.current?.(event) };
    stack.push(entry);
    if (!bound) { window.addEventListener('keydown', onKey); bound = true; }
    return () => {
      const at = stack.indexOf(entry);
      if (at >= 0) stack.splice(at, 1);
      if (stack.length === 0 && bound) { window.removeEventListener('keydown', onKey); bound = false; }
    };
  }, [active]);
}
