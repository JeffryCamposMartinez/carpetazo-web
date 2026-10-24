import { useState } from 'react';
import { getCardStyle } from './profileStyles';
import SvgIcon from '../ui/SvgIcon';
import { readableOn } from '../../utils/color';

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
const lastSaleLabel = (date) => {
  const parsed = date ? new Date(date) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '') : '';
};
const clpLabel = (amount) => `$${Number(amount || 0).toLocaleString('es-CL')}`;

// Franja de confianza bajo la presentación: reseñas, carpetas, cartas y nivel, con datos reales del vendedor
export default function ProfileTrustStrip({ completedSales = 0, folders, lastSaleAt, memberSince, profileLevel, publicTheme, recentSales = [], responseTime, reviewSummary, totalCards }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const chipText = readableOn(publicTheme.card);
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
    responseTime && { icon: 'schedule', label: `Suele responder en ${formatResponseTime(responseTime.medianMinutes)}`, hint: 'Tiempo típico en contestar los mensajes de los últimos 90 días.' },
    completedSales > 0 && { icon: 'task_alt', label: `${completedSales.toLocaleString('es-CL')} ${completedSales === 1 ? 'venta confirmada' : 'ventas confirmadas'}`, hint: 'Pedidos que el vendedor confirmó como concretados en Carpetazo.' },
    lastSaleLabel(lastSaleAt) && { icon: 'event_available', label: `Última venta realizada el ${lastSaleLabel(lastSaleAt)}`, hint: 'Fecha de la venta confirmada más reciente del vendedor.' },
    memberSinceLabel(memberSince) && { icon: 'calendar_month', label: `En Carpetazo desde ${memberSinceLabel(memberSince)}` }
  ].filter(Boolean);

  return (
    <section aria-label="Confianza del vendedor" className={`relative ${historyOpen ? 'z-20' : 'z-10'} mx-auto w-full max-w-[1220px] px-4 pt-5 sm:px-6 md:px-8`}>
      <ul className="grid grid-cols-2 overflow-hidden ring-1 sm:grid-cols-4" style={{ ...getCardStyle(publicTheme), '--tw-ring-color': `${publicTheme.primary}22` }}>
        {items.map((item, index) => {
          const body = (
            <>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: item.star ? '#fef3c7' : `${publicTheme.primary}14`, color: item.star ? '#d97706' : publicTheme.primary }}>
                <SvgIcon name={item.icon} translate="no" aria-hidden="true" className="text-[22px]" style={item.filled ? { fontVariationSettings: "'FILL' 1" } : undefined} />
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
        <ul className="relative z-10 mt-3 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.icon} className="relative">
              {chip.icon === 'event_available' ? (
                <details className="group relative" onToggle={(event) => setHistoryOpen(event.currentTarget.open)}>
                  <summary title={chip.hint} className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-full px-3 py-1 text-left text-[13px] font-bold ring-1 [&::-webkit-details-marker]:hidden" style={{ backgroundColor: publicTheme.card, color: chipText, '--tw-ring-color': `${publicTheme.primary}55` }}>
                    <SvgIcon name={chip.icon} translate="no" aria-hidden="true" className="text-[18px]" style={{ color: publicTheme.primary }} />
                    <span>{chip.label}</span>
                    <SvgIcon name="expand_more" translate="no" aria-hidden="true" className="text-[17px] transition-transform group-open:rotate-180" style={{ color: publicTheme.primary }} />
                  </summary>
                  <div className="absolute left-0 top-full z-[200] mt-2 w-[min(22rem,calc(100vw-2rem))] p-3 shadow-xl ring-1" style={{ ...getCardStyle(publicTheme), backgroundColor: publicTheme.card, background: publicTheme.card, backdropFilter: 'none', WebkitBackdropFilter: 'none', opacity: 1, color: chipText, '--tw-ring-color': `${publicTheme.primary}88` }}>
                    <p className="mb-2 text-xs font-extrabold uppercase tracking-wide" style={{ color: chipText }}>Últimas ventas confirmadas</p>
                    <ul className="profile-sales-scrollbar max-h-80 space-y-3 overflow-y-auto" style={{ '--sales-scrollbar-thumb': publicTheme.primary, '--sales-scrollbar-thumb-hover': publicTheme.accent || publicTheme.secondary, '--sales-scrollbar-track': `${publicTheme.primary}1c` }}>
                      {(recentSales.length ? recentSales : [{ completedAt: lastSaleAt, items: [] }]).map((sale, index) => (
                        <li key={`${sale.completedAt}-${index}`} className="border-t pt-2 first:border-t-0 first:pt-0" style={{ borderColor: `${publicTheme.primary}35` }}>
                          <time className="mb-2 block text-xs font-bold" style={{ color: chipText, opacity: 0.82 }} dateTime={sale.completedAt}>{lastSaleLabel(sale.completedAt)}</time>
                          <ul className="space-y-2">
                            {(sale.items || []).map((item, itemIndex) => (
                              <li key={`${item.name}-${itemIndex}`} className="flex min-w-0 items-center gap-2" style={{ color: chipText }}>
                                {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" className="h-12 w-9 shrink-0 rounded object-cover ring-1" style={{ '--tw-ring-color': `${publicTheme.primary}55` }} /> : <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded" style={{ backgroundColor: `${publicTheme.primary}18`, color: publicTheme.primary }}><SvgIcon name="style" translate="no" aria-hidden="true" className="text-lg" /></span>}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-extrabold" title={item.name}>{item.name}</span>
                                  <span className="block text-xs font-semibold" style={{ color: chipText, opacity: 0.82 }}>{item.quantity > 1 ? `${item.quantity} × ` : ''}{clpLabel(item.unitPrice)}{item.quantity > 1 ? ' c/u' : ''}</span>
                                </span>
                                <SvgIcon name="task_alt" translate="no" aria-hidden="true" className="shrink-0 text-base" style={{ color: publicTheme.accent || publicTheme.primary }} />
                              </li>
                            ))}
                            {(!sale.items || sale.items.length === 0) && <li className="text-xs font-semibold" style={{ color: chipText, opacity: 0.82 }}>Venta confirmada</li>}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              ) : (
                <div title={chip.hint} className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold ring-1" style={{ backgroundColor: publicTheme.card, color: chipText, '--tw-ring-color': `${publicTheme.primary}55` }}>
                  <SvgIcon name={chip.icon} translate="no" aria-hidden="true" className="text-[18px]" style={{ color: publicTheme.primary, ...(chip.filled ? { fontVariationSettings: "'FILL' 1" } : {}) }} />
                  {chip.label}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
