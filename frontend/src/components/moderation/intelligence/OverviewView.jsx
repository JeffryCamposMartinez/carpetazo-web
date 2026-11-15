import { useState } from 'react';
import { api } from '../../../services/api';
import Switch from '../../ui/Switch';
import { ErrorBox } from '../shared';
import { Change, Loaded, LineChart, Note, Section, Sparkline, fmtClp, fmtDayLong, fmtNum, fmtSec, useIntel } from './intelUi';

// Qué panel profundiza cada cifra
const DETAIL = { visits: 'audience', visitors: 'audience', sessions: 'audience', users_active: 'audience', avg_session: 'audience', bounce: 'audience', searches: 'product', scans: 'product', users_new: 'product', folders_new_surviving: 'product', cards_added_surviving: 'product', orders_new: 'funnels', subscriptions_new: 'business', revenue: 'business' };
const SPARK = { visits: 'visits', visitors: 'visitors', sessions: 'sessions' };

const show = (kpi) => {
  if (kpi.value === null) return '—';
  if (kpi.unit === 'clp') return fmtClp(kpi.value);
  if (kpi.unit === 's') return fmtSec(kpi.value);
  if (kpi.unit === 'pct') return `${String(kpi.value).replace('.', ',')} %`;
  return fmtNum(kpi.value);
};

function Collection({ coverage, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggle = async (enabled) => {
    setBusy(true); setError('');
    try { await api.put('/admin/intelligence/settings', { enabled }); onChange(); } catch (e) { setError(e.message || 'No se pudo cambiar'); } finally { setBusy(false); }
  };
  return (
    <Section title="Medición de uso" note="Recolección propia, sin cookies ni servicios externos. Encenderla registra visitas y acciones de quienes no la hayan desactivado.">
      <ErrorBox>{error}</ErrorBox>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 text-sm font-semibold text-[#12315f]">
          {coverage.enabled ? 'Encendida' : 'Apagada'}
          <p className="mt-0.5 text-xs font-medium text-slate-500">{coverage.eventsSince ? `Medido desde el ${fmtDayLong(coverage.eventsSince)}. Eventos individuales: ${coverage.retentionDays} días.` : 'Todavía no hay datos de uso: se miden desde que se enciende.'}</p>
        </div>
        <Switch checked={coverage.enabled} onChange={toggle} label="Medición de uso" disabled={busy} />
      </div>
      {!coverage.enabled && <p className="mt-3 text-xs font-semibold text-amber-800">Antes de encenderla, publica la sección de analítica de la Política de Privacidad (borrador en docs/carpetazo-intelligence/04-borrador-privacidad.md).</p>}
    </Section>
  );
}

export default function OverviewView({ period, go }) {
  const [tick, setTick] = useState(0);
  const state = useIntel('overview', { from: period.range.from, to: period.range.to, r: tick }, period.valid);
  return (
    <Loaded state={state} skeletonRows={6}>
      {(d) => {
        const spark = (key) => (SPARK[key] ? d.series.map((p) => p[SPARK[key]]) : null);
        return (
          <>
            <Collection coverage={d.coverage} onChange={() => setTick((n) => n + 1)} />
            {d.coverage.eventsSince === null && <div className="mb-5"><Note>Las cifras de visitas, sesiones, búsquedas y escaneos aparecerán cuando se encienda la medición. Las de usuarios, carpetas, cartas y pedidos salen de las fechas de los registros existentes y ya están disponibles; los ingresos salen del libro de pagos de Mercado Pago.</Note></div>}
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {d.kpis.map((k) => (
                <button key={k.key} type="button" onClick={() => go(DETAIL[k.key])} className="rounded-2xl border border-[#dbe3f0] bg-white p-4 text-left transition-[border-color,transform] duration-150 ease-out active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] [@media(hover:hover)]:hover:border-[#1e40af]">
                  <span className="text-sm font-bold text-slate-600">{k.label}</span>
                  <span className="mt-1 block text-3xl font-extrabold tabular-nums text-[#12315f]">{show(k)}</span>
                  <span className="mt-1 block"><Change value={k.change} invert={k.key === 'bounce'} /></span>
                  <span className="mt-0.5 block text-xs font-medium text-slate-500">{k.prev === null ? 'Periodo anterior: sin datos' : `Periodo anterior: ${show({ ...k, value: k.prev })}`}</span>
                  {spark(k.key) && <span className="mt-2 block"><Sparkline values={spark(k.key)} /></span>}
                  <span className="mt-2 block text-[11px] font-semibold text-slate-500">{k.partial ? `Parcial: medido desde el ${fmtDayLong(k.source.startsWith('eventos') ? d.coverage.eventsSince : d.coverage.ledgerSince)}` : `Fuente: ${k.source}`}</span>
                </button>
              ))}
            </div>
            <Section title="Visitas, visitantes y sesiones por día" note="Visita = página vista. Visitante único = navegador distinto. Sesión = visita continua con menos de 30 minutos de pausa.">
              <LineChart label="Visitas, visitantes y sesiones por día" series={[
                { name: 'Visitas', color: '#1e40af', points: d.series.map((p) => ({ x: p.day, y: p.visits })) },
                { name: 'Visitantes', color: '#d4a600', points: d.series.map((p) => ({ x: p.day, y: p.visitors })) },
                { name: 'Sesiones', color: '#94a3b8', points: d.series.map((p) => ({ x: p.day, y: p.sessions })) }
              ]} />
            </Section>
          </>
        );
      }}
    </Loaded>
  );
}
