import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { EmptyState, ErrorBox, Spinner, dateTime, relativeTime } from './shared';

const KIND = { server: { label: 'Servidor', tone: 'bg-red-100 text-red-800' }, http: { label: 'Respuesta 5xx', tone: 'bg-amber-100 text-amber-800' }, client: { label: 'Navegador', tone: 'bg-blue-100 text-[#1e40af]' } };
const PERIODS = [7, 30, 90];

const Funnel = ({ title, steps }) => {
  const base = Math.max(1, steps[0]?.count || 0);
  return (
    <section className="rounded-2xl border border-[#dbe3f0] bg-white p-5" aria-label={title}>
      <h3 className="text-base font-extrabold text-[#12315f]">{title}</h3>
      <ol className="mt-3 space-y-3">
        {steps.map((step, index) => {
          const percent = Math.round((step.count / base) * 100);
          return (
            <li key={step.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-700">{step.label}</span>
                <span className="shrink-0 font-black tabular-nums text-[#12315f]">{step.count}<span className="ml-1.5 text-xs font-bold text-slate-500">{index === 0 ? '' : `${percent}%`}</span></span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#eef2fa]"><div className="h-full rounded-full bg-[#1e40af] transition-[width] duration-300" style={{ width: `${Math.max(step.count ? 3 : 0, percent)}%` }} /></div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

const CRAWLERS = [['google', 'Google'], ['bing', 'Bing'], ['mensajería', 'WhatsApp y redes']];

const TopList = ({ title, hint, rows }) => (
  <section className="rounded-2xl border border-[#dbe3f0] bg-white p-5" aria-label={title}>
    <h3 className="text-base font-extrabold text-[#12315f]">{title}</h3>
    <p className="mt-0.5 text-sm text-slate-600">{hint}</p>
    {rows.length === 0 ? <p className="mt-3 text-sm font-semibold text-slate-500">Todavía no hay datos en este período.</p> : (
      <ol className="mt-3 space-y-1.5">
        {rows.map((row) => <li key={row.query} className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate font-semibold text-slate-700">{row.query}</span><span className="shrink-0 font-black tabular-nums text-[#12315f]">{row.count}</span></li>)}
      </ol>
    )}
  </section>
);

// Interés y búsquedas: lo que la gente busca y no encuentra, cuánto interés hay en los planes y si Google ya recorre el catálogo (contadores sin datos de personas)
function InterestSection({ days }) {
  const [metrics, setMetrics] = useState(null);
  const [failed, setFailed] = useState('');
  useEffect(() => { setMetrics(null); setFailed(''); api.getOpsMetrics(days).then(setMetrics).catch((err) => setFailed(err.message || 'No se pudo cargar el interés.')); }, [days]);
  if (failed) return <ErrorBox>{failed}</ErrorBox>;
  if (!metrics) return <Spinner label="Cargando interés y búsquedas" />;
  const tiles = [
    ['Cartas compartidas', metrics.shares.card], ['Carpetas compartidas', metrics.shares.folder], ['Visitas a fichas del catálogo', metrics.catalog.views],
    ...CRAWLERS.map(([key, label]) => [`Visitas de ${label} al catálogo`, metrics.catalog.crawls[key] || 0]),
  ];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Funnel title="Interés en los planes" steps={metrics.plans} />
        <dl className="grid grid-cols-2 gap-3 content-start">
          {tiles.map(([label, value]) => <div key={label} className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-0.5 text-2xl font-black tabular-nums text-[#12315f]">{value}</dd></div>)}
        </dl>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <TopList title="Se buscó y nadie la vende" hint={`${metrics.searchNoOffers.total} búsquedas sin ofertas. Son cartas que los compradores quieren: buenas para pedir inventario.`} rows={metrics.searchNoOffers.top} />
        <TopList title="Se buscó y no está en el catálogo" hint={`${metrics.searchEmpty.total} búsquedas sin resultados. Puede ser una carta que falta o un nombre mal escrito.`} rows={metrics.searchEmpty.top} />
      </div>
    </div>
  );
}

// Operación: ¿el sitio está sano?, ¿qué errores hay?, ¿por dónde se van las personas?
export default function OperationsPanel() {
  const [days, setDays] = useState(30);
  const [funnel, setFunnel] = useState(null);
  const [errors, setErrors] = useState(null);
  const [health, setHealth] = useState(null);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState('');

  const loadErrors = useCallback(() => api.getOpsErrors().then(setErrors).catch((err) => setMessage(err.message || 'No se pudieron cargar los errores.')), []);
  useEffect(() => { loadErrors(); api.getHealth().then(setHealth).catch(() => setHealth({ status: 'down' })); }, [loadErrors]);
  useEffect(() => { setFunnel(null); api.getOpsFunnel(days).then(setFunnel).catch((err) => setMessage(err.message || 'No se pudo cargar el embudo.')); }, [days]);

  const resolve = async (id) => {
    try { await api.resolveOpsError(id); setErrors((previous) => ({ ...previous, errors: previous.errors.filter((row) => row.id !== id) })); } catch (err) { setMessage(err.message || 'No se pudo resolver.'); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <ErrorBox>{message}</ErrorBox>

      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#dbe3f0] bg-white p-5" aria-label="Estado del servicio">
        <span aria-hidden="true" className={`h-3 w-3 rounded-full ${health?.status === 'ok' ? 'bg-emerald-500' : health ? 'bg-red-500' : 'bg-slate-300'}`} />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-extrabold text-[#12315f]">{health?.status === 'ok' ? 'El servicio responde con normalidad' : health ? 'El servicio tiene problemas' : 'Comprobando el servicio…'}</h3>
          <p className="text-sm text-slate-600">{health?.status === 'ok' ? `Base de datos conectada${Number.isFinite(health.uptime) ? ` · encendido hace ${health.uptime < 3600 ? `${Math.max(1, Math.round(health.uptime / 60))} min` : `${Math.round(health.uptime / 3600)} h`}` : ''}` : health ? 'La base de datos no contesta o el servidor no responde.' : ''}</p>
        </div>
        <div className="text-right text-sm"><p className="font-black tabular-nums text-[#12315f]">{errors ? errors.last24h : '—'}</p><p className="text-xs font-semibold text-slate-500">errores distintos en 24 h</p></div>
      </section>

      <section aria-label="Embudo">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-lg font-extrabold text-[#12315f]">Embudo de actividad</h3>
          <div role="group" aria-label="Período" className="flex gap-1">
            {PERIODS.map((value) => <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)} className={`h-9 rounded-full px-3.5 text-xs font-extrabold transition-colors duration-150 ${days === value ? 'bg-[#12315f] text-white' : 'bg-white text-[#12315f] ring-1 ring-[#dbe3f0]'}`}>{value} días</button>)}
          </div>
        </div>
        {!funnel ? <Spinner label="Cargando embudo" /> : (
          <>
            <p className="mb-3 text-sm text-slate-600">De las personas que se registraron en los últimos {funnel.days} días, cuántas llegan a cada paso.</p>
            <div className="grid gap-3 md:grid-cols-2">
              <Funnel title="Vendedores" steps={funnel.sellers} />
              <Funnel title="Compradores" steps={funnel.buyers} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[['Cuentas', funnel.totals.users], ['Cartas a la venta', funnel.totals.cardsOnSale], [`Pedidos (${funnel.days} d)`, funnel.totals.ordersCreated], [`Ventas (${funnel.days} d)`, funnel.totals.ordersCompleted]].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-0.5 text-2xl font-black tabular-nums text-[#12315f]">{value}</dd></div>
              ))}
            </dl>
          </>
        )}
      </section>

      <section aria-label="Interés y búsquedas">
        <h3 className="mb-2 text-lg font-extrabold text-[#12315f]">Interés y búsquedas</h3>
        <p className="mb-3 text-sm text-slate-600">Últimos {days} días. Son contadores anónimos: no se guarda quién buscó ni quién compartió.</p>
        <InterestSection days={days} />
      </section>

      <section aria-label="Errores">
        <h3 className="mb-2 text-lg font-extrabold text-[#12315f]">Errores recientes</h3>
        {!errors ? <Spinner label="Cargando errores" /> : errors.errors.length === 0 ? (
          <EmptyState icon="check_circle" title="Sin errores registrados">Cuando algo falle en el servidor o en la web, aparecerá aquí agrupado, y te llegará un correo.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {errors.errors.map((row) => {
              const kind = KIND[row.kind] || KIND.server;
              return (
                <li key={row.id} className="rounded-xl border border-[#dbe3f0] bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${kind.tone}`}>{kind.label}</span><span className="text-xs font-semibold text-slate-500">{row.count} {row.count === 1 ? 'vez' : 'veces'} · último {relativeTime(row.lastSeen)}</span></div>
                      <p className="mt-1.5 break-words text-sm font-bold text-[#12315f]">{row.message}</p>
                      {row.route && <p className="mt-0.5 break-all font-mono text-xs text-slate-500">{row.route}</p>}
                      {open === row.id && row.stack && <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">{row.stack.replace(/\|/g, '\n')}{'\n'}Primera vez: {dateTime(row.firstSeen)}</pre>}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      {row.stack && <button type="button" onClick={() => setOpen(open === row.id ? '' : row.id)} className="h-9 rounded-full px-3 text-xs font-bold text-[#1e40af] ring-1 ring-[#dbe3f0] transition-colors hover:bg-[#f3f7ff]">{open === row.id ? 'Ocultar' : 'Detalle'}</button>}
                      <button type="button" onClick={() => resolve(row.id)} className="h-9 rounded-full bg-[#12315f] px-3 text-xs font-extrabold text-white transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-[#1e40af]">Resolver</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
