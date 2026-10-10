import { priceVerdict } from '../../utils/priceVerdict';

// Etiqueta "Buen precio / Precio justo / Sobre el mercado" junto a un precio
export default function PriceVerdict({ price, reference, showDetail = true, className = '' }) {
  const verdict = priceVerdict(price, reference);
  if (!verdict) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ring-1 ${verdict.tone} ${className}`}>
      <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[14px]">{verdict.icon}</span>
      {verdict.label}{showDetail && <span className="font-semibold opacity-80"> · {verdict.detail}</span>}
    </span>
  );
}
