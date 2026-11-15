import { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { ListSkeleton, ErrorBox, Pills } from '../shared';

// Piezas compartidas de Carpetazo Intelligence: formatos, selector de periodo, carga de datos y gráficos SVG propios (sin librerías).
// Estilo plano: azul Carpetazo para la serie principal, gris azulado para lo secundario, sin degradados ni sombras decorativas.

const nf = new Intl.NumberFormat('es-CL');
export const fmtNum = (v) => (v === null || v === undefined ? '—' : nf.format(Math.round(v * 10) / 10));
export const fmtClp = (v) => (v === null || v === undefined ? '—' : `$${nf.format(Math.round(v))}`);
export const fmtPct = (v, digits = 1) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits).replace('.', ',')} %`);
export const fmtSec = (v) => (v === null || v === undefined ? '—' : v >= 60 ? `${Math.floor(v / 60)} min ${Math.round(v % 60)} s` : `${Math.round(v)} s`);
export const fmtDay = (iso) => (iso ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)) : '');
export const fmtDayLong = (iso) => (iso ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)) : '');

// ---------- Periodo (días en hora de Chile) ----------
const todayCl = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
const shift = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const PRESETS = [['today', 'Hoy'], ['yesterday', 'Ayer'], ['7', '7 días'], ['30', '30 días'], ['90', '90 días'], ['365', '12 meses'], ['custom', 'Personalizado']];
export const rangeFor = (preset, custom) => {
  const today = todayCl();
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'yesterday') return { from: shift(today, -1), to: shift(today, -1) };
  if (preset === 'custom') return custom;
  const n = Number(preset);
  return { from: shift(today, -(n - 1)), to: today };
};

const KEY = 'cz:intel-range';
const loadRange = () => { try { const v = JSON.parse(sessionStorage.getItem(KEY)); if (v?.preset) return v; } catch (_e) { /* sin almacenamiento */ } return { preset: '30', custom: { from: shift(todayCl(), -29), to: todayCl() } }; };

export function usePeriod() {
  const [state, setState] = useState(loadRange);
  const update = (next) => { setState(next); try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch (_e) { /* sin almacenamiento */ } };
  const range = rangeFor(state.preset, state.custom);
  const valid = Boolean(range?.from && range?.to && range.from <= range.to);
  return { ...state, range, valid, setPreset: (preset) => update({ ...state, preset }), setCustom: (custom) => update({ ...state, custom }) };
}

const dateField = 'h-9 rounded-lg border border-[#c5d2ea] bg-white px-2 text-sm font-semibold text-[#12315f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]';
export function PeriodBar({ period, hint }) {
  return (
    <div className="mb-4">
      <Pills options={PRESETS} value={period.preset} onChange={period.setPreset} label="Periodo" />
      {period.preset === 'custom' && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
          <label className="flex items-center gap-2">Desde <input type="date" className={dateField} value={period.custom.from} max={period.custom.to} onChange={(e) => period.setCustom({ ...period.custom, from: e.target.value })} /></label>
          <label className="flex items-center gap-2">Hasta <input type="date" className={dateField} value={period.custom.to} min={period.custom.from} onChange={(e) => period.setCustom({ ...period.custom, to: e.target.value })} /></label>
        </div>
      )}
      <p className="text-xs font-semibold text-slate-500">{period.valid ? (period.range.from === period.range.to ? fmtDayLong(period.range.from) : `${fmtDayLong(period.range.from)} al ${fmtDayLong(period.range.to)}`) : 'Elige un periodo válido'} · hora de Chile{hint ? ` · ${hint}` : ''}</p>
    </div>
  );
}

// ---------- Carga ----------
export function useIntel(path, params, enabled = true) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const key = `${path}?${new URLSearchParams(params).toString()}`;
  useEffect(() => {
    if (!enabled) { setState({ data: null, error: '', loading: false }); return undefined; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    api.get(`/admin/intelligence/${key}`).then((res) => { if (!cancelled) setState({ data: res.data, error: '', loading: false }); })
      .catch((err) => { if (!cancelled) setState({ data: null, error: err.message || 'No se pudo cargar', loading: false }); });
    return () => { cancelled = true; };
  }, [key, enabled]);
  return state;
}

export function Loaded({ state, children, skeletonRows = 4 }) {
  if (state.loading && !state.data) return <ListSkeleton rows={skeletonRows} label="Calculando" />;
  if (state.error) return <ErrorBox>{state.error}</ErrorBox>;
  if (!state.data) return null;
  return <div className={state.loading ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={state.loading}>{children(state.data)}</div>;
}

// ---------- Estructura ----------
export const Section = ({ title, note, children, className = '' }) => (
  <section className={`mb-5 rounded-2xl border border-[#dbe3f0] bg-white p-4 sm:p-5 ${className}`}>
    <h3 className="text-base font-extrabold text-[#12315f]">{title}</h3>
    {note && <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500">{note}</p>}
    <div className="mt-3">{children}</div>
  </section>
);

export const Note = ({ children }) => <p className="rounded-xl bg-[#eef3fb] px-3.5 py-2.5 text-sm font-medium leading-relaxed text-slate-700">{children}</p>;
export const NoData = ({ children = 'Sin datos en este periodo.' }) => <p className="py-6 text-center text-sm font-semibold text-slate-500">{children}</p>;

export const Table = ({ columns, rows, empty, rowKey }) => (rows.length === 0 ? <NoData>{empty}</NoData> : (
  <div className="-mx-1 overflow-x-auto">
    <table className="w-full min-w-[28rem] text-left text-sm">
      <thead><tr className="border-b border-[#dbe3f0] text-xs font-bold text-slate-500">{columns.map((c) => <th key={c.key} scope="col" className={`px-1 py-2 ${c.right ? 'text-right' : ''}`}>{c.label}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => (
        <tr key={rowKey ? rowKey(row) : i} className="border-b border-[#eef2f9] last:border-0">
          {columns.map((c) => <td key={c.key} className={`px-1 py-2 font-semibold text-[#12315f] ${c.right ? 'text-right tabular-nums' : 'max-w-[18rem] truncate'}`} title={c.right ? undefined : String(row[c.key] ?? '')}>{c.render ? c.render(row) : row[c.key]}</td>)}
        </tr>
      ))}</tbody>
    </table>
  </div>
));

// Variación contra el periodo anterior: signo y texto, nunca solo color
export function Change({ value, invert = false }) {
  if (value === null || value === undefined) return <span className="text-xs font-semibold text-slate-500">sin periodo anterior comparable</span>;
  const up = value > 0; const flat = value === 0;
  const good = flat ? null : invert ? !up : up;
  return <span className={`text-xs font-bold tabular-nums ${good === null ? 'text-slate-500' : good ? 'text-emerald-700' : 'text-red-700'}`}>{flat ? '0 %' : `${up ? '+' : '−'}${Math.abs(value).toFixed(1).replace('.', ',')} %`} vs. periodo anterior</span>;
}

// ---------- Gráficos ----------
const W = 640; const H = 190; const PAD = { l: 44, r: 10, t: 10, b: 24 };

export function LineChart({ series, height = H, format = fmtNum, label }) {
  // series: [{ name, color, points: [{ x: 'YYYY-MM-DD', y: number }] }]
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return <NoData />;
  const xs = [...new Set(all.map((p) => p.x))].sort();
  const max = Math.max(1, ...all.map((p) => p.y));
  const sx = (x) => PAD.l + (xs.length === 1 ? (W - PAD.l - PAD.r) / 2 : (xs.indexOf(x) / (xs.length - 1)) * (W - PAD.l - PAD.r));
  const sy = (y) => PAD.t + (1 - y / max) * (height - PAD.t - PAD.b);
  const ticks = [0, 0.5, 1].map((t) => t * max);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} className="w-full">
        {ticks.map((t) => (<g key={t}><line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="#e6ecf7" /><text x={PAD.l - 6} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="#64748b">{format(t)}</text></g>))}
        {[xs[0], xs[xs.length - 1]].map((x, i) => <text key={`${x}-${i}`} x={sx(x)} y={height - 6} textAnchor={xs.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'} fontSize="11" fill="#64748b">{fmtDay(x)}</text>)}
        {series.map((s) => {
          const pts = s.points.slice().sort((a, b) => (a.x < b.x ? -1 : 1));
          return (
            <g key={s.name}>
              <polyline fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" points={pts.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} />
              {pts.length <= 45 && pts.map((p) => <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r="2.5" fill={s.color}><title>{`${s.name} · ${fmtDay(p.x)}: ${format(p.y)}`}</title></circle>)}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-600">{series.map((s) => <span key={s.name} className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-0.5 w-4" style={{ background: s.color }} />{s.name}</span>)}</figcaption>}
    </figure>
  );
}

export function Sparkline({ values, color = '#1e40af' }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(1, ...values); const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${22 - ((v - min) / span) * 20}`).join(' ');
  return <svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true" className="h-6 w-full"><polyline fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" points={pts} /></svg>;
}

// Barras horizontales con el valor al lado (rankings)
export function BarList({ rows, format = fmtNum, empty }) {
  if (!rows.length) return <NoData>{empty}</NoData>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex items-baseline justify-between gap-3 font-semibold text-[#12315f]"><span className="min-w-0 truncate" title={r.label}>{r.label}</span><span className="shrink-0 tabular-nums">{format(r.value)}{r.extra ? <span className="ml-2 text-xs font-medium text-slate-500">{r.extra}</span> : null}</span></div>
          <div className="mt-1 h-2 rounded-full bg-[#e6ecf7]"><div className="h-2 rounded-full bg-[#1e40af]" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export const Stat = ({ label, value, sub }) => (
  <div className="rounded-xl border border-[#dbe3f0] bg-[#f8faff] p-3.5">
    <p className="text-xs font-bold text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#12315f]">{value}</p>
    {sub && <p className="mt-0.5 text-xs font-medium text-slate-500">{sub}</p>}
  </div>
);
