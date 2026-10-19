import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import usePageMeta from '../hooks/usePageMeta';
import { ButtonSpinner } from '../components/ui/LoadingState';

const KIND_LABELS = { complaint: 'Reclamo', suggestion: 'Sugerencia' };
const STATUS_LABELS = { open: 'Pendiente de revisión', corrected: 'Marcada como corregida' };
const dateTime = (value) => (value ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)) : '');

export default function FeedbackPage() {
  const { currentUser } = useAuth();
  const [form, setForm] = useState({ kind: 'suggestion', title: '', message: '' });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  usePageMeta({ title: 'Reclamos y sugerencias | Carpetazo', description: 'Envía un reclamo o sugerencia al equipo de Carpetazo.', path: '/sugerencias' });

  useEffect(() => {
    if (!currentUser) { setLoading(false); return undefined; }
    let cancelled = false;
    api.getMyFeedback()
      .then((response) => { if (!cancelled) setItems(response.feedback || []); })
      .catch((error) => { if (!cancelled) setNotice({ type: 'error', text: error.message || 'No se pudieron cargar tus envíos.' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentUser]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const response = await api.createFeedback(form);
      setItems((previous) => [response.feedback, ...previous]);
      setForm({ kind: form.kind, title: '', message: '' });
      setNotice({ type: 'success', text: 'Gracias. Tu mensaje quedó enviado al equipo de Carpetazo.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'No se pudo enviar. Inténtalo nuevamente.' });
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="mx-auto w-full max-w-xl px-3 py-8 sm:px-6">
        <section className="rounded-3xl border border-white/70 bg-white p-8 text-center shadow-xl">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8effc] text-[#1e40af]"><span translate="no" aria-hidden="true" className="material-symbols-outlined text-[30px]">feedback</span></span>
          <h1 className="mt-4 text-2xl font-black text-[#12315f]">Reclamos y sugerencias</h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">Inicia sesión para enviar un mensaje al equipo y revisar su estado.</p>
          <Link to="/" className="mt-5 inline-flex h-11 items-center rounded-full bg-[#facc15] px-6 text-sm font-extrabold text-[#12315f]">Volver al inicio</Link>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)]">
        <section className="rounded-3xl border border-white/70 bg-white p-5 shadow-xl sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e8effc] text-[#1e40af]"><span translate="no" aria-hidden="true" className="material-symbols-outlined text-[27px]">feedback</span></span>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#12315f]">Reclamos y sugerencias</h1>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">Cuéntanos qué ocurrió o qué mejorarías. El equipo revisará tu mensaje desde Moderación.</p>
            </div>
          </div>

          {notice && <p role={notice.type === 'error' ? 'alert' : 'status'} className={`mt-5 rounded-xl px-4 py-3 text-sm font-bold ${notice.type === 'error' ? 'bg-red-50 text-red-700 ring-1 ring-red-100' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'}`}>{notice.text}</p>}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-bold text-[#12315f]">Tipo
              <select value={form.kind} onChange={(event) => setForm((previous) => ({ ...previous, kind: event.target.value }))} className="mt-1.5 h-11 w-full rounded-xl border border-[#b9c7e0] bg-white px-3 text-sm font-semibold text-[#12315f] outline-none focus:border-[#1e40af] focus:ring-2 focus:ring-[#1e40af]/15">
                <option value="suggestion">Sugerencia</option>
                <option value="complaint">Reclamo</option>
              </select>
            </label>
            <label className="block text-sm font-bold text-[#12315f]">Asunto
              <input required minLength={3} maxLength={120} value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} placeholder="Ej. Mejorar el buscador" className="mt-1.5 h-11 w-full rounded-xl border border-[#b9c7e0] px-3 text-sm font-semibold text-[#12315f] outline-none placeholder:text-slate-400 focus:border-[#1e40af] focus:ring-2 focus:ring-[#1e40af]/15" />
            </label>
            <label className="block text-sm font-bold text-[#12315f]">Mensaje
              <textarea required minLength={10} maxLength={3000} rows={7} value={form.message} onChange={(event) => setForm((previous) => ({ ...previous, message: event.target.value }))} placeholder="Describe la situación o la idea con el mayor detalle posible…" className="mt-1.5 w-full resize-y rounded-xl border border-[#b9c7e0] px-3 py-2.5 text-sm font-medium leading-relaxed text-[#12315f] outline-none placeholder:text-slate-400 focus:border-[#1e40af] focus:ring-2 focus:ring-[#1e40af]/15" />
            </label>
            <button type="submit" disabled={saving} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#1e40af] px-5 text-sm font-extrabold text-white transition-[background-color,transform] hover:bg-[#12315f] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60">
              {saving ? <><ButtonSpinner /> Enviando…</> : <><span translate="no" aria-hidden="true" className="material-symbols-outlined text-[19px]">send</span> Enviar al equipo</>}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/70 bg-white p-5 shadow-xl sm:p-7" aria-label="Mis envíos">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div><h2 className="text-lg font-black text-[#12315f]">Mis envíos</h2><p className="mt-0.5 text-sm text-slate-500">Consulta el estado de tus mensajes.</p></div>
            <span className="rounded-full bg-[#e8effc] px-2.5 py-1 text-xs font-black text-[#1e40af]">{items.length}</span>
          </div>
          {loading ? <p className="py-8 text-center text-sm font-semibold text-slate-500">Cargando…</p> : items.length === 0 ? <p className="py-8 text-center text-sm font-semibold text-slate-500">Aún no has enviado reclamos ni sugerencias.</p> : (
            <ul className="mt-4 space-y-3">
              {items.map((item) => <li key={item.id} className="rounded-2xl border border-[#dbe3f0] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-black uppercase tracking-wide text-[#1e40af]">{KIND_LABELS[item.kind] || item.kind}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${item.status === 'corrected' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{STATUS_LABELS[item.status] || item.status}</span></div>
                <h3 className="mt-1.5 text-sm font-extrabold text-[#12315f]">{item.title}</h3><p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{item.message}</p><p className="mt-2 text-xs font-semibold text-slate-400">Enviado el {dateTime(item.createdAt)}</p>
                {item.moderatorNote && <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">Nota del equipo: {item.moderatorNote}</p>}
              </li>)}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
