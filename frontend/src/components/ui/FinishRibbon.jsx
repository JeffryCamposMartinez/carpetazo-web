// Franja diagonal en la esquina de la imagen para las versiones foil (Reverse Holofoil…). El contenedor debe ser `relative overflow-hidden`.
// `compact`: para miniaturas de unos 60 px de ancho.
export default function FinishRibbon({ finish, compact = false }) {
  if (!finish) return null;
  const size = compact
    ? '-left-[28px] bottom-[16px] w-[100px] text-[7px] leading-3'
    : '-left-[37px] bottom-[26px] w-36 text-[10px] leading-4';
  return (
    <span className={`pointer-events-none absolute z-20 rotate-45 whitespace-nowrap bg-[#facc15] py-0.5 text-center font-extrabold text-[#12315f] shadow-[0_1px_3px_rgba(0,0,0,0.35)] ${size}`}>
      {finish}
    </span>
  );
}
