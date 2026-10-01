import { useCallback, useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { Badge, ErrorBox, Pills, Spinner, dateTime } from './shared';

function AppealCard({ appeal, level, onChanged, setError }) {
  const [action, setAction] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async () => {
    setBusy(true);
    setError('');
    try { await api.decideAppeal(appeal.id, action, note.trim()); setAction(''); setNote(''); onChanged(); } catch (err) { setError(err.message || 'No se pudo decidir.'); } finally { setBusy(false); }
  };

  return (
    <li className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-900/5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-extrabold text-[#12315f]">@{appeal.user?.username || 'cuenta eliminada'}</span>
        <Badge className={appeal.status === 'open' ? 'bg-blue-100 text-blue-800' : appeal.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}>{appeal.status === 'open' ? 'Abierta' : appeal.status === 'accepted' ? 'Aceptada' : 'Rechazada'}</Badge>
        <span className="ml-auto text-xs font-semibold text-slate-500">{dateTime(appeal.createdAt)}</span>
      </div>
      {appeal.sanction && <p className="mt-1 text-xs font-bold text-slate-500">Apela: {appeal.sanction.typeLabel} — {appeal.sanction.reason}</p>}
      {appeal.report && <p className="mt-1 text-xs font-bold text-slate-500">Apela contenido moderado ({appeal.report.shortCode}): {appeal.report.object} — {appeal.report.reason}{appeal.report.decisionNote ? ` · Nota: ${appeal.report.decisionNote}` : ''}</p>}
      <p className="mt-2 whitespace-pre-line break-words rounded-xl bg-slate-50 p-3 text-slate-700">{appeal.text}</p>
      {appeal.decisionNote && <p className="mt-2 text-xs font-bold text-slate-500">Decisión ({dateTime(appeal.decidedAt)}): {appeal.decisionNote}</p>}
      {appeal.status === 'open' && level >= 3 && (
        <div className="mt-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setAction('accept')} aria-pressed={action === 'accept'} className={`h-10 flex-1 rounded-full bg-emerald-600 px-4 text-sm font-extrabold text-white ${action === 'accept' ? 'ring-4 ring-emerald-200' : ''}`}>Aceptar</button>
            <button type="button" onClick={() => setAction('reject')} aria-pressed={action === 'reject'} className={`h-10 flex-1 rounded-full border-2 border-slate-500 px-4 text-sm font-extrabold text-slate-700 ${action === 'reject' ? 'ring-4 ring-slate-200' : ''}`}>Rechazar</button>
          </div>
          {action && (
            <div className="mt-2 space-y-2">
              <label className="block text-sm font-extrabold text-slate-700">Motivo de la decisión (se envía a la persona)
                <textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-[#1e40af]" />
              </label>
              <button type="button" disabled={busy || note.trim().length < 5} onClick={decide} className="h-11 w-full rounded-full bg-[#12315f] px-6 text-sm font-extrabold text-white disabled:opacity-50">{busy ? 'Enviando…' : 'Confirmar decisión'}</button>
              <p className="text-xs font-semibold text-slate-500">Debe decidir una persona distinta de quien tomó la medida; si eres el único administrador, queda anotado.</p>
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
        <p className="rounded-2xl bg-white p-6 text-center text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-900/5">No hay apelaciones en esta lista.</p>
      ) : (
        <ul className="space-y-3">{list.map((appeal) => <AppealCard key={appeal.id} appeal={appeal} level={level} onChanged={load} setError={setError} />)}</ul>
      )}
    </section>
  );
}
