import { useEffect } from 'react';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

// Piezas compartidas del panel de moderación. Paleta: azul Carpetazo (#1e40af / #12315f), amarillo (#facc15) como único acento
// y grises azulados para las líneas (#dbe3f0). Lo que pide atención (gravedad, vencimientos) se marca con punto + texto, nunca solo con color.

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

// La gravedad se ve con un punto de color y con texto
export const SEVERITY_STYLE = {
  S1: { label: 'Crítica', dot: 'bg-red-600', text: 'text-red-700' },
  S2: { label: 'Alta', dot: 'bg-orange-500', text: 'text-orange-700' },
  S3: { label: 'Media', dot: 'bg-amber-400', text: 'text-amber-800' },
  S4: { label: 'Baja', dot: 'bg-slate-300', text: 'text-slate-600' }
};

// Fila de una lista (reporte, caso, medida, apelación, entrada de auditoría). El borde es de 1px: la fila no lleva franjas de color.
export const ROW = 'rounded-xl border border-[#dbe3f0] bg-white transition-[border-color,box-shadow,background-color] duration-150 ease-out';
export const ROW_HOVER = '[@media(hover:hover)]:hover:border-[#b9c7e0] [@media(hover:hover)]:hover:shadow-[0_2px_10px_-4px_rgba(18,49,95,0.25)]';
export const ROW_ACTIVE = 'border-[#1e40af] bg-[#f3f7ff] shadow-[0_0_0_1px_#1e40af]';

export const Dot = ({ tone = 'bg-slate-300', className = '' }) => <span aria-hidden="true" className={`mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full ${tone} ${className}`} />;

export const Badge = ({ className = 'bg-slate-200 text-slate-700', children }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${className}`}>{children}</span>
);

export const Spinner = ({ label = 'Cargando' }) => (
  <div className="flex justify-center py-10" role="status" aria-label={label}><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#1e40af]/25 border-t-[#1e40af]" /></div>
);

// Marcador de lugar mientras llega la lista: ocupa el mismo espacio que las filas reales y evita que la página salte
export const ListSkeleton = ({ rows = 5, label = 'Cargando' }) => (
  <ul role="status" aria-label={label} className="space-y-2">
    {Array.from({ length: rows }, (_, index) => (
      <li key={index} className={`${ROW} flex items-start gap-3 p-4`} style={{ opacity: 1 - index * 0.14 }}>
        <span className="mod-skeleton mt-1 h-2.5 w-2.5 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <span className="mod-skeleton block h-3.5 w-3/5 rounded" />
          <span className="mod-skeleton block h-3 w-4/5 rounded" />
          <span className="mod-skeleton block h-3 w-2/5 rounded" />
        </div>
        <span className="mod-skeleton h-3 w-14 rounded" />
      </li>
    ))}
  </ul>
);

export const ErrorBox = ({ children }) => (children ? (
  <p role="alert" className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
    <span translate="no" aria-hidden="true" className="material-symbols-outlined mt-px text-[20px]">error</span>
    <span>{children}</span>
  </p>
) : null);

export const EmptyState = ({ icon = 'task_alt', title, children }) => (
  <div className="rounded-2xl border border-dashed border-[#c5d2ea] bg-white/70 px-6 py-12 text-center">
    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8effc] text-[#1e40af]">
      <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[30px]">{icon}</span>
    </span>
    <h2 className="mt-4 text-lg font-extrabold text-[#12315f]">{title}</h2>
    {children && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-slate-600">{children}</p>}
  </div>
);

const hideScrollbar = 'scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]';

// Selector de estado: control segmentado en una sola fila (en el teléfono se desliza hacia los lados)
export const Pills = ({ options, value, onChange, label, counts }) => (
  <div role="tablist" aria-label={label} className={`mb-3 flex gap-1 overflow-x-auto rounded-xl bg-[#e6ecf7] p-1 ${hideScrollbar}`}>
    {options.map(([key, text]) => (
      <button key={key} role="tab" type="button" aria-selected={value === key} onClick={() => onChange(key)} className={`flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-sm font-bold transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${value === key ? 'bg-white text-[#12315f] shadow-[0_1px_3px_rgba(18,49,95,0.18)]' : 'text-slate-600 [@media(hover:hover)]:hover:text-[#12315f]'}`}>
        {text}
        {counts?.[key] !== undefined && <span className={`text-xs tabular-nums ${value === key ? 'text-[#1e40af]' : 'text-slate-500'}`}>{counts[key]}</span>}
      </button>
    ))}
  </div>
);

// Panel de detalle: pantalla completa en el teléfono (con su botón "Volver"); panel fijo a la derecha en pantallas grandes
export function DetailPane({ label, children }) {
  // En el teléfono el fondo no se desplaza mientras el detalle está abierto
  useBodyScrollLock(window.matchMedia('(max-width: 1279px)').matches);
  return (
    <section aria-label={label} className="mod-detail-in fixed inset-0 z-[70] flex flex-col overflow-hidden bg-white pt-[env(safe-area-inset-top)] xl:pt-0 xl:sticky xl:inset-auto xl:top-4 xl:z-0 xl:max-h-[calc(100vh-2rem)] xl:rounded-2xl xl:border xl:border-[#dbe3f0] xl:shadow-[0_8px_30px_-12px_rgba(18,49,95,0.25)]">
      {children}
    </section>
  );
}

export const DetailHeader = ({ title, subtitle, onClose }) => (
  <div className="flex shrink-0 items-center gap-2 border-b border-[#dbe3f0] bg-white px-3 py-2.5 xl:px-4">
    <button type="button" onClick={onClose} aria-label="Volver a la lista" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#12315f] transition-[background-color,transform] duration-150 active:scale-[0.94] hover:bg-slate-100 xl:hidden">
      <span translate="no" aria-hidden="true" className="material-symbols-outlined">arrow_back</span>
    </button>
    <div className="min-w-0 flex-1">
      <h2 className="truncate text-base font-extrabold leading-tight text-[#12315f]">{title}</h2>
      {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
    </div>
    <button type="button" onClick={onClose} className="hidden rounded-full px-3 py-1.5 text-sm font-bold text-slate-600 transition-colors duration-150 hover:bg-slate-100 xl:block">Cerrar</button>
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
