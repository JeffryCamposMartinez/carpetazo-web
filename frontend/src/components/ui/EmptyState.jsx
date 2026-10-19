import { Link } from 'react-router-dom';
import SvgIcon from './SvgIcon';

// Estados vacíos de Carpetazo: qué pasa, por qué, y qué hacer ahora. Un solo diseño para toda la web.
//   <EmptyState icon="style" title="..." action={{ label: 'Ver cartas', to: '/cartas' }}>explicación</EmptyState>
//   variant="card"     tarjeta blanca (por defecto)        variant="plain"   sin fondo, dentro de otra tarjeta
//   variant="compact"  una fila corta (listas, cajones)    tone="dark"       sobre fondos oscuros
// `action` y `secondary` aceptan { label, to } (enlace) o { label, onClick } (botón).
const TONES = {
  light: { box: 'bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(26,43,75,0.06),0_12px_28px_-20px_rgba(26,43,75,0.4)]', icon: 'bg-blue-50 text-[#1e40af] ring-1 ring-blue-100', title: 'text-[#12315f]', text: 'text-[#3a4f7a]' },
  dark: { box: 'bg-white/10 ring-1 ring-white/15', icon: 'bg-white/15 text-[#facc15] ring-1 ring-white/20', title: 'text-white', text: 'text-blue-100/85' }
};

const PRIMARY = 'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#facc15] px-6 text-sm font-extrabold text-[#12315f] shadow-[inset_0_-1px_0_rgba(0,0,0,0.12)] transition-[background-color,transform,box-shadow] duration-150 ease-out active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2 [@media(hover:hover)]:hover:bg-[#eab308] [@media(hover:hover)]:hover:shadow-[0_6px_16px_-8px_rgba(18,49,95,0.55)]';
const SECONDARY = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold text-[#1e40af] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] [@media(hover:hover)]:hover:bg-blue-50 [@media(hover:hover)]:hover:text-[#12315f]';
const PRIMARY_DARK = PRIMARY;
const SECONDARY_DARK = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold text-white transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white [@media(hover:hover)]:hover:bg-white/10';

function Action({ item, className }) {
  if (!item) return null;
  const content = <>{item.icon && <SvgIcon name={item.icon} translate="no" aria-hidden="true" className="text-[20px]" />}{item.label}</>;
  return item.to
    ? <Link to={item.to} className={className}>{content}</Link>
    : <button type="button" onClick={item.onClick} disabled={item.disabled} className={`${className} disabled:pointer-events-none disabled:opacity-50`}>{content}</button>;
}

export default function EmptyState({ icon = 'search_off', title, children, action, secondary, variant = 'card', tone = 'light', as: Tag = 'div', role, className = '' }) {
  const t = TONES[tone] || TONES.light;
  if (variant === 'compact') {
    return (
      <Tag role={role} className={`empty-in flex items-center gap-3 rounded-xl p-3 ${className}`}>
        <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${t.icon}`}><SvgIcon name={icon} translate="no" className="text-[22px]" /></span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-extrabold leading-snug ${t.title}`}>{title}</p>
          {children && <p className={`mt-0.5 text-xs leading-relaxed ${t.text}`}>{children}</p>}
        </div>
        <Action item={action} className={`${tone === 'dark' ? SECONDARY_DARK : SECONDARY} shrink-0`} />
      </Tag>
    );
  }
  return (
    <Tag role={role} className={`empty-in mx-auto flex w-full flex-col items-center px-6 py-10 text-center sm:py-12 ${variant === 'card' ? `rounded-2xl ${t.box}` : ''} ${className}`}>
      <span aria-hidden="true" className={`flex h-16 w-16 items-center justify-center rounded-full ${t.icon}`}><SvgIcon name={icon} translate="no" className="text-[32px]" /></span>
      <h2 className={`mt-4 text-lg font-extrabold leading-snug [text-wrap:balance] ${t.title}`}>{title}</h2>
      {children && <p className={`mt-1.5 max-w-sm text-sm leading-relaxed ${t.text}`}>{children}</p>}
      {(action || secondary) && (
        <div className="mt-5 flex w-full flex-col items-center gap-1.5 sm:w-auto sm:flex-row sm:gap-3">
          <Action item={action} className={`${tone === 'dark' ? PRIMARY_DARK : PRIMARY} w-full sm:w-auto`} />
          <Action item={secondary} className={`${tone === 'dark' ? SECONDARY_DARK : SECONDARY} w-full sm:w-auto`} />
        </div>
      )}
    </Tag>
  );
}
