import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { ButtonSpinner } from '../ui/LoadingState';

const KINDS = [
  ['confirm', 'Confirmó la propuesta'],
  ['correct', 'Eligió otra distinta'],
  ['change', 'Cambió la versión'],
  ['reject', 'Quitó la carta agregada'],
  ['dismiss', 'Cerró sin elegir'],
];
const KIND_NAME = Object.fromEntries(KINDS);
const when = (iso) => new Date(iso).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const pct = (part, whole) => (whole > 0 ? `${Math.round((100 * part) / whole)} %` : '—');

// Lo que la gente elige en «Selecciona tu carta» frente a lo que propuso el motor: mide cuántas correcciones hay antes de decidir si el escáner aprende de ellas
export default function ScannerChoicesPanel() {
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      setData(await api.getScanChoices());
      setState('ready');
    } catch (_error) {
      setState('error');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const week = data?.lastWeek || {};
  const decided = (week.confirm || 0) + (week.correct || 0);

  return (
    <section aria-label="Elecciones del escáner" className="rounded-2xl border border-[#dbe3f0] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-extrabold text-[#12315f]">Elecciones del escáner</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">Lo que elige la gente en «Selecciona tu carta» frente a la primera propuesta del motor. Solo se registra; todavía no se aprende de esto.</p>
        </div>
        <button type="button" onClick={load} disabled={state === 'loading'} className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-[#dbe3f0] px-4 text-sm font-extrabold text-[#1e40af] transition-[background-color,transform] duration-150 hover:bg-blue-50 active:scale-95 disabled:opacity-60">
          {state === 'loading' && <ButtonSpinner />}Actualizar
        </button>
      </div>

      {state === 'error' && <p role="alert" className="mt-4 text-sm font-semibold text-red-700">No se pudo cargar el resumen. Inténtalo de nuevo.</p>}
      {state === 'ready' && data.total === 0 && <p className="mt-4 text-sm font-semibold text-slate-600">Todavía no hay elecciones registradas. Aparecerán cuando alguien use el escáner de una carpeta.</p>}

      {state === 'ready' && data.total > 0 && (
        <>
          <p className="mt-4 text-sm text-slate-700">
            Últimos 7 días: el motor acertó a la primera en <strong className="text-[#12315f]">{pct(week.confirm || 0, decided)}</strong> de las {decided} elecciones con carta. Total registrado: {data.total}.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {KINDS.map(([kind, label]) => (
              <div key={kind} className="rounded-xl bg-[#f3f7ff] p-3">
                <dt className="text-xs font-semibold text-slate-600">{label}</dt>
                <dd className="mt-0.5 text-xl font-extrabold text-[#12315f]">{week[kind] || 0}<span className="ml-1.5 text-xs font-semibold text-slate-500">de {data.byKind[kind] || 0} en total</span></dd>
              </div>
            ))}
          </dl>
          <h4 className="mt-5 text-sm font-extrabold text-[#12315f]">Últimas elecciones</h4>
          <ul className="mt-2 divide-y divide-slate-100">
            {data.recent.map((row) => (
              <li key={row.id} className="py-2.5 text-sm">
                <p className="font-bold text-[#12315f]">{KIND_NAME[row.kind] || row.kind}<span className="ml-2 text-xs font-semibold text-slate-500">{when(row.createdAt)}{row.quick ? ' · sin preguntar' : ''}</span></p>
                <p className="text-slate-700">
                  Propuso: {row.topName || (row.topProductId ? `carta ${row.topProductId}` : '—')}{typeof row.topScore === 'number' ? ` (${row.topScore.toFixed(2)})` : ''}
                </p>
                {row.chosenProductId !== null && <p className="text-slate-700">Eligió: {row.chosenName || `carta ${row.chosenProductId}`}{row.chosenFinish ? ` · ${row.chosenFinish}` : ''}{row.rank !== null ? ` · posición ${row.rank + 1}` : ''}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
