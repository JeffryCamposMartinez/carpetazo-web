import ComunaSelect from './ComunaSelect';
import ThemedSelect from './ThemedSelect';

// Barra de resultados de Carpetas y Vendedores: cuántos hay, comuna y orden (mismo estilo que en Cartas)
// En el celular cada filtro ocupa toda la fila para que se lea su texto
const FILTER_WIDTH = 'basis-full sm:w-52 sm:basis-auto';
const FILTER_BUTTON = '!min-h-10 !rounded-full !text-[13px]';

export default function ListingToolbar({ total, loading, failed, one, many, comuna, onComuna, sort, onSort, sortOptions, onClear }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
      <p className="min-w-0 basis-full text-[15px] font-extrabold text-[#12315f] sm:basis-auto" aria-live="polite">
        {loading ? <span className="font-semibold text-slate-500">Buscando…</span> : failed ? '' : (
          <><span className="tabular-nums">{total.toLocaleString('es-CL')}</span> {total === 1 ? one : many}
            {onClear && <button type="button" onClick={onClear} className="ml-3 text-sm font-bold text-[#1e40af] underline-offset-2 hover:underline">Quitar filtros</button>}</>
        )}
      </p>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:flex-nowrap">
        <ComunaSelect value={comuna} onChange={onComuna} className={FILTER_WIDTH} buttonClassName={FILTER_BUTTON} listMinWidth={260} />
        <ThemedSelect value={sort} onChange={onSort} options={sortOptions} icon="swap_vert" ariaLabel="Ordenar" className="basis-full sm:w-72 sm:basis-auto" buttonClassName={FILTER_BUTTON} />
      </div>
    </div>
  );
}
