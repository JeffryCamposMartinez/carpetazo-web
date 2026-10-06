// Ubicación general del vendedor ("Chillán, Ñuble"). No se muestra si no la ha indicado.
export default function LocationLine({ comuna, region, className = '', showRegion = true }) {
  if (!comuna) return null;
  const text = showRegion && region ? `${comuna}, ${region}` : comuna;
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 ${className}`} title={text}>
      <span translate="no" aria-hidden="true" className="material-symbols-outlined shrink-0 text-[1.1em]">location_on</span>
      <span className="truncate">{text}</span>
    </span>
  );
}
