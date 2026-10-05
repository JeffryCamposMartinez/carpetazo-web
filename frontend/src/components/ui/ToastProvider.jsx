import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Avisos de toda la página: un solo lugar (abajo y al centro), misma forma y mismo comportamiento en todas las pantallas.
// Uso: const { showToast } = useToast();  showToast('Carpeta creada', 'success');
//      showToast('Carpeta publicada', { type: 'success', action: { label: 'Deshacer', run: () => {} } });

const ToastContext = createContext({ showToast: () => {}, dismissToast: () => {} });
export const useToast = () => useContext(ToastContext);

const TONES = {
  success: { icon: 'check', chip: 'bg-[#12315f] text-[#facc15]', bar: 'bg-[#facc15]' },
  error: { icon: 'priority_high', chip: 'bg-red-600 text-white', bar: 'bg-red-500' },
  info: { icon: 'info', chip: 'bg-[#1e40af] text-white', bar: 'bg-[#1e40af]' }
};
const MAX_VISIBLE = 3;
const LEAVE_MS = 170;

// El segundo argumento puede ser el tipo ('success' | 'error' | 'info'), una acción { label, run } o { type, action, duration }
const normalize = (arg) => {
  if (typeof arg === 'string') return { type: arg };
  if (arg && typeof arg === 'object') return typeof arg.run === 'function' ? { action: arg } : arg;
  return {};
};

function ToastCard({ toast, onClose }) {
  const tone = TONES[toast.type] || TONES.info;
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration);
  const startedAt = useRef(0);

  // Con el puntero encima (o el foco dentro) el aviso espera: se lee con calma y no desaparece al ir a tocar «Deshacer»
  useEffect(() => {
    if (paused || toast.leaving) return undefined;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onClose(toast.id), Math.max(400, remaining.current));
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, toast.leaving, toast.id, onClose]);

  const runAction = () => {
    onClose(toast.id);
    toast.action.run();
  };

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      data-leaving={toast.leaving ? 'true' : 'false'}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="toast-card pointer-events-auto relative w-full max-w-[26rem] overflow-hidden rounded-2xl bg-white shadow-[0_2px_4px_rgba(8,18,42,0.2),0_20px_44px_-14px_rgba(8,18,42,0.6)] ring-1 ring-[#12315f]/15"
    >
      <div className="flex items-start gap-3 py-3 pl-3.5 pr-2">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.chip}`}>
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px] font-bold">{tone.icon}</span>
        </span>
        <p className="min-w-0 flex-1 py-1.5 text-[15px] font-semibold leading-snug text-[#1a2b4b] [overflow-wrap:anywhere]">{toast.message}</p>
        {toast.action && (
          <button
            type="button"
            onClick={runAction}
            className="h-9 shrink-0 self-center rounded-full bg-[#facc15] px-4 text-sm font-extrabold text-[#12315f] transition-[filter,transform] duration-150 hover:brightness-95 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
          >
            {toast.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={() => onClose(toast.id)}
          aria-label="Cerrar aviso"
          className="relative flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full text-slate-400 transition-[background-color,color,transform] duration-150 hover:bg-slate-100 hover:text-slate-600 active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] after:absolute after:-inset-1 after:content-['']"
        >
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      {/* Tiempo que le queda al aviso */}
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-[#12315f]/10">
        <span className={`toast-timer block h-full ${tone.bar}`} style={{ animationDuration: `${toast.duration}ms`, animationPlayState: paused ? 'paused' : 'running' }} />
      </span>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismissToast = useCallback((id) => {
    setToasts((list) => list.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
    window.setTimeout(() => setToasts((list) => list.filter((item) => item.id !== id)), LEAVE_MS);
  }, []);

  const showToast = useCallback((message, options) => {
    const { type = 'info', action = null, duration } = normalize(options);
    const text = String(message ?? '').trim();
    if (!text) return;
    const safeType = TONES[type] ? type : 'info';
    const time = duration ?? (action ? 7000 : safeType === 'error' ? 6000 : 4000);
    setToasts((list) => {
      const live = list.filter((item) => !item.leaving);
      const same = live.find((item) => item.message === text && item.type === safeType && !item.action && !action);
      // El mismo aviso repetido (p. ej. agregar varias cartas seguidas) renueva el que ya está, sin apilar copias
      if (same) return list.map((item) => (item.id === same.id ? { ...item, stamp: item.stamp + 1 } : item));
      const next = [...list, { id: nextId.current++, stamp: 0, message: text, type: safeType, action, duration: time, leaving: false }];
      const shown = next.filter((item) => !item.leaving);
      const drop = new Set(shown.slice(0, Math.max(0, shown.length - MAX_VISIBLE)).map((item) => item.id));
      return next.filter((item) => !drop.has(item.id));
    });
  }, []);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div
          role="region"
          aria-label="Avisos"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[10000] flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6"
        >
          {toasts.map((item) => <ToastCard key={`${item.id}-${item.stamp}`} toast={item} onClose={dismissToast} />)}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}
