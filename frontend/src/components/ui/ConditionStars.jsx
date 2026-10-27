import { conditionLabel } from '../../config/cardConditions';

// Estado de la carta como estrellas (una por cada punto del 1 al 5). No muestra nada si no hay estado.
export default function ConditionStars({ value, withName = false, className = '' }) {
  const stars = Number(value);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return null;
  const name = conditionLabel(stars);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 ${className}`} title={`Estado: ${name}`} aria-label={`Estado ${name}, ${stars} de 5 estrellas`}>
      <span aria-hidden="true" className="text-[13px] leading-none tracking-tight text-[#f5b800]">{'★'.repeat(stars)}</span>
      {withName && <span className="text-[11px] font-bold text-slate-600">{name}</span>}
    </span>
  );
}
