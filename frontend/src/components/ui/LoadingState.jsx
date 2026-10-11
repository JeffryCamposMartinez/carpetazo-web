import { LoadingMark } from './LoadableImage';

// Estados de carga de Carpetazo: el logo con el aro azul y amarillo girando, en todas partes.
// Aparecen con un pequeño retraso (120 ms) para que una respuesta rápida no parpadee.
//   <LoadingState />                         sección: bloque centrado dentro de una página o tarjeta
//   <LoadingState variant="page" />          pantalla completa bajo el encabezado
//   <LoadingState variant="compact" />       fila corta (listas, paneles pequeños)
//   <LoadingState variant="overlay" />       cubre un contenedor `relative` mientras algo trabaja
//   <LoadingState tone="dark" />             sobre fondos oscuros (álbum, carpeta pública)
//   <ButtonSpinner />                        solo el aro, dentro de un botón que está guardando
const SIZES = { page: 'min-h-[55vh] py-16', section: 'py-12', compact: 'py-5', overlay: 'absolute inset-0 z-20 rounded-[inherit]' };

export default function LoadingState({ label = 'Cargando…', variant = 'section', tone = 'light', hint, className = '' }) {
  const dark = tone === 'dark';
  const compact = variant === 'compact';
  const overlay = variant === 'overlay';
  return (
    <div role="status" aria-live="polite" aria-label={label} className={`loading-in flex flex-col items-center justify-center text-center ${SIZES[variant] || SIZES.section} ${overlay ? (dark ? 'bg-[#0b1e3f]/70 backdrop-blur-[2px]' : 'bg-white/75 backdrop-blur-[2px]') : ''} ${className}`}>
      <LoadingMark className="relative" compact={compact} />
      {!compact && (
        <>
          <p className={`mt-1 text-sm font-bold ${dark ? 'text-white' : 'text-[#12315f]'}`}>{label}</p>
          {hint && <p className={`mt-1 max-w-xs text-xs font-medium ${dark ? 'text-blue-100/80' : 'text-slate-500'}`}>{hint}</p>}
        </>
      )}
      {compact && <span className="sr-only">{label}</span>}
    </div>
  );
}

// El aro del logo, solo, para botones y campos que están guardando o comprobando
export function ButtonSpinner({ className = '', tone = 'light' }) {
  return <span aria-hidden="true" className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 motion-reduce:animate-none ${tone === 'dark' ? 'border-[#12315f]/25 border-t-[#12315f]' : tone === 'current' ? 'border-current border-t-transparent' : 'border-white/35 border-t-white'} ${className}`} />;
}
