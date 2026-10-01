import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { ErrorBox, Spinner } from './shared';

const SEVERITY_LABELS = { S1: 'Crítica', S2: 'Alta', S3: 'Media', S4: 'Baja' };
const VERDICT_LABELS = { clear: 'Limpias', review: 'A revisión', block: 'Bloqueadas', unavailable: 'Sin servicio' };
const PROVIDER_LABELS = { sightengine: 'Sightengine', google: 'Google Vision' };
const SANCTION_LABELS = { warning: 'Advertencias', restrict_messages: 'Mensajes restringidos', suspend_selling: 'Ventas suspendidas', suspend: 'Cuentas suspendidas', ban: 'Cuentas cerradas' };

const Card = ({ title, value, hint, tone = 'text-[#12315f]' }) => (
  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
    <p className="text-sm font-bold text-slate-500">{title}</p>
    <p className={`mt-1 text-3xl font-black tabular-nums ${tone}`}>{value}</p>
    {hint && <p className="mt-0.5 text-xs font-semibold text-slate-500">{hint}</p>}
  </div>
);

const hoursLabel = (hours) => (hours === null || hours === undefined ? '—' : hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} días`);

// Salud del sistema de moderación: ¿se revisa a tiempo?, ¿cuántos reportes son falsos?, ¿qué se acumula?
export default function MetricsPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.getModerationMetrics().then(setData).catch((err) => setError(err.message || 'No se pudieron cargar las métricas.')); }, []);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Spinner label="Cargando métricas" />;
  const last = data.last30Days;
  const maxDay = Math.max(1, ...last.perDay.map((day) => day.count));
  const overdueTotal = Object.values(data.queue.overdue).reduce((sum, value) => sum + value, 0);

  return (
    <div className="space-y-5">
      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card title="Reportes pendientes" value={data.queue.open} hint={data.queue.oldestOpenHours ? `El más antiguo: ${hoursLabel(data.queue.oldestOpenHours)}` : 'Cola al día'} />
        <Card title="Fuera de plazo" value={overdueTotal} tone={overdueTotal ? 'text-red-600' : 'text-emerald-600'} hint="Sin revisar pasado su plazo" />
        <Card title="Tiempo a decisión" value={hoursLabel(last.hoursToDecision.median)} hint={`Promedio ${hoursLabel(last.hoursToDecision.average)} · 30 días`} />
        <Card title="Reportes descartados" value={last.dismissedRate === null ? '—' : `${last.dismissedRate}%`} hint="Sobre los ya decididos (30 días)" />
      </section>

      <section aria-label="Reportes por día" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
        <h3 className="text-sm font-extrabold text-[#12315f]">Reportes por día (últimos 30 días): {last.total}{last.automatic ? ` · ${last.automatic} detectados automáticamente` : ''}</h3>
        <div className="mt-3 flex h-28 items-end gap-0.5" role="img" aria-label={`Gráfico de reportes por día, máximo ${maxDay}`}>
          {last.perDay.map((day) => <div key={day.date} title={`${day.date}: ${day.count}`} className="min-w-0 flex-1 rounded-t bg-[#1e40af]" style={{ height: `${Math.max(day.count ? 6 : 1, (day.count / maxDay) * 100)}%`, opacity: day.count ? 1 : 0.25 }} />)}
        </div>
        <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-400"><span>{last.perDay[0].date}</span><span>{last.perDay[last.perDay.length - 1].date}</span></div>
      </section>

      <section aria-label="Escaneo de imágenes" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
        <h3 className="text-sm font-extrabold text-[#12315f]">Escaneo de imágenes {data.scans.enabled ? '' : '(apagado: faltan las claves de los servicios)'}</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            {data.scans.providers.map((item) => {
              const percent = Math.min(100, Math.round((item.used / item.limit) * 100));
              return (
                <div key={item.provider}>
                  <div className="flex justify-between text-sm"><span className="font-bold">{PROVIDER_LABELS[item.provider] || item.provider}{item.configured ? '' : ' (sin configurar)'}</span><span className="tabular-nums text-slate-600">{item.used} / {item.limit} este mes</span></div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`Uso mensual de ${item.provider}: ${percent} %`}><div className={`h-full rounded-full ${percent >= 80 ? 'bg-red-500' : 'bg-[#1e40af]'}`} style={{ width: `${percent}%` }} /></div>
                  {percent >= 80 && <p className="mt-0.5 text-xs font-bold text-red-600">Cuota casi agotada: al {Math.round((item.stopAt / item.limit) * 100)} % se deja de usar este servicio.</p>}
                </div>
              );
            })}
          </div>
          <ul className="space-y-1 text-sm">
            <li>Escaneos en 30 días: <b>{data.scans.last30d.total}</b> (aciertos de caché: <b>{data.scans.last30d.cacheHits}</b>)</li>
            <li>Cayeron a un servicio de respaldo: <b>{data.scans.last30d.fallbacks}</b></li>
            <li className={data.scans.last30d.unavailable ? 'font-bold text-red-600' : ''}>Sin ningún servicio disponible: <b>{data.scans.last30d.unavailable}</b></li>
            <li>Latencia: mediana <b>{data.scans.last30d.latencyMs.p50 ?? '—'} ms</b> · p95 <b>{data.scans.last30d.latencyMs.p95 ?? '—'} ms</b></li>
            <li>{Object.entries(data.scans.last30d.byVerdict).map(([key, count]) => `${VERDICT_LABELS[key] || key}: ${count}`).join(' · ') || 'Sin escaneos todavía.'}</li>
          </ul>
        </div>
        {data.scans.last30d.recentIssues?.length > 0 && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
            <h4 className="text-sm font-bold text-amber-900">Últimos problemas con los servicios</h4>
            <ul className="mt-1 space-y-0.5 text-xs text-amber-950">
              {data.scans.last30d.recentIssues.map((issue, index) => <li key={index}><span className="font-bold">{new Date(issue.createdAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</span> · {issue.kind === 'card' ? 'carta' : 'perfil'} · {issue.verdict === 'unavailable' ? 'sin servicio' : `respondió ${issue.provider}`} · <code>{issue.detail}</code></li>)}
            </ul>
            <p className="mt-1 text-[11px] text-amber-900">Causas: <b>timeout</b> (tardó demasiado), <b>auth</b> (clave rechazada o facturación), <b>quota</b> (cuota agotada), <b>cuota</b> (se saltó por llegar al 95 %), <b>circuito</b> (en pausa tras fallos), <b>transient</b> (error del servicio), <b>sin_proveedores</b> (faltan las variables).</p>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Cola por gravedad" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
          <h3 className="text-sm font-extrabold text-[#12315f]">Cola por gravedad (plazo de primera revisión)</h3>
          <table className="mt-2 w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Gravedad</th><th>Plazo</th><th>Pendientes</th><th>Fuera de plazo</th></tr></thead>
            <tbody>{['S1', 'S2', 'S3', 'S4'].map((key) => (
              <tr key={key} className="border-t border-slate-100"><td className="py-1.5 font-bold">{key} · {SEVERITY_LABELS[key]}</td><td>{hoursLabel(data.queue.slaHours[key])}</td><td className="tabular-nums">{data.queue.backlog[key]}</td><td className={`tabular-nums font-bold ${data.queue.overdue[key] ? 'text-red-600' : ''}`}>{data.queue.overdue[key]}</td></tr>
            ))}</tbody>
          </table>
        </section>
        <section aria-label="Casos y apelaciones" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
          <h3 className="text-sm font-extrabold text-[#12315f]">Casos de estafa y apelaciones</h3>
          <ul className="mt-2 space-y-1 text-sm">
            <li>Casos abiertos: <b>{data.cases.open}</b> ({data.cases.highPriority} de prioridad alta)</li>
            <li>Esperando descargo: <b>{data.cases.awaitingResponse}</b></li>
            <li className={data.cases.responseOverdue ? 'font-bold text-red-600' : ''}>Descargos vencidos sin respuesta: <b>{data.cases.responseOverdue}</b></li>
            <li>Apelaciones abiertas: <b>{data.appeals.open}</b>{data.appeals.open ? ` (la más antigua: ${hoursLabel(data.appeals.oldestOpenHours)})` : ''}</li>
          </ul>
          <h4 className="mt-3 text-sm font-bold text-slate-500">Medidas vigentes</h4>
          {Object.keys(data.sanctionsActive).length === 0 ? <p className="text-sm text-slate-500">Ninguna.</p> : <ul className="text-sm">{Object.entries(data.sanctionsActive).map(([type, count]) => <li key={type}>{SANCTION_LABELS[type] || type}: <b>{count}</b></li>)}</ul>}
        </section>
        <section aria-label="Tipos y motivos" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
          <h3 className="text-sm font-extrabold text-[#12315f]">Qué se reporta (30 días)</h3>
          <ul className="mt-2 space-y-1 text-sm">{last.byType.length === 0 ? <li className="text-slate-500">Sin reportes.</li> : last.byType.map((item) => <li key={item.type} className="flex justify-between"><span>{item.label}</span><b className="tabular-nums">{item.count}</b></li>)}</ul>
          <h4 className="mt-3 text-sm font-bold text-slate-500">Motivos más frecuentes</h4>
          <ul className="space-y-1 text-sm">{last.topReasons.map((item) => <li key={item.code} className="flex justify-between gap-3"><span className="min-w-0">{item.label}</span><b className="tabular-nums">{item.count}</b></li>)}</ul>
        </section>
        <section aria-label="Detección automática" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
          <h3 className="text-sm font-extrabold text-[#12315f]">Detección automática y reputación</h3>
          <ul className="mt-2 space-y-1 text-sm">
            <li>Reportes automáticos (filtros de texto): <b>{last.automatic}</b></li>
            <li>Reportes de personas con baja reputación: <b>{last.lowWeightReports}</b></li>
            <li>Imágenes con huella prohibida: <b>{data.images.bannedHashes}</b></li>
            <li>Subidas rechazadas por parecerse a una prohibida (30 días): <b>{data.images.uploadsBlocked30d}</b></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
