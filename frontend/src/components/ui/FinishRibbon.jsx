// Franja diagonal en la esquina de la imagen para las versiones foil (Reverse Holofoil…). El contenedor debe ser `relative overflow-hidden`.
// `compact`: para miniaturas de unos 60 a 100 px de ancho. `corner`: 'bl' (abajo a la izquierda) o 'br' (abajo a la derecha).
export default function FinishRibbon({ finish, compact = false, corner = 'bl' }) {
  if (!finish) return null;
  const right = corner === 'br';
  const size = compact
    ? `${right ? '-right-[28px] -rotate-45' : '-left-[28px] rotate-45'} bottom-[16px] w-[100px] text-[7px] leading-3`
    : `${right ? '-right-[37px] -rotate-45' : '-left-[37px] rotate-45'} bottom-[26px] w-36 text-[10px] leading-4`;
  return (
    <span className={`pointer-events-none absolute z-20 whitespace-nowrap bg-[#facc15] py-0.5 text-center font-extrabold text-[#12315f] shadow-[0_1px_3px_rgba(0,0,0,0.35)] ${size}`}>
      {finish}
    </span>
  );
}
