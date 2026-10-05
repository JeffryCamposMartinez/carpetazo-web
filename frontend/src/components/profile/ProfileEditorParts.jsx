// Miniaturas del editor de apariencia del perfil: llenan el alto de la caja donde se muestran.
import { getAvatarFrameStyle, getCardStyle, getProfileBackgroundStyle, resolveSurfaceTheme } from './profileStyles';

// Perfil en miniatura: tarjeta con foto enmarcada, nombre y botón, con los estilos reales del tema
export const MiniProfile = ({ theme, avatarUrl, initial = 'V' }) => (
  <span className="absolute inset-x-3 bottom-2.5 top-5 flex items-center gap-2 overflow-hidden p-2" style={{ ...getCardStyle(theme), color: theme.text }}>
    <span className="h-9 w-9 shrink-0 rounded-[0.7rem] p-[2px] shadow" style={{ background: getAvatarFrameStyle(theme) }}>
      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-[0.55rem] bg-white text-[11px] font-black text-slate-500">
        {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initial}
      </span>
    </span>
    <span className="min-w-0 flex-1">
      <span className="block h-1.5 w-4/5 rounded-full" style={{ backgroundColor: theme.text }} />
      <span className="mt-1 block h-1 w-1/2 rounded-full opacity-40" style={{ backgroundColor: theme.text }} />
      <span className="mt-2 flex items-center gap-1">
        <span className="h-2.5 w-9 rounded-full" style={{ backgroundColor: theme.accent }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.primary }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.secondary }} />
      </span>
    </span>
  </span>
);

// Escena en miniatura: el fondo elegido con un perfil encima
export const MiniScene = ({ theme, avatarUrl, initial, background }) => (
  <span className="relative block h-full overflow-hidden rounded-[inherit]" style={background || getProfileBackgroundStyle(theme)}>
    <MiniProfile theme={resolveSurfaceTheme(theme)} avatarUrl={avatarUrl} initial={initial} />
  </span>
);

// Esquemas de la presentación: muestran la forma real que toma la parte de arriba del perfil en el teléfono
const wire = 'rounded-[3px]';

