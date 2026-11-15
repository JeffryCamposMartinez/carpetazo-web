import { Loaded, LineChart, Note, Section, Stat, Table, fmtClp, fmtDayLong, fmtNum, fmtPct, useIntel } from './intelUi';

const STATUS = { approved: 'Aprobado', rejected: 'Rechazado', refunded: 'Reembolsado', charged_back: 'Contracargo', pending: 'Pendiente', cancelled: 'Cancelado', unverified: 'Sin verificar' };
const PLAN = { free: 'Común', enthusiast: 'Entusiasta', premium: 'Premium', pro: 'Pro', store: 'Tienda' };
const planName = (k) => PLAN[k] || k;

export function BusinessView({ period }) {
  const state = useIntel('revenue', { from: period.range.from, to: period.range.to }, period.valid);
  return (
    <Loaded state={state}>
      {(d) => (
        <>
          {!d.confirmed && <div className="mb-5"><Note>El libro de pagos aún no tiene registros: los ingresos aparecerán con el primer pago que informe Mercado Pago. No se estima ni se rellena nada.</Note></div>}
          {d.confirmed && (
            <Section title="Ingresos confirmados" note={`Solo pagos aprobados por Mercado Pago, menos reembolsos. Libro de pagos desde el ${fmtDayLong(d.coverage.ledgerSince)}.`}>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3"><Stat label="Ingresos" value={fmtClp(d.confirmed.revenue)} /><Stat label="Pagos aprobados" value={fmtNum(d.confirmed.payments)} /><Stat label="Ticket promedio" value={fmtClp(d.confirmed.avgTicket)} /></div>
              <LineChart label="Ingresos por día" format={fmtClp} series={[{ name: 'Ingresos', color: '#1e40af', points: d.daily.map((p) => ({ x: p.day, y: p.revenue })) }]} />
            </Section>
          )}
          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Ingresos por plan" note="El plan sale de la suscripción vinculada al pago.">
              <Table rowKey={(r) => r.plan} empty="Sin pagos aprobados en este periodo." rows={d.byPlan} columns={[{ key: 'plan', label: 'Plan', render: (r) => planName(r.plan) }, { key: 'payments', label: 'Pagos', right: true, render: (r) => fmtNum(r.payments) }, { key: 'revenue', label: 'Ingresos', right: true, render: (r) => fmtClp(r.revenue) }]} />
            </Section>
            <Section title="Estado de los pagos registrados" note="Todo pago informado por Mercado Pago, sume o no ingresos.">
              <Table rowKey={(r) => r.status} empty="Sin pagos registrados en este periodo." rows={d.statuses} columns={[{ key: 'status', label: 'Estado', render: (r) => STATUS[r.status] || r.status }, { key: 'count', label: 'Pagos', right: true, render: (r) => fmtNum(r.count) }, { key: 'amount', label: 'Monto', right: true, render: (r) => fmtClp(r.amount) }]} />
            </Section>
          </div>
          <Section title="Suscripciones" note="Altas y bajas por fecha de la suscripción. El estimado mensual suma los precios de las suscripciones activas: no es dinero cobrado.">
            {!d.subscribers ? <Note>La primera foto diaria de suscriptores se toma en el próximo trabajo nocturno.</Note> : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Suscriptores activos" value={fmtNum(d.subscribers.total)} sub={`al ${fmtDayLong(d.subscribers.asOf)}`} />
                <Stat label="Ingreso mensual estimado" value={fmtClp(d.mrrEstimated?.value)} sub="estimado, no cobrado" />
                <Stat label="Altas en el periodo" value={fmtNum(d.subscriptionsNew)} />
                <Stat label="Bajas en el periodo" value={fmtNum(d.subscriptionsCanceled)} sub={d.subscribers.total + d.subscriptionsCanceled > 0 ? `${fmtPct(d.subscriptionsCanceled / (d.subscribers.total + d.subscriptionsCanceled), 1)} de abandono aprox.` : undefined} />
              </div>
            )}
            {d.subscribers && <div className="mt-4"><Table rowKey={(r) => r.plan} empty="" rows={d.subscribers.byPlan} columns={[{ key: 'plan', label: 'Plan', render: (r) => planName(r.plan) }, { key: 'count', label: 'Suscriptores', right: true, render: (r) => fmtNum(r.count) }]} /></div>}
          </Section>
        </>
      )}
    </Loaded>
  );
}

export function FunnelsView({ period }) {
  const state = useIntel('funnels', { from: period.range.from, to: period.range.to }, period.valid);
  return (
    <Loaded state={state}>
      {(d) => (
        <>
          <div className="mb-5"><Note>Cada paso cuenta personas que lo hicieron después del paso anterior. Una persona se identifica por su cuenta; si no inició sesión, por su navegador. Las acciones del servidor (cuenta creada, pedido, suscripción) se unen al navegador solo si esa persona inició sesión en él.{d.coverage.eventsSince ? '' : ' Aparecerán desde que se encienda la medición.'}</Note></div>
          <div className="grid gap-5 lg:grid-cols-2">
            {d.funnels.map((f) => {
              const top = f.steps[0].count;
              return (
                <Section key={f.key} title={f.label}>
                  {top === 0 ? <p className="py-4 text-center text-sm font-semibold text-slate-500">Sin personas en el primer paso en este periodo.</p> : (
                    <ol className="space-y-3">
                      {f.steps.map((s, i) => (
                        <li key={s.name} className="text-sm">
                          <div className="flex items-baseline justify-between gap-3 font-semibold text-[#12315f]"><span>{s.label}</span><span className="tabular-nums">{fmtNum(s.count)}{i > 0 && <span className="ml-2 text-xs font-medium text-slate-500">{fmtPct(s.fromPrevious, 0)} del paso anterior</span>}</span></div>
                          <div className="mt-1 h-3 rounded bg-[#e6ecf7]"><div className="h-3 rounded bg-[#1e40af]" style={{ width: `${Math.max(2, (s.count / top) * 100)}%` }} /></div>
                        </li>
                      ))}
                    </ol>
                  )}
                  {top > 0 && <p className="mt-3 text-xs font-semibold text-slate-500">Conversión total: {fmtPct(f.steps[f.steps.length - 1].fromStart, 1)}</p>}
                </Section>
              );
            })}
          </div>
        </>
      )}
    </Loaded>
  );
}
