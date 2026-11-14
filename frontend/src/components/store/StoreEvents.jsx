import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';
import { useToast } from '../ui/ToastProvider';
import { eventDate, eventFee, spotsText } from './storeEventFormat';

// Próximos eventos de una tienda en su perfil público, con inscripción
export default function StoreEvents({ username }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState({ events: [], isOwner: false });
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let alive = true;
    api.getStoreEvents(username).then((r) => { if (alive) setData({ events: r.events || [], isOwner: Boolean(r.isOwner) }); }).catch(() => {});
    return () => { alive = false; };
  }, [username, currentUser]);

  if (!data.events.length) return null;
  const upcoming = data.events.filter((e) => e.status === 'scheduled');
  const finished = data.events.filter((e) => e.status === 'finished');

  const act = async (e) => {
    if (!currentUser) { navigate('/bienvenida'); return; }
    setBusy(e.id);
    try {
      const r = e.mine ? await api.leaveStoreEvent(e.id) : await api.signupStoreEvent(e.id);
      setData((d) => ({ ...d, events: d.events.map((x) => (x.id === e.id ? r.event : x)) }));
      showToast(e.mine ? 'Saliste del evento' : r.event.mine === 'waitlist' ? 'Quedaste en lista de espera: te avisamos si se libera un cupo' : '¡Listo! Te inscribiste. La inscripción se paga en el local', 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo completar', 'error');
    } finally { setBusy(null); }
  };

  return (
    <section aria-label="Eventos y torneos" className="relative z-10 mx-auto w-full max-w-[1220px] px-4 pt-5 sm:px-6 md:px-8">
      <div className="rounded-3xl border border-blue-100 bg-white p-4 text-slate-800 shadow-sm sm:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-extrabold text-[#12315f]"><SvgIcon name="emoji_events" className="text-2xl text-[#1e40af]" />Eventos y torneos</h2>
        {upcoming.length > 0 && (
          <ul className="grid gap-3 md:grid-cols-2">
            {upcoming.map((e) => (
              <li key={e.id} className="flex flex-col rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-[#1e40af]">{e.game}{e.format ? ` · ${e.format}` : ''}</p>
                <p className="mt-0.5 text-lg font-extrabold text-[#1a2b4b]">{e.title}</p>
                <p className="text-sm text-slate-600">{eventDate(e.startsAt)} · {eventFee(e.feeClp)}</p>
                {e.description && <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-slate-700">{e.description}</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className={`text-xs font-bold ${e.spotsLeft === 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{spotsText(e)}</span>
                  {!data.isOwner && (
                    <button type="button" disabled={busy === e.id} onClick={() => act(e)} className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-black transition active:scale-[0.97] disabled:opacity-60 ${e.mine ? 'bg-white text-slate-700 ring-1 ring-slate-300 hover:ring-red-400' : 'bg-[#1e40af] text-white hover:bg-[#12315f]'}`}>
                      {busy === e.id && <ButtonSpinner tone={e.mine ? 'light' : 'dark'} />}
                      {e.mine === 'registered' ? 'Inscrito · salir' : e.mine === 'waitlist' ? 'En espera · salir' : e.spotsLeft === 0 ? 'Lista de espera' : 'Inscribirme'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {finished.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-black text-[#1a2b4b]">Resultados recientes</h3>
            <ul className="space-y-2">
              {finished.map((e) => <li key={e.id} className="rounded-xl bg-slate-50 p-3 text-sm"><span className="font-bold">{e.title}</span> <span className="text-slate-500">({eventDate(e.startsAt)})</span>{e.resultNote && <p className="mt-1 whitespace-pre-line text-slate-700">{e.resultNote}</p>}</li>)}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
