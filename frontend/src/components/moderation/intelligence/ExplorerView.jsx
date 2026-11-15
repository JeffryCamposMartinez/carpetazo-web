import { useState } from 'react';
import { apiUrl } from '../../../services/api';
import { auth } from '../../../services/firebase';
import Select from '../../ui/Select';
import { ErrorBox } from '../shared';
import { BarList, Loaded, Note, Section, Table, fmtNum, useIntel } from './intelUi';

const GROUP = { day: 'Día', path: 'Página', device: 'Dispositivo', browser: 'Navegador', os: 'Sistema', source: 'Fuente', game: 'Juego', origin: 'Origen (web/servidor)' };
const MEASURE = { events: 'Cantidad de eventos', visitors: 'Visitantes únicos', sessions: 'Sesiones', users: 'Usuarios con cuenta' };
const field = 'h-11 w-full rounded-xl border border-[#c5d2ea] bg-white px-3 text-base font-semibold text-[#12315f] sm:text-sm';

// Explorador con lista blanca: evento del catálogo × agrupación × medida. No hay consultas libres.
export default function ExplorerView({ period }) {
  const options = useIntel('explore/options', {});
  const [event, setEvent] = useState('page_view');
  const [groupBy, setGroupBy] = useState('day');
  const [measure, setMeasure] = useState('events');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const params = { event, groupBy, measure, from: period.range.from, to: period.range.to };
  const result = useIntel('explore', params, period.valid);

  const download = async () => {
    setBusy(true); setError('');
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const res = await fetch(apiUrl(`/admin/intelligence/explore.csv?${new URLSearchParams(params)}`), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'No se pudo exportar');
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url; link.download = `intelligence-${event}-${params.from}_${params.to}.csv`; link.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <Section title="Explorador de datos" note="Cruza un evento medido con una agrupación. Solo combinaciones permitidas; cada exportación queda en la auditoría.">
        <Loaded state={options} skeletonRows={1}>
          {(o) => (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-xs font-bold text-slate-600">Evento<Select value={event} onChange={(e) => setEvent(e.target.value)} className={`${field} mt-1`}>{o.events.map((x) => <option key={x} value={x}>{x}</option>)}</Select></label>
              <label className="block text-xs font-bold text-slate-600">Agrupar por<Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className={`${field} mt-1`}>{o.groupBy.map((x) => <option key={x} value={x}>{GROUP[x] || x}</option>)}</Select></label>
              <label className="block text-xs font-bold text-slate-600">Medida<Select value={measure} onChange={(e) => setMeasure(e.target.value)} className={`${field} mt-1`}>{o.measures.map((x) => <option key={x} value={x}>{MEASURE[x] || x}</option>)}</Select></label>
            </div>
          )}
        </Loaded>
      </Section>
      <ErrorBox>{error}</ErrorBox>
      <Loaded state={result}>
        {(d) => (
          <Section title={`${event} por ${(GROUP[groupBy] || groupBy).toLowerCase()}`} note={`${MEASURE[measure]} · ${d.rows.length} filas`}>
            {d.rows.length === 0 ? <Note>Sin datos de este evento en el periodo. Solo existen eventos medidos desde que se encendió la medición.</Note> : (
              <>
                {groupBy !== 'day' && <div className="mb-4"><BarList rows={d.rows.slice(0, 12).map((r) => ({ label: r.key, value: r.value }))} /></div>}
                <Table rowKey={(r) => r.key} rows={d.rows} columns={[{ key: 'key', label: GROUP[groupBy] || groupBy }, { key: 'value', label: MEASURE[measure], right: true, render: (r) => fmtNum(r.value) }]} />
              </>
            )}
            <button type="button" onClick={download} disabled={busy || d.rows.length === 0} className="mt-4 h-11 rounded-full bg-[#12315f] px-5 text-sm font-extrabold text-white transition-[transform,opacity] duration-150 active:scale-[0.97] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15]">{busy ? 'Exportando…' : 'Exportar CSV'}</button>
          </Section>
        )}
      </Loaded>
    </>
  );
}
