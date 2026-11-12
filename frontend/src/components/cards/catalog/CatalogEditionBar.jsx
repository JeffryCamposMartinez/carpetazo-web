import SvgIcon from '../../ui/SvgIcon';
import { ARROW_BUTTON } from '../../ui/arrowButton';
import SlideSwap from './SlideSwap';

const NAV = `${ARROW_BUTTON} h-11 w-11 shrink-0`;

const dateOf = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }) : '';
};

// Edición que se está mirando: nombre, fecha, cantidad de cartas y botones para pasar a la más nueva / más antigua o compartir el enlace
export default function CatalogEditionBar({ group, count, total, loading, dir, newer, older, onGo, onShare }) {
  const meta = [group.abbreviation, dateOf(group.publishedOn)].filter(Boolean).join(' · ');
  return (
    <div className="mt-4 flex items-center gap-2 rounded-2xl bg-[#12315f] p-2 text-white shadow-[0_14px_28px_-18px_rgba(18,49,95,0.9)]">
      <span aria-hidden="true" className="hidden h-11 w-11 shrink-0 sm:block" />
      <button type="button" onClick={() => onGo(newer, -1)} disabled={!newer} aria-label="Edición más nueva" className={NAV}><SvgIcon name="chevron_left" translate="no" aria-hidden="true" className="text-[24px]" /></button>
      <SlideSwap id={group.groupId} dir={dir} className="min-w-0 flex-1 text-center"><div aria-live="polite">
        <h2 className="truncate text-base font-extrabold leading-tight md:text-lg">{group.name}</h2>
        <p className="truncate text-xs font-bold text-blue-100/85">
          {loading ? 'Cargando cartas…' : `${count === total ? total : `${count} de ${total}`} ${total === 1 ? 'carta' : 'cartas'}`}{meta && ` · ${meta}`}
        </p>
      </div></SlideSwap>
      <button type="button" onClick={onShare} aria-label="Compartir esta edición" className={`${NAV} hidden sm:flex`}><SvgIcon name="share" translate="no" aria-hidden="true" className="text-[20px]" /></button>
      <button type="button" onClick={() => onGo(older, 1)} disabled={!older} aria-label="Edición más antigua" className={NAV}><SvgIcon name="chevron_right" translate="no" aria-hidden="true" className="text-[24px]" /></button>
    </div>
  );
}
