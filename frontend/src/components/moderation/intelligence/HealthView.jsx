import { Loaded, Note, Section, Stat, Table, fmtNum, fmtPct, useIntel } from './intelUi';

// Umbrales públicos de Web Vitals (bueno / necesita mejorar / malo), con el percentil 75
const VITALS = {
  LCP: { label: 'Carga principal (LCP)', good: 2500, poor: 4000, unit: 'ms' }, INP: { label: 'Respuesta al toque (INP)', good: 200, poor: 500, unit: 'ms' },
  CLS: { label: 'Saltos de diseño (CLS)', good: 0.1, poor: 0.25, unit: '' }, TTFB: { label: 'Respuesta del servidor (TTFB)', good: 800, poor: 1800, unit: 'ms' }, FCP: { label: 'Primer contenido (FCP)', good: 1800, poor: 3000, unit: 'ms' }
};
const rate = (name, p75) => { const v = VITALS[name]; if (!v) return ['', '']; return p75 <= v.good ? ['Bueno', 'text-emerald-700'] : p75 <= v.poor ? ['Mejorable', 'text-amber-800'] : ['Malo', 'text-red-700']; };

export default function HealthView({ period }) {
  const state = useIntel('health', { from: period.range.from, to: period.range.to }, period.valid);
  return (
    <Loaded state={state}>
      {(d) => (
        <>
          <Section title="Experiencia de carga (Core Web Vitals)" note="Medida en los navegadores reales, con el percentil 75: tres de cada cuatro visitas son mejores que este valor.">
            {d.vitals.length === 0 ? <Note>Sin mediciones en este periodo. Aparecen desde que se enciende la medición de uso.</Note> : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {d.vitals.filter((v) => VITALS[v.name]).map((v) => { const [text, tone] = rate(v.name, v.p75); const meta = VITALS[v.name]; return <Stat key={v.name} label={meta.label} value={<>{fmtNum(v.p75)}<span className="ml-1 text-sm font-bold text-slate-500">{meta.unit}</span></>} sub={<><span className={`font-bold ${tone}`}>{text}</span> · {fmtPct(v.goodRate, 0)} buenas · {fmtNum(v.samples)} muestras</>} />; })}
              </div>
            )}
          </Section>
          <Section title="Errores de JavaScript" note={d.sessionsWithErrors.of ? `${fmtNum(d.sessionsWithErrors.n)} de ${fmtNum(d.sessionsWithErrors.of)} sesiones tuvieron al menos un error (${fmtPct(d.sessionsWithErrors.n / d.sessionsWithErrors.of, 1)}).` : undefined}>
            <Table rowKey={(r) => r.message + r.path} empty="Sin errores medidos en este periodo." rows={d.jsErrors} columns={[{ key: 'message', label: 'Mensaje' }, { key: 'path', label: 'Ruta' }, { key: 'count', label: 'Veces', right: true, render: (r) => fmtNum(r.count) }, { key: 'sessions', label: 'Sesiones', right: true, render: (r) => fmtNum(r.sessions) }]} />
          </Section>
          <Section title="Rendimiento de la API" note="Por ruta, ordenadas por volumen. Lentas = más de 1 segundo. El promedio se calcula con todas las peticiones; el máximo es el peor caso del periodo.">
            <Table rowKey={(r) => r.route} empty="Sin datos de la API en este periodo (se consolidan cada minuto)." rows={d.api} columns={[
              { key: 'route', label: 'Ruta' }, { key: 'requests', label: 'Peticiones', right: true, render: (r) => fmtNum(r.requests) }, { key: 'avgMs', label: 'Prom. (ms)', right: true, render: (r) => fmtNum(r.avgMs) },
              { key: 'maxMs', label: 'Máx. (ms)', right: true, render: (r) => fmtNum(r.maxMs) }, { key: 'slow', label: 'Lentas', right: true, render: (r) => fmtNum(r.slow) }, { key: 'errors4xx', label: '4xx', right: true, render: (r) => fmtNum(r.errors4xx) }, { key: 'errors5xx', label: '5xx', right: true, render: (r) => fmtNum(r.errors5xx) }
            ]} />
          </Section>
        </>
      )}
    </Loaded>
  );
}
