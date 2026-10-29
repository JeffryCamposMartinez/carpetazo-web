import ComunaSelect from '../ui/ComunaSelect';
import ThemedSelect from '../ui/ThemedSelect';
import SvgIcon from '../ui/SvgIcon';
import { CARD_CONDITIONS } from '../../config/cardConditions';
const SORT_OPTIONS = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'best_selling', label: 'Más vendidos' },
  { value: 'latest_edition', label: 'Última edición' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
  { value: 'condition_desc', label: 'Estado: mejor a peor' },
  { value: 'condition_asc', label: 'Estado: peor a mejor' },
];
const CONDITION_OPTIONS = [{ value: '', label: 'Estado' }, ...CARD_CONDITIONS.map((item) => ({ value: String(item.value), label: `${'★'.repeat(item.value)} ${item.label}${item.value < 5 ? ' o mejor' : ''}` }))];
const LANG_OPTIONS = [{ value: '', label: 'Idioma' }, { value: 'es', label: 'Español' }, { value: 'en', label: 'Inglés' }, { value: 'ja', label: 'Japonés' }];
const LANG_LABEL = { es: 'Español', en: 'Inglés', ja: 'Japonés' };
export const SORT_VALUES = SORT_OPTIONS.map((option) => option.value);

const REMOVABLE = 'inline-flex h-9 max-w-full items-center gap-1 rounded-full bg-white pl-3 pr-1.5 text-xs font-bold text-[#12315f] ring-1 ring-slate-900/10 transition-[background-color,transform] duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] [@media(hover:hover)]:hover:bg-blue-50';

// Cantidad de cartas, filtros activos (cada uno se quita con un toque), orden y vista (cuadrícula o lista en el celular)
// Comuna y orden comparten ancho y forma
const FILTER_WIDTH = 'basis-full sm:w-52 sm:basis-auto';
const FILTER_HALF = 'min-w-0 grow basis-[calc(50%-0.25rem)] sm:w-52 sm:grow-0 sm:basis-auto'; // estado e idioma comparten fila en el celular
const FILTER_BUTTON = '!min-h-10 !rounded-full !text-[13px]';

export default function CardsResultsBar({ failed, loading, comuna, condition = '', onCondition, lang = '', onLang, onClearAll, onComuna, onComunaChange, onQuery, onSeller, onSort, onTcg, onView, query, seller, sort, tcg, total, view }) {
  const hasFilters = Boolean(query || tcg || seller || comuna || condition || lang);
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
        <p className="min-w-0 basis-full text-[15px] sm:basis-auto font-extrabold text-[#12315f]" aria-live="polite">
          {loading ? <span className="font-semibold text-slate-500">Buscando cartas…</span> : failed ? '' : (
            <><span className="tabular-nums">{total.toLocaleString('es-CL')}</span> {total === 1 ? 'carta a la venta' : 'cartas a la venta'}</>
          )}
        </p>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:flex-nowrap">
          <ComunaSelect value={comuna} onChange={onComunaChange} className={FILTER_WIDTH} buttonClassName={FILTER_BUTTON} listMinWidth={260} />
          {onCondition && <ThemedSelect value={condition} onChange={onCondition} options={CONDITION_OPTIONS} icon="star" ariaLabel="Estado de la carta" className={FILTER_HALF} buttonClassName={FILTER_BUTTON} listMinWidth={230} />}
          {onLang && <ThemedSelect value={lang} onChange={onLang} options={LANG_OPTIONS} icon="translate" ariaLabel="Idioma de la carta" className={FILTER_HALF} buttonClassName={FILTER_BUTTON} listMinWidth={200} />}
          <ThemedSelect value={sort} onChange={onSort} options={SORT_OPTIONS} icon="swap_vert" ariaLabel="Ordenar" className="min-w-0 flex-1 sm:w-52 sm:flex-none" buttonClassName={FILTER_BUTTON} />
          <div role="group" aria-label="Vista" className="flex h-10 items-center rounded-full bg-white p-1 ring-1 ring-slate-900/10 lg:hidden">
            {[{ value: 'grid', icon: 'grid_view', label: 'Cuadrícula' }, { value: 'list', icon: 'view_agenda', label: 'Lista' }].map((option) => (
              <button key={option.value} type="button" aria-pressed={view === option.value} aria-label={option.label} onClick={() => onView(option.value)} className={`flex h-8 w-9 items-center justify-center rounded-full transition-[background-color,color,transform] duration-150 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] ${view === option.value ? 'bg-[#12315f] text-white' : 'text-slate-500'}`}>
                <SvgIcon name={option.icon} translate="no" aria-hidden="true" className="text-[20px]" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {tcg && <button type="button" onClick={() => onTcg('')} className={REMOVABLE}>{tcg}<SvgIcon name="close" translate="no" aria-hidden="true" className="text-[18px] text-slate-500" /><span className="sr-only">Quitar filtro</span></button>}
          {lang && <button type="button" onClick={() => onLang('')} className={REMOVABLE}>Idioma: {LANG_LABEL[lang]}<SvgIcon name="close" translate="no" aria-hidden="true" className="text-[18px] text-slate-500" /><span className="sr-only">Quitar filtro de idioma</span></button>}
          {comuna && <button type="button" onClick={onComuna} className={REMOVABLE}>Comuna: {comuna}<SvgIcon name="close" translate="no" aria-hidden="true" className="text-[18px] text-slate-500" /><span className="sr-only">Quitar filtro de comuna</span></button>}
          {seller && <button type="button" onClick={onSeller} className={REMOVABLE}><span className="min-w-0 truncate">Vendedor: @{seller}</span><SvgIcon name="close" translate="no" aria-hidden="true" className="text-[18px] text-slate-500" /><span className="sr-only">Quitar filtro de vendedor</span></button>}
          {query && <button type="button" onClick={() => onQuery('')} className={REMOVABLE}><span className="min-w-0 truncate">“{query}”</span><SvgIcon name="close" translate="no" aria-hidden="true" className="text-[18px] text-slate-500" /><span className="sr-only">Quitar búsqueda</span></button>}
          {[tcg, query, seller, comuna, condition, lang].filter(Boolean).length > 1 && <button type="button" onClick={onClearAll} className="h-9 rounded-full px-3 text-xs font-bold text-[#1e40af] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">Quitar todo</button>}
        </div>
      )}
    </div>
  );
}
