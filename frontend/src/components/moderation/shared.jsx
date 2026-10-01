export const dateTime = (iso) => (iso ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '');
export const dateOnly = (iso) => (iso ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) : '');

export const Badge = ({ className = 'bg-slate-200 text-slate-700', children }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold ${className}`}>{children}</span>
);

export const Spinner = ({ label = 'Cargando' }) => (
  <div className="flex justify-center py-10" role="status" aria-label={label}><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1e40af] border-t-transparent" /></div>
);

export const ErrorBox = ({ children }) => (children ? <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 ring-1 ring-red-200">{children}</p> : null);

export const Pills = ({ options, value, onChange, label }) => (
  <div role="tablist" aria-label={label} className="mb-3 flex flex-wrap gap-2">
    {options.map(([key, text]) => (
      <button key={key} role="tab" type="button" aria-selected={value === key} onClick={() => onChange(key)} className={`h-10 rounded-full px-4 text-sm font-extrabold ${value === key ? 'bg-[#12315f] text-white' : 'bg-white text-[#12315f] ring-1 ring-slate-300'}`}>{text}</button>
    ))}
  </div>
);

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
