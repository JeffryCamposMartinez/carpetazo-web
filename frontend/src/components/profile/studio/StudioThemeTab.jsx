import { defaultPublicTheme, profileThemes } from '../profileStyles';
import { STUDIO, StudioIntro, StudioSection, Symbol, cardState } from './StudioParts';

const COLOR_FIELDS = [['primary', 'Principal'], ['secondary', 'Secundario'], ['accent', 'Acento'], ['surface', 'Fondo'], ['card', 'Tarjeta'], ['text', 'Texto']];

// Escena de cada paleta: el perfil en miniatura flotando sobre sus colores
function PaletteScene({ palette, selected, avatarUrl, initial }) {
  return (
    <span
      className="relative isolate grid h-[113px] place-items-center overflow-hidden rounded-[9px] sm:h-[128px]"
      style={{ background: `radial-gradient(ellipse at 90% 0, ${palette.secondary}, transparent 75%), ${palette.primary}` }}
    >
      <span aria-hidden="true" className="absolute -right-9 -top-[88px] -z-10 h-40 w-40 rounded-full border border-white/10 shadow-[0_0_0_21px_rgba(255,255,255,0.03)]" />
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(130deg,rgba(255,255,255,0.1),transparent_50%,rgba(0,0,0,0.07))]" />
      <span
        aria-hidden="true"
        className="grid w-4/5 grid-cols-[25px_1fr] items-center gap-x-2 gap-y-1 rounded-[9px] border border-white/40 p-2.5 shadow-[0_8px_18px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.3)] [transform:perspective(400px)_rotateX(4deg)_rotateY(-5deg)]"
        style={{ backgroundColor: palette.card }}
      >
        <span className="grid h-[25px] w-[25px] place-items-center overflow-hidden rounded-[7px] border-2 text-[9px] font-bold text-white" style={{ backgroundColor: palette.primary, borderColor: palette.accent }}>
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initial}
        </span>
        <span className="min-w-0">
          <i className="block h-1 w-[85%] rounded-full" style={{ backgroundColor: palette.text }} />
          <i className="mt-1 block h-[3px] w-[55%] rounded-full opacity-25" style={{ backgroundColor: palette.text }} />
        </span>
        <span className="col-span-2 mt-1 grid grid-cols-3 gap-1">
          <i className="h-[23px] rounded-[3px] opacity-75" style={{ background: `linear-gradient(150deg, ${palette.secondary}, ${palette.primary})` }} />
          <i className="h-[23px] rounded-[3px]" style={{ backgroundColor: palette.accent }} />
          <i className="h-[23px] rounded-[3px] opacity-25" style={{ background: `linear-gradient(150deg, ${palette.secondary}, ${palette.primary})` }} />
        </span>
      </span>
      {selected && (
        <span className="absolute right-2 top-2 grid h-[22px] w-[22px] place-items-center rounded-full bg-white text-[#2454c6] shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
          <Symbol name="check" className="text-[15px] font-bold" />
        </span>
      )}
    </span>
  );
}

export default function StudioThemeTab({ applyThemePalette, avatarUrl, handleThemeFieldChange, initial, publicTheme }) {
  return (
    <>
      <StudioIntro tab="theme" title="Encuentra tus colores." text="Paletas combinadas para darle vida a tu perfil. Después puedes ajustar cada color a tu gusto." />
      <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
        {profileThemes.map((palette) => {
          const selected = publicTheme.id === palette.id;
          return (
            <button key={palette.id} type="button" aria-pressed={selected} onClick={() => applyThemePalette(palette)} className={cardState(selected)}>
              <PaletteScene palette={palette} selected={selected} avatarUrl={avatarUrl} initial={initial} />
              <strong className="mx-1 mt-3 block text-[13px] font-bold leading-snug" style={{ color: STUDIO.ink }}>{palette.name}</strong>
              <small className="mx-1 mb-1 mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px]" style={{ color: selected ? STUDIO.blue : STUDIO.muted }}>
                <span className="flex gap-[3px]" aria-hidden="true">
                  {[palette.primary, palette.secondary, palette.accent, palette.card].map((color, index) => <i key={index} className="h-[11px] w-[11px] rounded-full border border-[#152b4526]" style={{ backgroundColor: color }} />)}
                </span>
                <span className={selected ? 'font-bold' : ''}>{selected ? 'En uso' : 'Aplicar'}</span>
              </small>
            </button>
          );
        })}
      </div>

      <StudioSection title="Colores a tu medida" hint="Toca un color para cambiarlo. Lo ves al instante en tu perfil." aside={<Symbol name="colorize" className="text-[20px] text-[#7189a7]" />}>
        <div className="grid grid-cols-2 gap-2.5">
          {COLOR_FIELDS.map(([field, label]) => {
            const value = publicTheme[field] || defaultPublicTheme[field];
            return (
              <label key={field} className="relative flex cursor-pointer items-center gap-2.5 rounded-[11px] border bg-white p-2.5 transition-colors focus-within:ring-[3px] focus-within:ring-[#2b63d8] [@media(hover:hover)]:hover:border-[#a2b8d5]" style={{ borderColor: STUDIO.line }}>
                <span className="h-11 w-11 shrink-0 rounded-[9px] border border-[#17294012]" style={{ backgroundColor: value }} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold" style={{ color: STUDIO.ink }}>{label}</span>
                  <small className="mt-0.5 block text-[11px] uppercase tabular-nums tracking-wide" style={{ color: STUDIO.muted }}>{value}</small>
                </span>
                <input type="color" value={value === 'transparent' ? '#ffffff' : value} onChange={(event) => handleThemeFieldChange(field, event.target.value)} aria-label={`Color ${label.toLowerCase()}`} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              </label>
            );
          })}
        </div>
      </StudioSection>
    </>
  );
}
