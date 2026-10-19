import SvgIcon from '../ui/SvgIcon';
const BUTTON = 'flex h-11 flex-1 items-center justify-center gap-1 rounded-full bg-white px-4 text-sm font-extrabold text-[#12315f] ring-1 ring-slate-900/10 transition-[transform,opacity] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] disabled:pointer-events-none disabled:opacity-40 sm:flex-none';
const NUMBER = 'flex h-11 min-w-11 items-center justify-center rounded-full px-2 text-sm font-extrabold tabular-nums transition-[transform,background-color] duration-150 active:scale-[0.95] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]';

// Números a mostrar: todos si son pocos; si no, la primera, la última y las vecinas de la actual con "…" en los saltos
const pageItems = (page, pages) => {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) { keep.add(2); keep.add(3); keep.add(4); }
  if (page >= pages - 2) { keep.add(pages - 1); keep.add(pages - 2); keep.add(pages - 3); }
  const sorted = [...keep].filter((number) => number >= 1 && number <= pages).sort((a, b) => a - b);
  return sorted.flatMap((number, index) => (index > 0 && number - sorted[index - 1] > 1 ? ['…', number] : [number]));
};

// `openEnded`: todavía no se sabe cuántas páginas hay en total (se sigue buscando); solo se muestran las páginas que ya existen
export default function CardsPagination({ onPage, openEnded = false, page, pages }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Paginación" className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
      <ul className="order-first flex w-full flex-wrap items-center justify-center gap-1.5 sm:order-none sm:w-auto">
        {pageItems(page, pages).map((item, index) => (
          <li key={item === '…' ? `gap-${index}` : item}>
            {item === '…'
              ? <span aria-hidden="true" className="flex h-11 w-6 items-center justify-center text-sm font-bold text-slate-500">…</span>
              : <button type="button" onClick={() => item !== page && onPage(item)} aria-label={`Página ${item}`} aria-current={item === page ? 'page' : undefined} className={`${NUMBER} ${item === page ? 'bg-[#12315f] text-white' : 'bg-white text-[#12315f] ring-1 ring-slate-900/10 [@media(hover:hover)]:hover:bg-[#eef2fa]'}`}>{item}</button>}
          </li>
        ))}
        {openEnded && <li aria-hidden="true" className="flex h-10 items-center px-1 text-sm font-bold text-slate-500">…</li>}
      </ul>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={`${BUTTON} sm:order-first`}>
        <SvgIcon name="chevron_left" translate="no" aria-hidden="true" className="text-[20px]" />Anterior
      </button>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={BUTTON}>
        Siguiente<SvgIcon name="chevron_right" translate="no" aria-hidden="true" className="text-[20px]" />
      </button>
    </nav>
  );
}
