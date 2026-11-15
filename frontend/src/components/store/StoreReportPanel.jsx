import { useState } from 'react';
import { api } from '../../services/api';
import { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';

const ymd = (date) => date.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
const PRESETS = [
  { label: 'Últimos 7 días', range: () => [ymd(new Date(Date.now() - 6 * 864e5)), ymd(new Date())] },
  { label: 'Este mes', range: () => { const t = ymd(new Date()); return [`${t.slice(0, 7)}-01`, t]; } },
  { label: 'Mes pasado', range: () => { const d = new Date(); const first = new Date(d.getFullYear(), d.getMonth() - 1, 1); const last = new Date(d.getFullYear(), d.getMonth(), 0); return [ymd(first), ymd(last)]; } }
];
const field = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20';

// Informe de ventas descargable (CSV para Excel o Google Sheets) y aviso del resumen semanal por correo
export default function StoreReportPanel({ showToast }) {
  const [[from, to], setRange] = useState(PRESETS[0].range());
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const blob = await api.downloadStoreReport(from, to);
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `carpetazo-ventas-${from}-a-${to}.csv` });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { showToast('No se pudo generar el informe. Revisa el rango de fechas.', 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => {
          const [a, b] = p.range();
          const on = a === from && b === to;
          return <button key={p.label} type="button" aria-pressed={on} onClick={() => setRange([a, b])} className={`h-9 rounded-full px-4 text-[13px] font-bold transition active:scale-[0.97] ${on ? 'bg-[#1e40af] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{p.label}</button>;
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Desde</span><input type="date" value={from} max={to} onChange={(e) => setRange([e.target.value, to])} className={field} /></label>
        <label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Hasta</span><input type="date" value={to} min={from} onChange={(e) => setRange([from, e.target.value])} className={field} /></label>
      </div>
      <button type="button" disabled={busy || !from || !to} onClick={download} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#facc15] text-[15px] font-black text-[#12315f] shadow-sm transition hover:bg-yellow-300 active:scale-[0.98] disabled:opacity-50">
        {busy ? <ButtonSpinner /> : <SvgIcon name="download" className="text-xl" />}Descargar informe (CSV)
      </button>
      <p className="text-[13px] leading-relaxed text-slate-600">Incluye ventas en persona (con medio de pago) y pedidos confirmados, con cupones y retiros. Se abre en Excel o Google Sheets. Además, cada lunes te llega por correo un resumen de tu semana.</p>
    </div>
  );
}
