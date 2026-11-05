// Franja diagonal en la esquina de la imagen para las versiones foil (Reverse Holofoil…). El contenedor debe ser `relative overflow-hidden`.
export default function FinishRibbon({ finish }) {
  if (!finish) return null;
  return (
    <span className="pointer-events-none absolute -left-10 bottom-5 z-20 w-36 -rotate-45 bg-[#facc15] py-0.5 text-center text-[10px] font-extrabold leading-tight text-[#12315f] shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
      {finish}
    </span>
  );
}
