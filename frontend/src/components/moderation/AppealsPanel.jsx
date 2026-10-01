import { useCallback, useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { EmptyState, ErrorBox, Pills, Spinner, relativeTime } from './shared';

const STATUS = {
  open: { label: 'Abierta', bar: 'bg-[#1e40af]', text: 'text-[#1e40af]' },
  accepted: { label: 'Aceptada', bar: 'bg-emerald-600', text: 'text-emerald-700' },
  rejected: { label: 'Rechazada', bar: 'bg-slate-400', text: 'text-slate-600' }
};

function AppealCard({ appeal, level, onChanged, setError }) {
  const [action, setAction] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const status = STATUS[appeal.status] || STATUS.open;

  const decide = async () => {
    setBusy(true);
    setError('');
    try { await api.decideAppeal(appeal.id, action, note.trim()); setAction(''); setNote(''); onChanged(); } catch (err) { setError(err.message || 'No se pudo decidir.'); } finally { setBusy(false); }
  };

  // Qué se apela, dicho en una frase
  const subject = appeal.sanction
    ? `${appeal.sanction.typeLabel}: ${appeal.sanction.reason}`
    : appeal.report
      ? `Contenido moderado (${appeal.report.shortCode}): ${appeal.report.object}, ${appeal.report.reason}${appeal.report.decisionNote ? `. Nota del equipo: ${appeal.report.decisionNote}` : ''}`
      : '';

  return (
    <li className="relative overflow-hidden rounded-xl bg-white py-3.5 pl-5 pr-4 ring-1 ring-slate-900/5">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${status.bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold leading-snug text-[#12315f]">@{appeal.user?.username || 'cuenta eliminada'}</p>
          <p className={`text-xs font-bold ${status.text}`}>{status.label}</p>
        </div>
        <time dateTime={appeal.createdAt} className="shrink-0 pt-0.5 text-xs text-slate-500">{relativeTime(appeal.createdAt)}</time>
      </div>

      {subject && <p className="mt-2 text-sm leading-snug text-slate-500">{subject}</p>}
      <blockquote className="mt-2 whitespace-pre-line break-words rounded-lg bg-slate-50 px-3 py-2.5 text-[15px] leading-relaxed text-slate-800">{appeal.text}</blockquote>
      {appeal.decisionNote && <p className="mt-2 text-sm text-slate-600"><span className="font-bold">Decisión:</span> {appeal.decisionNote}</p>}

      {appeal.status === 'open' && level >= 3 && (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setAction('accept')} aria-pressed={action === 'accept'} className={`h-11 rounded-full bg-emerald-600 px-4 text-sm font-extrabold text-white ${action === 'accept' ? 'ring-4 ring-emerald-200' : ''}`}>Aceptar</button>
            <button type="button" onClick={() => setAction('reject')} aria-pressed={action === 'reject'} className={`h-11 rounded-full border-2 border-slate-500 px-4 text-sm font-extrabold text-slate-700 ${action === 'reject' ? 'ring-4 ring-slate-200' : ''}`}>Rechazar</button>
          </div>
          {action && (
            <div className="mt-3 space-y-2">
              <label className="block text-sm font-bold text-slate-700">Motivo de la decisión (se le envía a la persona)
                <textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-[15px] font-normal outline-none focus:border-[#1e40af]" />
              </label>
              <button type="button" disabled={busy || note.trim().length < 5} onClick={decide} className="h-12 w-full rounded-full bg-[#12315f] px-6 text-sm font-extrabold text-white disabled:opacity-50">{busy ? 'Enviando…' : action === 'accept' ? 'Aceptar la apelación' : 'Rechazar la apelación'}</button>
              <p className="text-xs text-slate-500">Debe decidir una persona distinta de quien tomó la medida. Si eres el único administrador, queda anotado.</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function AppealsPanel({ level }) {
  const [status, setStatus] = useState('open');
  const [list, setList] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.getAdminAppeals(status).then((res) => setList(res.appeals)).catch((err) => { setList([]); setError(err.message || 'No se pudo cargar las apelaciones.'); });
  }, [status]);
  useEffect(() => { setList(null); load(); }, [load]);

  return (
    <section aria-label="Apelaciones" className="mx-auto max-w-3xl">
      <Pills label="Estado de la apelación" value={status} onChange={setStatus} options={[['open', 'Abiertas'], ['accepted', 'Aceptadas'], ['rejected', 'Rechazadas']]} />
      <ErrorBox>{error}</ErrorBox>
      {list === null ? <Spinner /> : list.length === 0 ? (
        <EmptyState icon="gavel" title={status === 'open' ? 'No hay apelaciones abiertas' : 'No hay apelaciones en esta lista'}>
          {status === 'open' ? 'Cuando alguien apele una medida desde su perfil, aparecerá aquí para que otra persona la revise.' : 'Las apelaciones ya decididas se guardan aquí.'}
        </EmptyState>
      ) : (
        <ul className="space-y-3">{list.map((appeal) => <AppealCard key={appeal.id} appeal={appeal} level={level} onChanged={load} setError={setError} />)}</ul>
      )}
    </section>
  );
}
