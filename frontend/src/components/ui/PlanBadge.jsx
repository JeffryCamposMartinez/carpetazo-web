const BADGE_STYLE = {
  enthusiast: { icon: 'local_fire_department', classes: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  premium: { icon: 'workspace_premium', classes: 'border-amber-300 bg-amber-50 text-amber-900' },
  pro: { icon: 'diamond', classes: 'border-violet-300 bg-violet-50 text-violet-800' },
  store: { icon: 'storefront', classes: 'border-sky-300 bg-sky-50 text-sky-900' }
};

export const PLAN_BADGE_HINT = 'Esta insignia muestra el plan contratado en Carpetazo. No reemplaza la verificación de identidad del vendedor.';

export default function PlanBadge({ badge, compact = false, className = '' }) {
  const style = badge?.key ? BADGE_STYLE[badge.key] : null;
  if (!style) return null;
  return (
    <span
      title={PLAN_BADGE_HINT}
      aria-label={`Plan ${badge.label}`}
      className={`inline-flex shrink-0 items-center rounded-full border font-black uppercase tracking-wide ${compact ? 'h-6 gap-0.5 px-1.5 text-[10px]' : 'min-h-7 gap-1 px-2.5 py-1 text-[11px]'} ${style.classes} ${className}`}
    >
      <span translate="no" aria-hidden="true" className={`material-symbols-outlined ${compact ? 'text-[14px]' : 'text-[16px]'}`}>{style.icon}</span>
      {badge.label}
    </span>
  );
}
