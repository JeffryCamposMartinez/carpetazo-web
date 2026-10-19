import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useToast } from '../ui/ToastProvider';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';

const SOURCES = [['direct', 'Directo'], ['internal', 'Desde Carpetazo'], ['external', 'Otros sitios']];
const buttonClass = 'inline-flex h-10 [@media(pointer:coarse)]:h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-sm font-extrabold text-[#12315f] transition-[background-color,transform] duration-150 hover:bg-blue-50 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#facc15] disabled:opacity-60';
const dayLabel = (day) => new Date(day + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });

// Detalle de visitas de mis carpetas: total, por día, de dónde llegan y por carpeta (planes Premium en adelante)
function VisitsDetail() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    api.getVisitsDetail(days).then((response) => { if (live) setData(response); }).catch((failure) => { if (live) setError(failure.message || 'No se pudo cargar el detalle de visitas.'); });
    return () => { live = false; };
  }, [days]);

  const peak = Math.max(1, ...(data?.daily || []).map((row) => row.count));
  const sourceTotal = (key) => (data?.folders || []).reduce((sum, folder) => sum + (folder.sources?.[key] || 0), 0);
  return (
    <section aria-label="Detalle de visitas" className="mt-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-black text-[#12315f]">Visitas a tus carpetas</h3>
        <div role="group" aria-label="Período" className="flex gap-1.5">
          {[7, 30, 90].map((option) => (
            <button key={option} type="button" aria-pressed={days === option} onClick={() => setDays(option)} className={`h-9 rounded-full px-3 text-sm font-bold ${days === option ? 'bg-[#12315f] text-white' : 'bg-slate-100 text-[#12315f] hover:bg-slate-200'}`}>{option} días</button>
          ))}
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      {!error && !data && <div className="py-6"><LoadingState label="Cargando visitas" /></div>}
      {data && (
        <div className="mt-3 space-y-4">
          <p className="text-sm font-semibold text-slate-600"><span className="text-2xl font-black tabular-nums text-[#12315f]">{data.total.toLocaleString('es-CL')}</span> {data.total === 1 ? 'visita' : 'visitas'} en los últimos {data.days} días</p>
          {data.daily.length > 0 ? (
            <div className="flex h-24 items-end gap-0.5" role="img" aria-label={`Visitas por día; el máximo fue ${peak}`}>
              {data.daily.map((row) => <span key={row.day} title={`${dayLabel(row.day)}: ${row.count}`} className="min-w-0 flex-1 rounded-t bg-[#1e40af]/80" style={{ height: `${Math.max(6, (row.count / peak) * 100)}%` }} />)}
            </div>
          ) : <p className="text-sm text-slate-500">Todavía no hay visitas en este período. Aparecerán aquí cuando alguien abra tus carpetas públicas.</p>}
          <dl className="grid grid-cols-3 gap-2 text-center">
            {SOURCES.map(([key, label]) => (
              <div key={key} className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200"><dd className="text-lg font-black tabular-nums text-[#12315f]">{sourceTotal(key).toLocaleString('es-CL')}</dd><dt className="text-xs font-semibold text-slate-600">{label}</dt></div>
            ))}
          </dl>
          <ul className="divide-y divide-slate-100">
            {data.folders.map((folder) => (
              <li key={folder.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate font-bold text-[#12315f]">{folder.name}{!folder.isPublic && <span className="ml-1 text-xs font-semibold text-slate-500">(privada)</span>}</span>
                <span className="shrink-0 tabular-nums text-slate-600"><strong className="text-[#12315f]">{folder.total.toLocaleString('es-CL')}</strong> · {folder.allTime.toLocaleString('es-CL')} en total</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// Herramientas que dependen del plan: exportar el inventario y ver el detalle de visitas. Sin el plan, llevan a la página de planes.
export default function PlanTools({ plan }) {
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [visitsOpen, setVisitsOpen] = useState(false);

  const exportInventory = async () => {
    setExporting(true);
    try {
      const { blob, name } = await api.downloadInventory();
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), { href: url, download: name });
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Inventario exportado', 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo exportar el inventario.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mb-5 -mt-2">
      <div className="flex flex-wrap gap-2">
        {plan.inventoryExport
          ? <button type="button" onClick={exportInventory} disabled={exporting} className={buttonClass}>{exporting ? <ButtonSpinner tone="dark" /> : <SvgIcon name="download" translate="no" aria-hidden="true" className="text-[19px]" />}Exportar inventario (CSV)</button>
          : <Link to="/planes" className={buttonClass} title="Disponible desde el plan Entusiasta"><SvgIcon name="lock" translate="no" aria-hidden="true" className="text-[19px]" />Exportar inventario · Entusiasta</Link>}
        {plan.visitsDetail
          ? <button type="button" onClick={() => setVisitsOpen((open) => !open)} aria-expanded={visitsOpen} className={buttonClass}><SvgIcon name="monitoring" translate="no" aria-hidden="true" className="text-[19px]" />{visitsOpen ? 'Ocultar visitas' : 'Detalle de visitas'}</button>
          : <Link to="/planes" className={buttonClass} title="Disponible desde el plan Premium"><SvgIcon name="lock" translate="no" aria-hidden="true" className="text-[19px]" />Detalle de visitas · Premium</Link>}
      </div>
      {plan.visitsDetail && visitsOpen && <VisitsDetail />}
    </div>
  );
}
