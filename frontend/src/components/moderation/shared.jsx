import { useEffect } from 'react';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

export const dateTime = (iso) => (iso ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '');
export const dateOnly = (iso) => (iso ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) : '');

// "hace 5 min", "hace 3 h", "hace 2 días": en una cola importa cuánto lleva esperando, no la fecha exacta
export const relativeTime = (iso) => {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
};

// La gravedad se muestra con una franja de color en el borde de cada fila y también con texto (el color solo no basta)
export const SEVERITY_STYLE = {
  S1: { label: 'Crítica', bar: 'bg-red-600', text: 'text-red-700' },
  S2: { label: 'Alta', bar: 'bg-orange-500', text: 'text-orange-700' },
  S3: { label: 'Media', bar: 'bg-amber-400', text: 'text-amber-800' },
  S4: { label: 'Baja', bar: 'bg-slate-300', text: 'text-slate-600' }
};

export const Badge = ({ className = 'bg-slate-200 text-slate-700', children }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${className}`}>{children}</span>
);

export const Spinner = ({ label = 'Cargando' }) => (
  <div className="flex justify-center py-10" role="status" aria-label={label}><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e40af] border-t-transparent" /></div>
);

export const ErrorBox = ({ children }) => (children ? <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 ring-1 ring-red-200">{children}</p> : null);

export const EmptyState = ({ icon = 'task_alt', title, children }) => (
  <div className="rounded-2xl bg-white px-6 py-10 text-center ring-1 ring-slate-900/5">
    <span translate="no" aria-hidden="true" className="material-symbols-outlined text-5xl text-[#1e40af]/35">{icon}</span>
    <h2 className="mt-2 text-lg font-extrabold text-[#12315f]">{title}</h2>
    {children && <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-slate-600">{children}</p>}
  </div>
);

const hideScrollbar = 'scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]';

// Selector de estado en una sola fila con desplazamiento lateral: nunca ocupa más de una línea en el teléfono
export const Pills = ({ options, value, onChange, label, counts }) => (
  <div role="tablist" aria-label={label} className={`-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 ${hideScrollbar}`}>
    {options.map(([key, text]) => (
      <button key={key} role="tab" type="button" aria-selected={value === key} onClick={() => onChange(key)} className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors ${value === key ? 'bg-[#12315f] text-white' : 'bg-white text-[#12315f] ring-1 ring-slate-300 hover:bg-white/80'}`}>
        {text}
        {counts?.[key] !== undefined && <span className={`text-xs tabular-nums ${value === key ? 'text-[#facc15]' : 'text-slate-500'}`}>{counts[key]}</span>}
      </button>
    ))}
  </div>
);

// Panel de detalle: pantalla completa en el teléfono (con su botón "Volver"); panel fijo a la derecha en pantallas grandes
export function DetailPane({ label, children }) {
  // En el teléfono el fondo no se desplaza mientras el detalle está abierto
  useBodyScrollLock(window.matchMedia('(max-width: 1279px)').matches);
  return (
    <section aria-label={label} className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-white pt-[env(safe-area-inset-top)] xl:pt-0 xl:sticky xl:inset-auto xl:top-4 xl:z-0 xl:max-h-[calc(100vh-2rem)] xl:rounded-2xl xl:shadow-sm xl:ring-1 xl:ring-slate-900/10">
      {children}
    </section>
  );
}

export const DetailHeader = ({ title, subtitle, onClose }) => (
  <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5 xl:px-4">
    <button type="button" onClick={onClose} aria-label="Volver a la lista" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#12315f] hover:bg-slate-100 xl:hidden">
      <span translate="no" aria-hidden="true" className="material-symbols-outlined">arrow_back</span>
    </button>
    <div className="min-w-0 flex-1">
      <h2 className="truncate text-base font-extrabold leading-tight text-[#12315f]">{title}</h2>
      {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
    </div>
    <button type="button" onClick={onClose} className="hidden rounded-full px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100 xl:block">Cerrar</button>
  </div>
);

// Hoja inferior para los filtros en el teléfono
export function FilterSheet({ open, onClose, title = 'Filtros', children }) {
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop fixed inset-0 z-[80] flex items-end bg-slate-900/50 lg:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="folder-sheet max-h-[90dvh] w-full space-y-4 overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[#12315f]">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-sm font-bold text-[#1e40af] hover:bg-blue-50">Listo</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const SANCTION_TYPES = [
  ['warning', 'Advertencia'],
  ['restrict_messages', 'Restringir mensajes'],
  ['suspend_selling', 'Suspender ventas'],
  ['suspend', 'Suspender cuenta'],
  ['ban', 'Cerrar cuenta (2 administradores)']
];

export const QUICK_REASONS = {
  warning: 'Incumpliste las normas de contenido de Carpetazo. Esta es una advertencia; si se repite, aplicaremos medidas mayores.',
  restrict_messages: 'Restringimos tus mensajes por acoso o spam reportado por otras personas.',
  suspend_selling: 'Suspendimos tus ventas mientras revisamos reportes de compradores.',
  suspend: 'Suspendimos tu cuenta por incumplir reiteradamente las normas de Carpetazo.',
  ban: 'Cerramos tu cuenta por una infracción grave a las normas de Carpetazo.'
};
