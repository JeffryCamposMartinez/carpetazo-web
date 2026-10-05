import FlipCounter from '../ui/FlipCounter';

const SURFACE = 'rounded-2xl bg-white ring-1 ring-slate-900/5 shadow-[0_1px_2px_rgba(26,43,75,0.06),0_10px_24px_-18px_rgba(26,43,75,0.35)]';

// Resumen de «Mis carpetas»: en pantallas anchas es una columna a la derecha de las carpetas (con el atajo a los pedidos por atender);
// en tablet es una franja sobre las carpetas. En el celular no se muestra: ahí basta la línea con el conteo y el botón de crear.
export default function FolderSummary({ folderCount, publicCount, cardCount, weeklyVisits, pendingCount, onOpenRequests, variant }) {
  const rows = [
    { label: 'Carpetas', value: folderCount, hint: `${publicCount} ${publicCount === 1 ? 'pública' : 'públicas'}` },
    { label: 'Cartas', value: cardCount, hint: 'en total' },
    { label: 'Visitas', value: weeklyVisits, hint: 'esta semana', live: true }
  ];

  if (variant === 'strip') {
    return (
      <dl className={`${SURFACE} mb-6 hidden grid-cols-3 divide-x divide-slate-100 sm:grid lg:hidden`}>
        {rows.map((row) => (
          <div key={row.label} className="px-5 py-4 first:pl-6">
            <dt className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              {row.label}
              {row.live && <LiveDot />}
            </dt>
            <dd className="mt-1 font-['Space_Grotesk'] text-3xl font-bold tabular-nums leading-none text-[#1a2b4b]">{row.value.toLocaleString('es-CL')}</dd>
            <dd className="mt-1.5 text-xs text-slate-500">{row.hint}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <aside aria-labelledby="folder-summary-title" className="hidden lg:sticky lg:top-32 lg:flex lg:flex-col lg:gap-4">
      <section className={`${SURFACE} p-5`}>
        <h2 id="folder-summary-title" className="text-base font-extrabold text-[#1a2b4b]">Resumen</h2>
        <dl className="mt-2 divide-y divide-slate-100">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 py-4 first:pt-3 last:pb-1">
              <div className="min-w-0">
                <dt className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  {row.label}
                  {row.live && <LiveDot />}
                </dt>
                <dd className="mt-0.5 text-xs text-slate-500">{row.hint}</dd>
              </div>
              <dd><FlipCounter value={row.value} label={row.label} style={{ fontSize: '1.625rem' }} /></dd>
            </div>
          ))}
        </dl>
      </section>

      {pendingCount > 0 && (
        <button
          type="button"
          onClick={onOpenRequests}
          className="group flex items-center justify-between gap-4 rounded-2xl bg-[#1a2b4b] p-4 text-left text-white shadow-[0_1px_2px_rgba(8,18,42,0.3),0_12px_24px_-14px_rgba(8,18,42,0.7)] transition-[transform,filter] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:brightness-110 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] focus-visible:ring-offset-2 focus-visible:ring-offset-[#DBEAFE]"
        >
          <span>
            <span className="block text-sm text-blue-200">Por atender</span>
            <span className="block text-lg font-extrabold">{pendingCount} {pendingCount === 1 ? 'pedido' : 'pedidos'}</span>
          </span>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#ffcb05] text-[#1a2b4b] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5">
            <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[22px]">arrow_forward</span>
          </span>
        </button>
      )}
    </aside>
  );
}

function LiveDot() {
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700" title="Se actualiza sola, sin recargar la página">
      <span aria-hidden="true" className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      en vivo
    </span>
  );
}
