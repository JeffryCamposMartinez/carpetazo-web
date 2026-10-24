import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { Badge, EmptyState, ErrorBox, Pills, ROW, ROW_HOVER, Spinner, dateTime } from './shared';
import SvgIcon from '../ui/SvgIcon';
import ThemedSelect from '../ui/ThemedSelect';

const KIND_LABELS = { complaint: 'Reclamo', suggestion: 'Sugerencia', support: 'Soporte' };
const STATUS_LABELS = { open: 'Pendientes', corrected: 'Corregidas', all: 'Todas' };

// Bandeja de mensajes enviados desde «Reclamos y sugerencias». Soporte puede leerla; moderadores y administradores pueden cerrarla.
export default function FeedbackPanel({ level = 1 }) {
  const [status, setStatus] = useState('open');
  const [kind, setKind] = useState('all');
  const [dateOrder, setDateOrder] = useState('newest');
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const [replies, setReplies] = useState({});
  const sortedFeedback = useMemo(() => [...(data?.feedback || [])].sort((a, b) => {
    const dateA = Date.parse(a.createdAt) || 0;
    const dateB = Date.parse(b.createdAt) || 0;
    return dateOrder === 'oldest' ? dateA - dateB : dateB - dateA;
  }), [data?.feedback, dateOrder]);

  const load = useCallback(() => {
    setData(null);
    setMessage('');
    api.getAdminFeedback({ status, ...(kind !== 'all' ? { kind } : {}) })
      .then(setData)
      .catch((error) => setMessage(error.message || 'No se pudieron cargar los reclamos y sugerencias.'));
  }, [kind, status]);

  useEffect(() => { load(); }, [load]);

  const correct = async (id) => {
    const note = replies[id]?.trim() || '';
    setBusyId(id);
    setMessage('');
    try {
      await api.correctFeedback(id, note || undefined);
      if (status === 'open') setData((previous) => previous ? { ...previous, total: Math.max(0, previous.total - 1), feedback: previous.feedback.filter((item) => item.id !== id), counts: { ...previous.counts, open: Math.max(0, (previous.counts?.open || 0) - 1), corrected: (previous.counts?.corrected || 0) + 1 } } : previous);
      else setData((previous) => previous ? { ...previous, feedback: previous.feedback.map((item) => item.id === id ? { ...item, status: 'corrected', moderatorNote: note || item.moderatorNote, correctedAt: new Date().toISOString() } : item) } : previous);
      setReplies((previous) => { const next = { ...previous }; delete next[id]; return next; });
    } catch (error) {
      setMessage(error.message || 'No se pudo marcar como corregida.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <ErrorBox>{message}</ErrorBox>
      <div className="flex flex-wrap gap-2">
        <Pills label="Estado de las entradas" value={status} onChange={setStatus} options={Object.entries(STATUS_LABELS)} counts={data?.counts} />
        <Pills label="Tipo de entrada" value={kind} onChange={setKind} options={[['all', 'Todos'], ['complaint', 'Reclamos'], ['suggestion', 'Sugerencias'], ['support', 'Soporte']]} />
        <div className="inline-flex items-center gap-2 rounded-xl bg-[#e6ecf7] p-1">
          <span className="pl-2 text-xs font-extrabold uppercase tracking-wide text-[#12315f]/70">Ordenar</span>
          <ThemedSelect
            value={dateOrder}
            onChange={setDateOrder}
            ariaLabel="Ordenar reclamos y sugerencias por fecha"
            icon="calendar_month"
            className="w-[178px]"
            buttonClassName="!min-h-10 !rounded-lg !border-[#12315f]/15 !px-3 !text-sm !shadow-sm"
            options={[{ value: 'newest', label: 'Más recientes' }, { value: 'oldest', label: 'Más antiguas' }]}
          />
        </div>
      </div>
      {!data ? <Spinner label="Cargando mensajes" /> : data.feedback.length === 0 ? (
        <EmptyState icon="task_alt" title={status === 'open' ? 'No hay entradas pendientes' : 'No hay entradas para mostrar'}>Cuando alguien envíe un reclamo o sugerencia aparecerá aquí.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {sortedFeedback.map((item) => (
            <li key={item.id} className={`${ROW} ${ROW_HOVER} p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><Badge className={item.kind === 'complaint' ? 'bg-amber-100 text-amber-800' : item.kind === 'support' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-[#1e40af]'}>{KIND_LABELS[item.kind] || item.kind}</Badge>{item.priority && <Badge className="bg-[#facc15] text-[#12315f]">Prioritario · plan Legendario o Tienda</Badge>}<span className="text-xs font-semibold text-slate-500">{dateTime(item.createdAt)} · @{item.user?.username || 'usuario'}</span></div>
                  <h3 className="mt-2 text-base font-extrabold text-[#12315f]">{item.title}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{item.message}</p>
                  {item.attachments?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.attachments.map((image, index) => <a key={image.url} href={image.url} target="_blank" rel="noreferrer" title="Abrir imagen adjunta" className="relative block h-24 w-24 overflow-hidden rounded-xl border border-slate-200"><img src={image.url} alt={`Imagen adjunta ${index + 1}`} loading="lazy" className="h-full w-full object-cover" />{image.reviewRequired && <span className="absolute inset-x-0 bottom-0 bg-amber-400/95 px-1 py-0.5 text-center text-[9px] font-black text-[#12315f]">Revisión sugerida</span>}</a>)}</div>}
                  {item.moderatorNote && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">Respuesta del equipo: {item.moderatorNote}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge className={item.status === 'corrected' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}>{item.status === 'corrected' ? 'Corregida' : 'Pendiente'}</Badge>
                  {item.status === 'open' && level >= 2 && <div className="flex w-full flex-col items-end gap-2">{item.kind === 'support' && <textarea maxLength={1000} value={replies[item.id] || ''} onChange={(event) => setReplies((previous) => ({ ...previous, [item.id]: event.target.value }))} placeholder="Escribe la respuesta que recibirá la persona…" aria-label="Respuesta de soporte" className="min-h-24 w-full rounded-xl border border-[#b9c7e0] p-3 text-sm text-[#12315f] outline-none focus:border-[#1e40af] focus:ring-2 focus:ring-[#1e40af]/15" />}<button type="button" onClick={() => correct(item.id)} disabled={busyId === item.id || (item.kind === 'support' && !(replies[item.id] || '').trim())} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#12315f] px-3.5 text-xs font-extrabold text-white transition-[background-color,transform] hover:bg-[#1e40af] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50">{busyId === item.id ? 'Guardando…' : <><SvgIcon name="check_circle" translate="no" aria-hidden="true" className="text-[17px]" /> {item.kind === 'support' ? 'Enviar respuesta y cerrar' : 'Marcar corregida'}</>}</button></div>}
                  {item.status === 'open' && level < 2 && <span className="text-xs font-semibold text-slate-500">Solo lectura</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
