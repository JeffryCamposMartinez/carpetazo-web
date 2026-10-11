import { getCardStyle } from './profileStyles';
import { VERIFIED_HINT } from '../ui/VerifiedBadge';

// "~20 min", "~3 h", "~2 días": tiempo típico que tarda en contestar
export const formatResponseTime = (minutes) => {
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 60) return `~${Math.max(1, Math.round(minutes))} min`;
  if (minutes < 24 * 60) return `~${Math.round(minutes / 60)} h`;
  const days = Math.round(minutes / (24 * 60));
  return `~${days} ${days === 1 ? 'día' : 'días'}`;
};
const memberSinceLabel = (date) => {
  const parsed = date ? new Date(date) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' }).replace('.', '') : '';
};

// Franja de confianza bajo la presentación: reseñas, carpetas, cartas y nivel, con datos reales del vendedor
export default function ProfileTrustStrip({ completedSales = 0, folders, memberSince, profileLevel, publicTheme, responseTime, reviewSummary, totalCards, verified }) {
  const reviews = reviewSummary || { count: 0, showAverage: false };
  const items = [
    reviews.showAverage
      ? { icon: 'star', filled: true, value: reviews.average.toFixed(1).replace('.', ','), label: `${reviews.count} reseñas`, href: '#resenas', star: true }
      : { icon: 'star', filled: reviews.count > 0, value: reviews.count, label: reviews.count === 1 ? 'reseña' : 'reseñas', href: '#resenas', star: reviews.count > 0 },
    { icon: 'folder_open', value: folders, label: folders === 1 ? 'carpeta' : 'carpetas' },
    { icon: 'style', value: totalCards.toLocaleString('es-CL'), label: totalCards === 1 ? 'carta' : 'cartas' },
    { icon: 'military_tech', value: profileLevel, label: 'nivel' },
  ];

  // Señales que se calculan con datos reales de la plataforma: solo aparecen las que existen
  const chips = [
    verified && { icon: 'verified', filled: true, label: 'Vendedor verificado', hint: VERIFIED_HINT },
    responseTime && { icon: 'schedule', label: `Suele responder en ${formatResponseTime(responseTime.medianMinutes)}`, hint: 'Tiempo típico en contestar los mensajes de los últimos 90 días.' },
    completedSales > 0 && { icon: 'task_alt', label: `${completedSales.toLocaleString('es-CL')} ${completedSales === 1 ? 'venta confirmada' : 'ventas confirmadas'}`, hint: 'Pedidos que el vendedor confirmó como concretados en Carpetazo.' },
    memberSinceLabel(memberSince) && { icon: 'calendar_month', label: `En Carpetazo desde ${memberSinceLabel(memberSince)}` }
  ].filter(Boolean);

  return (
    <section aria-label="Confianza del vendedor" className="relative z-10 mx-auto w-full max-w-[1220px] px-4 pt-5 sm:px-6 md:px-8">
      <ul className="grid grid-cols-2 overflow-hidden ring-1 sm:grid-cols-4" style={{ ...getCardStyle(publicTheme), '--tw-ring-color': `${publicTheme.primary}22` }}>
        {items.map((item, index) => {
          const body = (
            <>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: item.star ? '#fef3c7' : `${publicTheme.primary}14`, color: item.star ? '#d97706' : publicTheme.primary }}>
                <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px]" style={item.filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>{item.icon}</span>
              </span>
              <span className="min-w-0">
                <strong className="block text-xl font-black leading-none tabular-nums" style={{ color: publicTheme.text, fontFamily: 'var(--seller-data)' }}>{item.value}</strong>
                <span className="mt-1 block truncate text-xs font-semibold" style={{ color: publicTheme.text, opacity: 0.7 }}>{item.label}</span>
              </span>
            </>
          );
          const divider = `${index % 2 === 1 ? 'border-l' : ''} ${index >= 2 ? 'border-t sm:border-t-0' : ''} ${index >= 1 ? 'sm:border-l' : ''}`;
          return (
            <li key={item.icon} className={divider} style={{ borderColor: `${publicTheme.primary}1f` }}>
              {item.href
                ? <a href={item.href} className="flex h-full items-center gap-3 p-3.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset sm:p-4 [@media(hover:hover)]:hover:bg-black/[0.03]">{body}</a>
                : <div className="flex h-full items-center gap-3 p-3.5 sm:p-4">{body}</div>}
            </li>
          );
        })}
      </ul>
      {chips.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.icon} title={chip.hint} className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold ring-1" style={{ backgroundColor: `${publicTheme.primary}14`, color: publicTheme.text, '--tw-ring-color': `${publicTheme.primary}2e` }}>
              <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[18px]" style={{ color: publicTheme.primary, ...(chip.filled ? { fontVariationSettings: "'FILL' 1" } : {}) }}>{chip.icon}</span>
              {chip.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
