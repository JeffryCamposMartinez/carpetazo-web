import { useCallback, useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { ErrorBox, Spinner, dateTime } from './shared';

const POLICY_LABELS = {
  evidenceDismissedDays: 'Evidencias de reportes descartados',
  evidenceActionedDays: 'Evidencias de reportes con medida',
  reportDismissedDays: 'Reportes descartados',
  reportActionedDays: 'Reportes con medida',
  appealDays: 'Apelaciones decididas',
  sanctionDays: 'Medidas levantadas o vencidas',
  caseDays: 'Casos de estafa resueltos',
  auditDays: 'Auditoría',
  imageHashDays: 'Huellas de imágenes no prohibidas',
  scanEventDays: 'Registro de escaneos de imágenes'
};
const COUNT_LABELS = { evidenceDismissed: 'evidencias (descartados)', evidenceActioned: 'evidencias (con medida)', reportsDismissed: 'reportes descartados', reportsActioned: 'reportes con medida', appeals: 'apelaciones', sanctions: 'medidas', cases: 'casos', imageHashes: 'huellas', scanEvents: 'registros de escaneo', audit: 'auditoría' };

// Cuánto tiempo se conserva cada cosa y cuándo se limpió por última vez (corre sola una vez al día)
export default function RetentionPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { api.getRetention().then(setData).catch((err) => setError(err.message || 'No se pudo cargar la política.')); }, []);
  useEffect(() => { load(); }, [load]);

  const run = async () => {
    if (!window.confirm('¿Ejecutar ahora la limpieza? Se borran definitivamente los registros que superaron su plazo.')) return;
    setBusy(true);
    setError('');
    try { setResult(await api.runRetention()); load(); } catch (err) { setError(err.message || 'No se pudo ejecutar.'); } finally { setBusy(false); }
  };

  if (!data && !error) return <Spinner />;
  return (
    <section aria-label="Retención de datos" className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
      <h3 className="text-lg font-extrabold text-[#12315f]">Retención de datos</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">Cada día se eliminan solos los registros de moderación que superaron su plazo. Nunca se borra un reporte con una apelación abierta.</p>
      <ErrorBox>{error}</ErrorBox>
      {data && (
        <>
          <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {Object.entries(data.policy).map(([key, days]) => <li key={key} className="flex justify-between gap-3"><span>{POLICY_LABELS[key] || key}</span><b className="tabular-nums">{days >= 365 ? `${Math.round((days / 365) * 10) / 10} años` : `${days} días`}</b></li>)}
          </ul>
          <p className="mt-3 text-sm font-semibold text-slate-600">Última limpieza: {data.last ? `${dateTime(data.last.createdAt)} — ${data.last.note}` : 'todavía no se ejecuta'}</p>
        </>
      )}
      {result && <p role="status" className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">{result.total === 0 ? 'No había nada que eliminar.' : `Eliminado: ${Object.entries(result.counts).filter(([, value]) => value > 0).map(([key, value]) => `${value} ${COUNT_LABELS[key] || key}`).join(', ')}.`}</p>}
      <button type="button" disabled={busy} onClick={run} className="mt-3 h-11 rounded-full border-2 border-slate-400 px-6 text-sm font-extrabold text-slate-700 disabled:opacity-50">{busy ? 'Ejecutando…' : 'Ejecutar ahora'}</button>
    </section>
  );
}
