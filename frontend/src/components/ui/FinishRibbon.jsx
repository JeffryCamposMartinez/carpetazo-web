import { useLayoutEffect, useRef, useState } from 'react';

// Franja diagonal en una esquina de la imagen para las versiones foil (Reverse Holofoil…).
// Se dimensiona según el ancho de la carta donde se use (miniatura, tarjeta, álbum o PDF): el contenedor solo debe ser `relative`.
// `corner`: 'bl' (abajo a la izquierda) o 'br' (abajo a la derecha). Los tamaños se calculan en px (y no con unidades de contenedor)
// para que también se dibuje bien en los PDF (html2canvas). `pdf`: html2canvas dibuja el texto un poco más abajo que el navegador; se compensa.
export default function FinishRibbon({ finish, corner = 'bl', pdf = false }) {
  const layer = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = layer.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.offsetWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [finish]);
  if (!finish) return null;

  const right = corner === 'br';
  const leg = width * 0.7; // cuánto de cada borde corta la franja
  // Letra: proporcional a la carta, sin pasar de lo que cabe en la franja (acabados largos se achican); piso de 6 px para las miniaturas
  const font = Math.max(6, Math.min(width * 0.11, (leg * 1.414 * 0.92) / (String(finish).length * 0.58)));
  const ribbon = width > 0 ? {
    left: right ? `calc(100% - ${leg / 2}px)` : `${leg / 2}px`,
    top: `calc(100% - ${leg / 2}px)`,
    width: width * 1.8,
    height: font * 2,
    transform: `translate(-50%, -50%) rotate(${right ? -45 : 45}deg)`,
    fontSize: font,
  } : null;

  return (
    <span ref={layer} className="pointer-events-none absolute inset-0 z-20 overflow-hidden" style={{ borderRadius: 'inherit' }}>
      {ribbon && (
        <span className="absolute flex items-center justify-center whitespace-nowrap bg-[#facc15] text-center font-extrabold leading-none text-[#12315f] shadow-[0_2px_4px_rgba(0,0,0,0.4)]" style={ribbon}>
          <span className="relative" style={pdf ? { top: `${-font * 0.33}px` } : undefined}>{finish}</span>
        </span>
      )}
    </span>
  );
}
