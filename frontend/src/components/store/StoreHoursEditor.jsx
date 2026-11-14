import SvgIcon from '../ui/SvgIcon';
import { DAY_NAMES, STORE_DAYS, chileToday } from '../../utils/storeHours';

const MAX_RANGES = 2;
const timeInput = 'h-10 w-[6.5rem] rounded-xl border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-800 focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20';
const smallBtn = 'inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-bold transition active:scale-[0.97]';

function RangesRow({ ranges, onChange, label }) {
  const set = (i, key, v) => onChange(ranges.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ranges.length === 0 && <span className="text-sm font-semibold text-slate-400">Cerrado</span>}
      {ranges.map((r, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <input type="time" aria-label={`${label}: abre`} className={timeInput} value={r.open} onChange={(e) => set(i, 'open', e.target.value)} />
          <span className="text-slate-400">–</span>
          <input type="time" aria-label={`${label}: cierra`} className={timeInput} value={r.close} onChange={(e) => set(i, 'close', e.target.value)} />
          <button type="button" aria-label={`Quitar tramo de ${label}`} onClick={() => onChange(ranges.filter((_, j) => j !== i))} className="grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 active:scale-[0.95]">
            <SvgIcon name="close" className="text-lg" />
          </button>
        </span>
      ))}
      {ranges.length < MAX_RANGES && (
        <button type="button" onClick={() => onChange([...ranges, { open: '10:00', close: '20:00' }])} className={`${smallBtn} bg-blue-50 text-[#1e40af] hover:bg-blue-100`}>
          <SvgIcon name="add" className="text-base" />{ranges.length ? 'Otro tramo' : 'Abrir'}
        </button>
      )}
    </div>
  );
}

// Horario semanal (hasta 2 tramos por día) y días especiales (feriados, otro horario)
export default function StoreHoursEditor({ value, onChange, exceptions = [], onExceptionsChange }) {
  const hours = value || {};
  const setDay = (day, ranges) => onChange({ ...hours, [day]: ranges });
  const copyToAll = (day) => onChange(Object.fromEntries(STORE_DAYS.map((d) => [d, (hours[day] || []).map((r) => ({ ...r }))])));
  const setEx = (i, patch) => onExceptionsChange(exceptions.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {STORE_DAYS.map((day) => (
          <li key={day} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4">
            <span className="w-24 shrink-0 text-sm font-black text-[#1a2b4b]">{DAY_NAMES[day]}</span>
            <div className="flex-1"><RangesRow label={DAY_NAMES[day]} ranges={hours[day] || []} onChange={(r) => setDay(day, r)} /></div>
            {day === 'mon' && (
              <button type="button" onClick={() => copyToAll('mon')} className={`${smallBtn} self-start bg-slate-100 text-slate-700 hover:bg-slate-200 sm:self-auto`}>
                Copiar a todos los días
              </button>
            )}
          </li>
        ))}
      </ul>

      {onExceptionsChange && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="text-sm font-black text-[#1a2b4b]">Días especiales</h4>
            {exceptions.length < 30 && (
              <button type="button" onClick={() => onExceptionsChange([...exceptions, { date: chileToday(), closed: true, ranges: [], note: '' }])} className={`${smallBtn} bg-blue-50 text-[#1e40af] hover:bg-blue-100`}>
                <SvgIcon name="add" className="text-base" />Agregar día
              </button>
            )}
          </div>
          {exceptions.length === 0 ? (
            <p className="text-sm text-slate-500">Feriados, inventario o un horario distinto. Se borran solos cuando pasan.</p>
          ) : (
            <ul className="space-y-2">
              {exceptions.map((e, i) => (
                <li key={i} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="date" aria-label="Fecha" min={chileToday()} value={e.date} onChange={(ev) => setEx(i, { date: ev.target.value })} className={`${timeInput} w-[10rem]`} />
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input type="checkbox" checked={e.closed} onChange={(ev) => setEx(i, { closed: ev.target.checked, ranges: ev.target.checked ? [] : [{ open: '10:00', close: '14:00' }] })} className="h-4 w-4 accent-[#1e40af]" />
                      Cerrado
                    </label>
                    <button type="button" aria-label="Quitar día especial" onClick={() => onExceptionsChange(exceptions.filter((_, j) => j !== i))} className="ml-auto grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600">
                      <SvgIcon name="delete" className="text-lg" />
                    </button>
                  </div>
                  {!e.closed && <RangesRow label="Día especial" ranges={e.ranges || []} onChange={(r) => setEx(i, { ranges: r })} />}
                  <input type="text" maxLength={80} placeholder="Nota (opcional): Feriado, inventario…" value={e.note || ''} onChange={(ev) => setEx(i, { note: ev.target.value })} className="h-10 rounded-xl border border-slate-300 px-3 text-sm focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20" />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
