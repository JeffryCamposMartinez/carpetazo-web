import { useCallback, useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { Badge, ErrorBox, Pills, Spinner, dateTime } from './shared';

const STATUS = {
  open: { label: 'Nuevo', className: 'bg-blue-100 text-blue-800' },
  awaiting_response: { label: 'Esperando descargo', className: 'bg-amber-100 text-amber-900' },
  in_review: { label: 'En revisión', className: 'bg-purple-100 text-purple-800' },
  resolved: { label: 'Resuelto', className: 'bg-emerald-100 text-emerald-800' }
};
const RESOLUTIONS = [
  ['dismissed', 'Sin fundamento (descartar)'],
  ['warned', 'Advertir'],
  ['restricted', 'Suspender ventas'],
  ['suspended', 'Suspender cuenta'],
  ['escalated', 'Escalar a autoridades (queda registrado)']
];
const TYPE_LABELS = { order: 'Pedido', user: 'Cuenta', message: 'Mensaje' };

function CaseDetail({ id, level, onClose, onChanged, onOpenPerson, onOpenReport }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [resolution, setResolution] = useState('');
  const [note, setNote] = useState('');
  const [publicMessage, setPublicMessage] = useState('');
  const [days, setDays] = useState('7');
  const [busy, setBusy] = useState(false);

  // Informe para autoridades: solo administradores, con el motivo escrito; se descarga como archivo HTML (imprimible a PDF)
  const exportReport = async () => {
    const purpose = window.prompt('Motivo de la entrega (requerimiento, denuncia o fundamento legal; mínimo 10 caracteres). Queda registrado en la auditoría:');
    if (!purpose || purpose.trim().length < 10) return;
    const reference = window.prompt('Referencia del requerimiento (RUC, folio u oficio; opcional):') || '';
    setBusy(true);
    setError('');
    try {
      const res = await api.exportCase(id, purpose.trim(), reference.trim());
      const url = URL.createObjectURL(new Blob([res.html], { type: 'text/html;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = res.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      load();
    } catch (err) {
      setError(err.message || 'No se pudo generar el informe.');
    } finally {
      setBusy(false);
    }
  };

  const load = useCallback(() => { setError(''); api.getAdminCase(id).then(setData).catch((err) => setError(err.message || 'No se pudo cargar el caso.')); }, [id]);
  useEffect(() => { setData(null); setResolution(''); setNote(''); load(); }, [load]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); load(); onChanged(); } catch (err) { setError(err.message || 'No se pudo completar la acción.'); } finally { setBusy(false); }
  };

  const needsDays = resolution === 'restricted' || resolution === 'suspended';
  const item = data?.case;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="min-w-0 truncate text-base font-black text-[#12315f]">{item ? `${item.shortCode} · Estafa` : 'Cargando…'}</h2>
        <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100">Cerrar</button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <ErrorBox>{error}</ErrorBox>
        {!data && !error && <Spinner />}
        {item && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={STATUS[item.status]?.className}>{STATUS[item.status]?.label}</Badge>
              {item.priority === 'high' && <Badge className="bg-red-600 text-white">Prioridad alta</Badge>}
              {item.responseDueAt && item.status === 'awaiting_response' && <span className="text-xs font-bold text-amber-800">Responde hasta {dateTime(item.responseDueAt)}</span>}
              <span className="ml-auto text-xs font-semibold text-slate-500">Abierto {dateTime(item.openedAt)}</span>
            </div>

            {data.subject && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="font-extrabold text-[#12315f]">{data.subject.name || data.subject.username} (@{data.subject.username})</p>
                <p className="text-xs text-slate-500">Cuenta de {data.subject.ageDays} días · {data.indicators.completedSales} ventas completadas · {data.indicators.reviews} reseñas{data.indicators.averageRating ? ` (promedio ${data.indicators.averageRating.toFixed(1)})` : ''}</p>
                <ul className="mt-2 space-y-0.5 text-xs font-bold">
                  <li className={data.indicators.distinctReporters30d >= 2 ? 'text-red-700' : 'text-slate-600'}>{data.indicators.distinctReporters30d >= 2 ? '⚠' : '·'} {data.indicators.distinctReporters30d} personas distintas lo reportaron en 30 días</li>
                  <li className={data.indicators.previousCases > 0 ? 'text-red-700' : 'text-slate-600'}>{data.indicators.previousCases > 0 ? '⚠' : '·'} {data.indicators.previousCases} casos anteriores</li>
                  <li className="text-slate-600">· {data.indicators.activeSanctions} medidas vigentes</li>
                </ul>
                <button type="button" onClick={() => onOpenPerson(data.subject.username)} className="mt-2 text-xs font-extrabold text-blue-700 underline-offset-2 hover:underline">Ver ficha de la persona</button>
              </div>
            )}

            <section>
              <h3 className="mb-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">Reportes ({data.reports.length})</h3>
              <ul className="space-y-2">
                {data.reports.map((report) => (
                  <li key={report.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-slate-200 text-slate-700">{TYPE_LABELS[report.targetType] || report.targetType}</Badge>
                      <span className="font-bold text-[#12315f]">{report.reasonCode}</span>
                      <span className="ml-auto text-xs text-slate-400">{report.shortCode} · {dateTime(report.createdAt)}</span>
                    </div>
                    {report.reporter && <p className="text-xs font-bold text-slate-500">Reportó @{report.reporter}{report.reporterRole ? ` (${report.reporterRole === 'buyer' ? 'comprador' : 'vendedor'})` : ''}{report.evidenceCount ? ` · ${report.evidenceCount} evidencia(s)` : ''}</p>}
                    {report.comment && <p className="mt-1 whitespace-pre-line break-words text-slate-700">{report.comment}</p>}
                    {report.extra && Object.keys(report.extra).length > 0 && <p className="text-xs text-slate-500">{Object.entries(report.extra).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p>}
                    <button type="button" onClick={() => onOpenReport(report.id)} className="mt-1 text-xs font-extrabold text-blue-700 underline-offset-2 hover:underline">Abrir reporte</button>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">Descargo del vendedor</h3>
              {item.sellerResponse ? (
                <p className="whitespace-pre-line break-words rounded-xl bg-emerald-50 p-3 text-sm text-slate-700 ring-1 ring-emerald-200">{item.sellerResponse}<span className="mt-1 block text-xs font-bold text-emerald-800">Recibido {dateTime(item.sellerRespondedAt)}</span></p>
              ) : <p className="text-sm italic text-slate-400">{item.status === 'awaiting_response' ? 'Esperando su respuesta.' : 'Todavía no se pide el descargo.'}</p>}
              {item.allowedActions.includes('request_response') && ['open', 'in_review'].includes(item.status) && (
                <button type="button" disabled={busy} onClick={() => run(() => api.requestCaseResponse(id))} className="mt-2 h-10 rounded-full bg-amber-500 px-5 text-sm font-extrabold text-white disabled:opacity-50">Pedir descargo ({item.priority === 'high' ? '48' : '72'} h)</button>
              )}
            </section>

            {data.sanctions.length > 0 && (
              <section>
                <h3 className="mb-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">Medidas sobre la cuenta</h3>
                <ul className="space-y-1 text-sm text-slate-700">{data.sanctions.map((sanction) => <li key={sanction.id}>· {sanction.type} — {sanction.status}{sanction.automatic ? ' (automática)' : ''}</li>)}</ul>
              </section>
            )}

            <section>
              <h3 className="mb-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">Línea de tiempo</h3>
              {data.timeline.length === 0 ? <p className="text-sm italic text-slate-400">Sin acciones todavía.</p> : (
                <ol className="space-y-1.5">{data.timeline.map((entry) => <li key={entry.id} className="text-sm text-slate-700"><span className="font-bold">{entry.action}</span> · {entry.actor} · <span className="text-xs text-slate-400">{dateTime(entry.createdAt)}</span>{entry.note && <span className="block text-slate-600">{entry.note}</span>}</li>)}</ol>
              )}
            </section>

            {item.status !== 'resolved' && item.allowedActions.includes('resolve') && (
              <section aria-label="Resolver el caso" className="rounded-2xl border border-slate-200 p-3">
                <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">Resolver</h3>
                <label className="block text-sm font-extrabold text-slate-700">
                  Decisión
                  <select value={resolution} onChange={(event) => setResolution(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold">
                    <option value="">Elige…</option>
                    {RESOLUTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </label>
                {needsDays && (
                  <label className="mt-2 block text-sm font-extrabold text-slate-700">Duración (días){level < 3 ? ' · máximo 30' : ''}
                    <input type="number" min="1" max={level >= 3 ? 365 : 30} value={days} onChange={(event) => setDays(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold" />
                  </label>
                )}
                {resolution && (
                  <>
                    <label className="mt-2 block text-sm font-extrabold text-slate-700">Motivo interno (obligatorio)
                      <textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-[#1e40af]" />
                    </label>
                    {['warned', 'restricted', 'suspended'].includes(resolution) && (
                      <label className="mt-2 block text-sm font-extrabold text-slate-700">Mensaje para la persona (opcional)
                        <textarea rows={2} maxLength={500} value={publicMessage} onChange={(event) => setPublicMessage(event.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-[#1e40af]" />
                      </label>
                    )}
                    <button type="button" disabled={busy || note.trim().length < 5 || (needsDays && !days)} onClick={() => run(async () => { await api.resolveCase(id, { resolution, note: note.trim(), publicMessage: publicMessage.trim() || undefined, durationDays: needsDays ? Number(days) : undefined }); setResolution(''); setNote(''); })} className="mt-3 h-11 w-full rounded-full bg-[#12315f] px-6 text-sm font-extrabold text-white disabled:opacity-50">{busy ? 'Aplicando…' : 'Confirmar resolución'}</button>
                  </>
                )}
              </section>
            )}
            {item.status === 'resolved' && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">Resuelto: {item.resolution}{item.resolutionNote ? ` — ${item.resolutionNote}` : ''}</p>}
            {level >= 3 && (
              <section aria-label="Informe para autoridades" className="rounded-2xl border border-slate-200 p-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Informe para autoridades</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">Genera un documento con los reportes, el descargo, las medidas y la línea de tiempo. No incluye correos, RUT, teléfonos ni datos bancarios (esos se entregan solo con requerimiento formal, revisado por un abogado).</p>
                <button type="button" disabled={busy} onClick={exportReport} className="mt-2 h-10 rounded-full border-2 border-[#12315f] px-5 text-sm font-extrabold text-[#12315f] disabled:opacity-50">Descargar informe</button>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CasesPanel({ level, onOpenPerson, onOpenReport }) {
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    setError('');
    api.getAdminCases({ status, page }).then(setList).catch((err) => { setList({ cases: [], pages: 1 }); setError(err.message || 'No se pudo cargar los casos.'); });
  }, [status, page]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section aria-label="Casos de estafa" className={selected ? 'hidden lg:block' : ''}>
        <Pills label="Estado del caso" value={status} onChange={(value) => { setPage(1); setStatus(value); }} options={[['active', 'Abiertos'], ['awaiting_response', 'Esperando descargo'], ['in_review', 'En revisión'], ['resolved', 'Resueltos']]} />
        <ErrorBox>{error}</ErrorBox>
        {list === null ? <Spinner /> : list.cases.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-900/5">
            <span translate="no" className="material-symbols-outlined text-5xl text-[#1e40af]/40">verified_user</span>
            <h2 className="mt-2 text-lg font-extrabold text-[#12315f]">No hay casos aquí</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">Cuando alguien reporte una estafa, se abrirá un caso contra esa persona y reunirá todos los reportes.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.cases.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => setSelected(item.id)} aria-current={selected === item.id} className={`w-full rounded-2xl bg-white p-3 text-left shadow-sm ring-1 transition hover:ring-[#1e40af] ${selected === item.id ? 'ring-2 ring-[#1e40af]' : 'ring-slate-900/5'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={STATUS[item.status]?.className}>{STATUS[item.status]?.label}</Badge>
                    {item.priority === 'high' && <Badge className="bg-red-600 text-white">Alta</Badge>}
                    <Badge className="bg-rose-100 text-rose-800">{item.reportCount} {item.reportCount === 1 ? 'reporte' : 'reportes'}</Badge>
                    <span className="ml-auto text-xs font-semibold text-slate-500">{dateTime(item.openedAt)}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-extrabold text-[#12315f]">{item.shortCode} · @{item.subject?.username || 'cuenta eliminada'}</p>
                  {item.responseDueAt && item.status === 'awaiting_response' && <p className="text-xs font-bold text-amber-800">Responde hasta {dateTime(item.responseDueAt)}</p>}
                  {item.responded && item.status === 'in_review' && <p className="text-xs font-bold text-emerald-700">El vendedor ya respondió</p>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {list && list.pages > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="h-10 rounded-full bg-white px-4 text-sm font-bold ring-1 ring-slate-300 disabled:opacity-40">Anterior</button>
            <span className="text-sm font-semibold text-slate-600">Página {page} de {list.pages}</span>
            <button type="button" disabled={page >= list.pages} onClick={() => setPage((value) => value + 1)} className="h-10 rounded-full bg-white px-4 text-sm font-bold ring-1 ring-slate-300 disabled:opacity-40">Siguiente</button>
          </div>
        )}
      </section>
      {selected ? (
        <section aria-label="Detalle del caso" className="max-h-[calc(100vh-140px)] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5 lg:sticky lg:top-4">
          <CaseDetail id={selected} level={level} onClose={() => setSelected(null)} onChanged={load} onOpenPerson={onOpenPerson} onOpenReport={onOpenReport} />
        </section>
      ) : <section className="hidden items-center justify-center rounded-2xl bg-white/60 p-8 text-center text-sm font-semibold text-slate-500 lg:flex">Elige un caso para ver los reportes, el descargo y resolver.</section>}
    </div>
  );
}