export const LayoutWire = ({ id }) => {
  const banner = 'bg-[#12315f]';
  const card = 'bg-white ring-1 ring-slate-200';
  const line = 'bg-slate-300';
  const name = 'bg-[#12315f]';
  const photo = 'bg-[#facc15] ring-2 ring-white';
  return (
    <span className="relative block h-full overflow-hidden rounded-[inherit] bg-slate-100" aria-hidden="true">
      {id === 'classic' && (
        <>
          <span className={`absolute inset-x-0 top-0 h-12 ${banner}`} />
          <span className={`absolute left-2.5 top-6 h-8 w-8 rounded-lg ${photo}`} />
          <span className={`absolute inset-x-2 bottom-2 top-[62px] rounded-md p-1.5 ${card}`}>
            <span className={`block h-1.5 w-2/3 ${wire} ${name}`} /><span className={`mt-1 block h-1 w-1/3 ${wire} ${line}`} />
          </span>
        </>
      )}
      {id === 'compact' && (
        <>
          <span className={`absolute inset-x-0 top-0 h-6 ${banner}`} />
          <span className={`absolute left-2.5 top-3 h-6 w-6 rounded-md ${photo}`} />
          <span className={`absolute inset-x-2 top-[38px] rounded-md p-1.5 ${card}`}>
            <span className={`block h-1.5 w-1/2 ${wire} ${name}`} /><span className={`mt-1 block h-1 w-1/4 ${wire} ${line}`} />
          </span>
          <span className="absolute inset-x-2 bottom-2 grid grid-cols-4 gap-1"><span className={`h-5 ${wire} bg-emerald-500`} /><span className={`h-5 ${wire} bg-emerald-500`} /><span className={`h-5 ${wire} bg-emerald-500`} /><span className={`h-5 ${wire} bg-emerald-500`} /></span>
        </>
      )}
      {id === 'showcase' && (
        <>
          <span className={`absolute inset-x-0 top-0 h-11 ${banner}`} />
          <span className={`absolute inset-x-5 bottom-2 top-[50px] flex flex-col items-center rounded-md pt-4 ${card}`}>
            <span className={`block h-1.5 w-1/2 ${wire} ${name}`} /><span className={`mt-1 block h-1 w-1/4 ${wire} ${line}`} />
          </span>
          <span className={`absolute left-1/2 top-7 h-9 w-9 -translate-x-1/2 rounded-full ${photo}`} />
        </>
      )}
      {id === 'poster' && (
        <span className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-b from-[#1e40af] to-[#05070d] pb-2.5">
          <span className={`h-7 w-7 rounded-lg ${photo}`} />
          <span className="mt-1.5 block h-2.5 w-3/4 rounded-[3px] bg-white" />
          <span className="mt-1 block h-1 w-1/3 rounded-[3px] bg-[#facc15]" />
        </span>
      )}
      {id === 'side-showcase' && (
        <>
          <span className={`absolute inset-x-0 top-0 h-10 ${banner}`} />
          <span className={`absolute inset-x-2 bottom-2 top-[30px] rounded-md p-1.5 ${card}`}>
            <span className="flex items-center gap-1.5">
              <span className={`h-8 w-8 shrink-0 rounded-md ${photo}`} />
              <span className="flex-1"><span className={`block h-1.5 w-4/5 ${wire} ${name}`} /><span className={`mt-1 block h-1 w-1/2 ${wire} ${line}`} /></span>
            </span>
            <span className="mt-1.5 flex gap-1"><span className="h-2 w-8 rounded-full bg-slate-200" /><span className="h-2 w-8 rounded-full bg-slate-200" /></span>
          </span>
        </>
      )}
    </span>
  );
};

// Esquemas de la vitrina destacada
export const ShowcaseWire = ({ id }) => {
  const soft = 'bg-slate-300';
  return (
    <span className="relative block h-full overflow-hidden rounded-[inherit] bg-slate-100 p-2.5" aria-hidden="true">
      {id === 'folders' && (
        <span className="flex h-full flex-col justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex items-center gap-2"><span className="h-6 w-4 rounded-[3px] bg-emerald-500" /><span className="flex-1"><span className={`block h-1.5 w-4/5 rounded-full bg-[#12315f]`} /><span className={`mt-1 block h-1 w-1/2 rounded-full ${soft}`} /></span></span>
          ))}
        </span>
      )}
      {id === 'collector' && (
        <span className="flex h-full flex-col justify-center gap-2">
          <span className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="flex-1 rounded-md bg-white p-1.5 shadow-sm"><span className="block h-2 w-5 rounded-full bg-[#facc15]" /><span className={`mt-1 block h-1 w-full rounded-full ${soft}`} /></span>)}</span>
          <span className="flex gap-1"><span className="h-3 w-8 rounded-full bg-[#12315f]" /><span className="h-3 w-8 rounded-full bg-[#1e40af]" /><span className="h-3 w-8 rounded-full bg-emerald-500" /></span>
        </span>
      )}
      {id === 'seller' && (
        <span className="flex h-full flex-col justify-center gap-2">
          <span className="flex items-center gap-1.5"><span className="h-5 w-14 rounded-full bg-[#facc15]" /><span className="h-5 w-5 rounded-full bg-white shadow-sm" /><span className="h-5 w-5 rounded-full bg-white shadow-sm" /></span>
          <span className="grid grid-cols-3 gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="h-9 rounded-[3px] bg-emerald-500" />)}</span>
        </span>
      )}
      {id === 'minimal' && (
        <span className="flex h-full flex-col items-center justify-center gap-1.5"><span className="h-1.5 w-20 rounded-full bg-[#12315f]" /><span className={`h-1 w-12 rounded-full ${soft}`} /></span>
      )}
    </span>
  );
};
