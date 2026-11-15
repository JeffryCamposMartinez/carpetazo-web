import { useMemo, useState } from 'react';
import { BarList, Loaded, LineChart, Note, Section, Stat, Table, fmtDay, fmtNum, fmtPct, fmtSec, useIntel } from './intelUi';

const asRows = (list) => list.map((x) => ({ label: x.key, value: x.sessions, extra: fmtPct(x.share, 0) }));

function Pages({ period }) {
  const state = useIntel('pages', { from: period.range.from, to: period.range.to }, period.valid);
  const [filter, setFilter] = useState('');
  return (
    <Loaded state={state}>
      {(d) => {
        const rows = d.rows.filter((r) => r.path.toLowerCase().includes(filter.trim().toLowerCase()));
        return (
          <Section title="Explorador de páginas" note="Rutas agrupadas: /carpeta/:id, /c/:id, /carta/:id y /:usuario agrupan muchas páginas distintas. Salida = sesiones que terminaron ahí.">
            <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar por ruta" aria-label="Filtrar por ruta" className="mb-3 h-10 w-full rounded-xl border border-[#c5d2ea] bg-white px-3 text-base font-semibold text-[#12315f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] sm:max-w-xs sm:text-sm" />
            <Table rowKey={(r) => r.path} empty="Aún no hay páginas medidas en este periodo." rows={rows} columns={[
              { key: 'path', label: 'Ruta' }, { key: 'views', label: 'Vistas', right: true, render: (r) => fmtNum(r.views) }, { key: 'visitors', label: 'Visitantes', right: true, render: (r) => fmtNum(r.visitors) },
              { key: 'entries', label: 'Entradas', right: true, render: (r) => fmtNum(r.entries) }, { key: 'exitRate', label: 'Salida', right: true, render: (r) => fmtPct(r.exitRate, 0) },
              { key: 'avgSec', label: 'Tiempo activo', right: true, render: (r) => fmtSec(r.avgSec) }, { key: 'avgScroll', label: 'Scroll medio', right: true, render: (r) => (r.avgScroll === null ? '—' : `${r.avgScroll} %`) }
            ]} />
          </Section>
        );
      }}
    </Loaded>
  );
}

const Rate = ({ cell }) => (cell ? <span title={`${cell.n} de la cohorte`}>{fmtPct(cell.rate, 0)}</span> : <span className="text-slate-400" title="Aún no pasa ese día">—</span>);

function Retention() {
  const state = useIntel('retention', { days: 30 });
  return (
    <Loaded state={state}>
      {(d) => (
        <Section title="Retención" note="Cohorte = personas vistas por primera vez ese día (solo desde que se mide). D1, D7 y D30 = volvieron exactamente ese día después. Solo se calcula cuando ese día ya pasó.">
          {d.cohorts.length === 0 ? <Note>{d.coverage.eventsSince ? 'Todavía no hay cohortes en los últimos 30 días.' : 'Se calcula con la medición de uso: aparecerá desde que se encienda.'}</Note> : (
            <>
              <div className="mb-4 grid grid-cols-3 gap-3">
                {['d1', 'd7', 'd30'].map((k) => <Stat key={k} label={k.toUpperCase()} value={d.overall[k] ? fmtPct(d.overall[k].rate, 0) : '—'} sub={d.overall[k] ? `${fmtNum(d.overall[k].size)} personas` : 'sin cohortes maduras'} />)}
              </div>
              <Table rowKey={(r) => r.cohort} rows={d.cohorts.slice().reverse()} columns={[
                { key: 'cohort', label: 'Cohorte', render: (r) => fmtDay(r.cohort) }, { key: 'size', label: 'Personas', right: true, render: (r) => fmtNum(r.size) },
                { key: 'd1', label: 'D1', right: true, render: (r) => <Rate cell={r.d1} /> }, { key: 'd7', label: 'D7', right: true, render: (r) => <Rate cell={r.d7} /> }, { key: 'd30', label: 'D30', right: true, render: (r) => <Rate cell={r.d30} /> }
              ]} />
            </>
          )}
        </Section>
      )}
    </Loaded>
  );
}

export default function AudienceView({ period }) {
  const state = useIntel('traffic', { from: period.range.from, to: period.range.to }, period.valid);
  const totalVisitors = useMemo(() => (state.data ? state.data.newVisitors + state.data.returningVisitors : 0), [state.data]);
  return (
    <>
      <Loaded state={state}>
        {(d) => (
          <>
            {d.series.length === 0 && <div className="mb-5"><Note>No hay visitas medidas en este periodo. La medición de uso se enciende desde «Resumen».</Note></div>}
            <Section title="Tráfico">
              <LineChart label="Visitas y visitantes por día" series={[{ name: 'Visitas', color: '#1e40af', points: d.series.map((p) => ({ x: p.day, y: p.visits })) }, { name: 'Visitantes', color: '#d4a600', points: d.series.map((p) => ({ x: p.day, y: p.visitors })) }]} />
              {totalVisitors > 0 && <div className="mt-4 grid grid-cols-2 gap-3"><Stat label="Visitantes nuevos" value={fmtNum(d.newVisitors)} sub={fmtPct(d.newVisitors / totalVisitors, 0)} /><Stat label="Visitantes que vuelven" value={fmtNum(d.returningVisitors)} sub={fmtPct(d.returningVisitors / totalVisitors, 0)} /></div>}
            </Section>
            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="De dónde llegan" note="Dominio de origen de la primera visita de cada sesión."><BarList rows={asRows(d.source)} empty="Sin sesiones en este periodo." /></Section>
              <Section title="Canal"><BarList rows={asRows(d.medium)} empty="Sin sesiones en este periodo." /></Section>
              <Section title="Dispositivo"><BarList rows={asRows(d.device)} empty="Sin sesiones en este periodo." /></Section>
              <Section title="Navegador"><BarList rows={asRows(d.browser)} empty="Sin sesiones en este periodo." /></Section>
              <Section title="Sistema operativo"><BarList rows={asRows(d.os)} empty="Sin sesiones en este periodo." /></Section>
              <Section title="Zona horaria" note="Aproximación del país según la zona horaria del navegador. No se usa la dirección IP."><BarList rows={asRows(d.country)} empty="Sin sesiones en este periodo." /></Section>
            </div>
          </>
        )}
      </Loaded>
      <Pages period={period} />
      <Retention />
    </>
  );
}
