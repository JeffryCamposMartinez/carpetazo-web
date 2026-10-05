// Piezas comunes del editor de perfil («Profile Studio»): introducción de cada pestaña, secciones, opciones con muestra e interruptores.

export const STUDIO = {
  ink: '#172940',
  muted: '#5d6d82',
  blue: '#2454c6',
  line: '#e2e8f0',
  ground: '#f6f8fb',
  heading: "'Manrope', 'DM Sans', system-ui, sans-serif",
};

export const Symbol = ({ name, className = 'text-[20px]', filled = false }) => (
  <span translate="no" aria-hidden="true" className={`material-symbols-outlined leading-none ${className}`} style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}>{name}</span>
);

// Carta pequeña inclinada junto al título de cada pestaña: cambia de «estampado» según lo que se edita
const INTRO_ART = {
  theme: 'linear-gradient(160deg, #254b8210 0 35%, #f8d46755 35% 65%, #94b6e744 65%)',
  font: 'repeating-linear-gradient(0deg, transparent 0 8px, #557dab44 8px 9px)',
  cards: 'linear-gradient(120deg, #dcf1f6, #fbf3cb, #e2d9f7)',
  scene: 'radial-gradient(circle at 65% 30%, #aac4ed 0 3px, transparent 4px), linear-gradient(140deg, #172f51, #365f8c)',
  layout: 'linear-gradient(90deg, #3764c540 46%, transparent 46% 54%, #298a7940 54%)',
  social: 'linear-gradient(35deg, #e8f2fa, #f4e7f6)',
};

export function StudioIntro({ tab, title, text }) {
  return (
    <div className="relative mb-6 pr-12">
      <h3 className="text-[24px] font-bold leading-tight tracking-[-0.03em]" style={{ fontFamily: STUDIO.heading, color: STUDIO.ink }}>{title}</h3>
      <p className="mt-2 max-w-[390px] text-[13px] leading-relaxed" style={{ color: STUDIO.muted }}>{text}</p>
      <span
        aria-hidden="true"
        className={`absolute right-1 top-1 h-[34px] w-[27px] rounded-[3px] border border-[#557dab60] ${tab === 'font' ? '' : tab === 'social' ? '-rotate-[10deg]' : 'rotate-[12deg]'}`}
        style={{ background: INTRO_ART[tab], boxShadow: `-7px 6px 0 -1px ${STUDIO.ground}, -7px 6px 0 0 #9eb4d466` }}
      />
    </div>
  );
}

export function StudioSection({ title, hint, aside, children }) {
  return (
    <section className="mt-8 border-t pt-6 first:mt-0 first:border-t-0 first:pt-0" style={{ borderColor: STUDIO.line }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold leading-snug" style={{ fontFamily: STUDIO.heading, color: STUDIO.ink }}>{title}</h3>
          {hint && <p className="mt-1 text-xs leading-snug" style={{ color: STUDIO.muted }}>{hint}</p>}
        </div>
        {aside && <span className="shrink-0 pt-0.5 text-[11px] font-semibold" style={{ color: STUDIO.muted }}>{aside}</span>}
      </div>
      {children}
    </section>
  );
}

const CARD = 'group min-w-0 rounded-[14px] border bg-white p-2 text-left shadow-[0_2px_3px_rgba(21,43,69,0.02),0_6px_15px_rgba(21,43,69,0.03)] transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] focus:outline-none [@media(hover:hover)]:active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-[#2b63d8] focus-visible:ring-offset-2 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-[0_6px_18px_rgba(21,43,69,0.07)] motion-reduce:transition-none motion-reduce:[@media(hover:hover)]:hover:translate-y-0';
export const cardState = (selected) => `${CARD} ${selected ? 'border-[#2454c6] shadow-[0_0_0_1px_#2454c6,0_5px_14px_rgba(36,84,198,0.1)]' : 'border-[#e2e8f0] [@media(hover:hover)]:hover:border-[#a2b8d5]'}`;

// Opción con muestra: la vista previa ocupa la caja y debajo van el nombre (con marca si está elegida) y para qué sirve
export function StudioOption({ selected, onClick, name, description, sampleClassName = '', sampleStyle, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={cardState(selected)}>
      <span className={`relative block h-[120px] overflow-hidden rounded-[9px] bg-[#edf2f9] sm:h-[132px] ${sampleClassName}`} style={sampleStyle}>
        {children}
      </span>
      <span className="mx-1 mt-3 flex items-center justify-between gap-1.5 text-[13px] font-bold leading-snug" style={{ color: STUDIO.ink }}>
        <span className="min-w-0 [overflow-wrap:anywhere]">{name}</span>
        {selected && <Symbol name="check_circle" className="shrink-0 text-[18px] text-[#2454c6]" filled />}
      </span>
      {description && <span className="mx-1 mb-1 mt-1 block text-xs leading-snug" style={{ color: STUDIO.muted }}>{description}</span>}
    </button>
  );
}

export const OptionGrid = ({ children }) => <div className="grid grid-cols-2 gap-3 sm:gap-3.5">{children}</div>;

// Interruptor con icono y estado escrito (no depende solo del color); zona táctil de 44 px
export function StudioSwitchRow({ enabled, onClick, label, status, icon, iconClassName = 'bg-[#edf3ff] text-[#2454c6]' }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-white p-3.5 shadow-[0_3px_8px_rgba(21,43,69,0.02)] sm:p-4" style={{ borderColor: STUDIO.line }}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${iconClassName}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <strong className="block text-[13px] font-semibold leading-snug" style={{ color: STUDIO.ink }}>{label}</strong>
        <small className="mt-0.5 block text-xs leading-snug" style={{ color: STUDIO.muted }}>{status}</small>
      </span>
      <button type="button" role="switch" aria-checked={enabled} aria-label={label} onClick={onClick} className="relative h-11 w-11 shrink-0 rounded-full focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2b63d8]">
        <span className={`absolute left-[3px] top-[10px] h-6 w-[38px] rounded-full transition-colors duration-200 ${enabled ? 'bg-[#2454c6]' : 'bg-[#d8e0eb] shadow-[inset_0_0_0_1px_rgba(157,174,195,0.2)]'}`} />
        <span className={`absolute left-[7px] top-[14px] h-4 w-4 rounded-full bg-white shadow-[0_1px_4px_rgba(11,28,50,0.2)] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${enabled ? 'translate-x-[14px]' : ''}`} />
      </button>
    </div>
  );
}
