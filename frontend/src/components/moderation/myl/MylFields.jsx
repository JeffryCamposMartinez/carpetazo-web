import { useId, useState } from 'react';
import SvgIcon from '../../ui/SvgIcon';

export const INPUT = 'h-12 w-full rounded-xl border-2 border-[#12315f]/15 bg-white px-3 text-[15px] font-bold text-[#12315f] outline-none transition-[border-color,box-shadow] duration-150 placeholder:font-medium placeholder:text-slate-400 focus:border-[#1e40af] focus:shadow-[0_0_0_3px_rgba(30,64,175,0.15)] disabled:bg-slate-100 disabled:text-slate-500';
export const SECTION = 'rounded-2xl border border-[#dbe3f0] bg-white p-4 sm:p-5';
export const titleCase = (text) => String(text || '').toLowerCase().replace(/_/g, ' ').replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

// Un campo con su rótulo, un ejemplo de una carta real y el error si lo hay
export function Field({ label, required, example, hint, error, htmlFor, className = '', children }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 flex flex-wrap items-baseline gap-x-2 text-sm font-extrabold text-[#12315f]">
        <span>{label}{required && <span className="text-red-600" aria-hidden="true"> *</span>}</span>
        {example && <span className="text-xs font-semibold text-slate-500">Ej: {example}</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs font-bold text-red-700">{error}</p>}
    </div>
  );
}

// Varios valores (razas, habilidades): se escribe y se pulsa Enter o coma; las que ya usan otras cartas se sugieren
export function ChipInput({ id, values, onChange, suggestions = [], max, placeholder, format = (value) => value }) {
  const [draft, setDraft] = useState('');
  const listId = useId();
  const add = (raw) => {
    const value = format(raw.trim());
    if (value && values.length < max && !values.some((item) => item.toLowerCase() === value.toLowerCase())) onChange([...values, value]);
    setDraft('');
  };
  return (
    <div>
      {values.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {values.map((value) => (
            <li key={value} className="flex items-center gap-1 rounded-full bg-[#e8effc] py-1 pl-3 pr-1 text-sm font-bold text-[#12315f]">
              {value}
              <button type="button" onClick={() => onChange(values.filter((item) => item !== value))} aria-label={`Quitar ${value}`} className="flex h-6 w-6 items-center justify-center rounded-full text-[#12315f]/70 transition-colors hover:bg-[#12315f]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"><SvgIcon name="close" translate="no" aria-hidden="true" className="text-[16px]" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id} list={listId} value={draft} maxLength={60} disabled={values.length >= max} placeholder={values.length >= max ? `Máximo ${max}` : placeholder} className={INPUT}
          onChange={(event) => (event.target.value.endsWith(',') ? add(event.target.value.slice(0, -1)) : setDraft(event.target.value))}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(draft); } }}
          onBlur={() => draft.trim() && add(draft)}
        />
        <button type="button" onClick={() => add(draft)} disabled={!draft.trim() || values.length >= max} className="h-12 shrink-0 rounded-xl bg-[#12315f] px-4 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-[#1e40af] active:scale-[0.97] disabled:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">Agregar</button>
      </div>
      <datalist id={listId}>{suggestions.filter((item) => !values.includes(item)).slice(0, 80).map((item) => <option key={item} value={item} />)}</datalist>
    </div>
  );
}
