import { Link } from 'react-router-dom';

// Estados del perfil público fuera del caso normal: cargando y no disponible

export function ProfileLoading() {
  const block = 'animate-pulse rounded-2xl bg-white/70 motion-reduce:animate-none';
  return (
    <div className="mx-auto w-full max-w-[1220px] space-y-5 px-4 py-5 sm:px-6 md:px-8" role="status" aria-label="Cargando perfil" aria-busy="true">
      <div className={`${block} h-[300px] sm:h-[340px]`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className={`${block} h-[72px]`} />)}</div>
      <div className={`${block} h-8 w-56`} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className={`${block} aspect-[32/37]`} />)}</div>
    </div>
  );
}

export function ProfileUnavailable() {
  return (
    <main className="flex min-h-[calc(100svh-120px)] items-center justify-center bg-[#DBEAFE] px-5 py-12">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="relative mb-8 h-[132px] w-[124px]" aria-hidden="true">
          <span className="absolute left-0 top-2 h-[118px] w-[86px] -rotate-[10deg] rounded-xl border-2 border-[#1e40af]/25 bg-white/60" />
          <span className="absolute right-0 top-0 grid h-[124px] w-[90px] rotate-[6deg] place-items-center rounded-xl bg-[#12315f] text-[#facc15] shadow-[0_18px_34px_-14px_rgba(18,49,95,0.7)]">
            <span translate="no" className="material-symbols-outlined text-[38px]">lock</span>
          </span>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#1e40af] ring-1 ring-[#1e40af]/15">Perfil no disponible</span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#12315f] [text-wrap:balance]">No pudimos mostrar este perfil</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600">Puede estar en revisión, o el enlace ya no existe. Revisa el nombre de usuario o busca al vendedor de nuevo.</p>
        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
          <Link to="/vendedores" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#facc15] px-6 text-[15px] font-extrabold text-[#12315f] shadow-sm transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            Ver vendedores
          </Link>
          <Link to="/" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-bold text-[#12315f] ring-1 ring-slate-900/10 transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_back</span>Volver al inicio
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-600">
          O explora <Link to="/cartas" className="font-bold text-[#1e40af] underline underline-offset-2">las cartas en venta</Link> y <Link to="/carpetas" className="font-bold text-[#1e40af] underline underline-offset-2">las carpetas</Link>.
        </p>
        <p className="mt-6 text-sm text-slate-600">¿Crees que es un error? Escríbenos a <a href="mailto:carpetazo.soporte@gmail.com" className="font-bold text-[#1e40af] underline underline-offset-2">carpetazo.soporte@gmail.com</a>.</p>
      </div>
    </main>
  );
}

// Celular: el botón de contactar siempre a mano mientras se recorre el perfil
export function ProfileContactBar({ displayName, folders, onContact, publicTheme, readableOn, totalCards }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[45] flex items-center gap-3 border-t border-black/5 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_-12px_rgba(8,18,42,0.35)] backdrop-blur sm:hidden">
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-[15px] font-extrabold text-[#12315f]">{displayName}</strong>
        <span className="block truncate text-xs font-semibold tabular-nums text-slate-500">{folders} {folders === 1 ? 'carpeta' : 'carpetas'} · {totalCards.toLocaleString('es-CL')} {totalCards === 1 ? 'carta' : 'cartas'}</span>
      </span>
      <button type="button" onClick={onContact} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full px-5 text-[15px] font-extrabold shadow-md transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2" style={{ backgroundColor: publicTheme.accent, color: readableOn(publicTheme.accent) }}>
        <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">chat</span>Contactar
      </button>
    </div>
  );
}
