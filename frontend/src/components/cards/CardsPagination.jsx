const BUTTON = 'flex h-11 items-center gap-1 rounded-full bg-white px-4 text-sm font-extrabold text-[#12315f] ring-1 ring-slate-900/10 transition-[transform,opacity] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] disabled:pointer-events-none disabled:opacity-40';

export default function CardsPagination({ onPage, page, pages }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Paginación" className="mt-8 flex items-center justify-between gap-3 sm:justify-center sm:gap-6">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={BUTTON}>
        <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">chevron_left</span>Anterior
      </button>
      <span className="text-sm font-bold tabular-nums text-slate-600">{page} de {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={BUTTON}>
        Siguiente<span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">chevron_right</span>
      </button>
    </nav>
  );
}
