import SvgIcon from './SvgIcon';
const BADGE_STYLE = {
  free: { image: '/images/plans/common-mark.svg', classes: 'border-slate-300 bg-slate-50 text-slate-700' },
  enthusiast: { image: '/images/plans/enthusiast-tag.svg', classes: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  premium: { image: '/images/plans/premium-tag.svg', classes: 'border-sky-300 bg-sky-50 text-sky-900' },
  pro: { image: '/images/plans/pro-tag.svg', classes: 'border-violet-300 bg-violet-50 text-violet-800' },
  store: { image: '/images/plans/store-tag.svg', classes: 'border-amber-300 bg-amber-50 text-amber-900' }
};

export const PLAN_BADGE_HINT = 'Esta insignia muestra el plan contratado en Carpetazo. No reemplaza la verificación de identidad del vendedor.';

export default function PlanBadge({ badge, compact = false, iconRight = false, className = '' }) {
  const style = badge?.key ? BADGE_STYLE[badge.key] : null;
  if (!style) return null;
  return (
    <span
      title={PLAN_BADGE_HINT}
      aria-label={`Plan ${badge.label}`}
      className={`inline-flex shrink-0 items-center rounded-full border font-black uppercase tracking-wide ${compact ? 'h-6 gap-0.5 px-1.5 text-[10px]' : 'min-h-7 gap-1 px-2.5 py-1 text-[11px]'} ${style.classes} ${className}`}
    >
      {iconRight && badge.label}
      {style.image
        ? <img src={style.image} alt="" aria-hidden="true" className={`${compact ? 'h-5 w-5' : 'h-6 w-6'} object-contain`} />
        : <SvgIcon name={style.icon} translate="no" aria-hidden="true" className={`${compact ? 'text-[14px]' : 'text-[16px]'}`} />}
      {!iconRight && badge.label}
    </span>
  );
}
