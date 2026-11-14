import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import LoadingState, { ButtonSpinner } from '../ui/LoadingState';
import SvgIcon from '../ui/SvgIcon';
import ThemedSelect from '../ui/ThemedSelect';
import { STORE_GAMES } from '../../utils/storeHours';
import { eventDate, eventFee, fromLocalInput, spotsText, toLocalInput } from './storeEventFormat';

const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-[#1e40af] focus:outline-none focus:ring-2 focus:ring-[#1e40af]/20';
const label = 'mb-1 block text-sm font-bold text-[#1a2b4b]';
const STATUS = { scheduled: 'Programado', cancelled: 'Cancelado', finished: 'Terminado' };
const GAME_OPTIONS = STORE_GAMES.map((g) => ({ value: g, label: g }));
const STATUS_OPTIONS = Object.entries(STATUS).map(([value, label]) => ({ value, label }));
const blank = () => ({ title: '', game: STORE_GAMES[0], startsAt: '', endsAt: '', capacity: '', feeClp: '', format: '', description: '', status: 'scheduled', resultNote: '' });

function EventForm({ initial, onCancel, onSaved, showToast }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(initial.id);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const body = { ...form, startsAt: fromLocalInput(form.startsAt), endsAt: fromLocalInput(form.endsAt), capacity: form.capacity === '' ? null : Number(form.capacity), feeClp: form.feeClp === '' ? 0 : Number(form.feeClp) };
    try {
      const r = editing ? await api.updateStoreEvent(initial.id, body) : await api.createStoreEvent(body);
      showToast(editing ? 'Evento actualizado' : 'Evento publicado', 'success');
      onSaved(r.event);
    } catch (error) {
      showToast(error.message || 'No se pudo guardar el evento', 'error');
    } finally { setSaving(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-blue-200 bg-white p-4">
      <label className="block"><span className={label}>Nombre</span><input required minLength={3} maxLength={80} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Torneo semanal de Pokémon" className={`${field} h-11`} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><span className={label}>Juego</span>
          <ThemedSelect value={form.game} onChange={(v) => set({ game: v })} options={GAME_OPTIONS} ariaLabel="Juego del evento" buttonClassName="!min-h-11 !rounded-xl" />
        </div>
        <label className="block"><span className={label}>Formato (opcional)</span><input maxLength={60} value={form.format} onChange={(e) => set({ format: e.target.value })} placeholder="Estándar, Sellado, Racial…" className={`${field} h-11`} /></label>
        <label className="block"><span className={label}>Inicio</span><input required type="datetime-local" value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} className={`${field} h-11`} /></label>
        <label className="block"><span className={label}>Término (opcional)</span><input type="datetime-local" value={form.endsAt} onChange={(e) => set({ endsAt: e.target.value })} className={`${field} h-11`} /></label>
        <label className="block"><span className={label}>Cupos (vacío = sin límite)</span><input type="number" min={1} max={1000} inputMode="numeric" value={form.capacity} onChange={(e) => set({ capacity: e.target.value })} className={`${field} h-11`} /></label>
        <label className="block"><span className={label}>Inscripción en pesos (se paga en el local)</span><input type="number" min={0} max={1000000} step={100} inputMode="numeric" value={form.feeClp} onChange={(e) => set({ feeClp: e.target.value })} placeholder="0 = gratis" className={`${field} h-11`} /></label>
      </div>
      <label className="block"><span className={label}>Descripción (opcional)</span><textarea rows={3} maxLength={1500} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Premios, qué traer, rondas…" className={`${field} py-2`} /></label>
      {editing && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div><span className={label}>Estado</span>
            <ThemedSelect value={form.status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} ariaLabel="Estado del evento" buttonClassName="!min-h-11 !rounded-xl" />
          </div>
          {form.status === 'finished' && <label className="block sm:col-span-2"><span className={label}>Resultados (se muestran 30 días)</span><textarea rows={2} maxLength={1000} value={form.resultNote} onChange={(e) => set({ resultNote: e.target.value })} placeholder="1° Ana · 2° Pedro · 3° Camila" className={`${field} py-2`} /></label>}
        </div>
      )}
      {editing && form.status === 'cancelled' && initial.status !== 'cancelled' && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Al guardar, avisaremos a las personas inscritas que el evento se canceló.</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-11 rounded-full px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100">Cancelar</button>
        <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#1e40af] px-5 text-sm font-black text-white transition hover:bg-[#12315f] active:scale-[0.97] disabled:opacity-60">{saving && <ButtonSpinner tone="dark" />}{editing ? 'Guardar' : 'Publicar evento'}</button>
      </div>
    </form>
  );
}

// Eventos y torneos de la tienda: crear, editar, cancelar y ver inscritos
export default function StoreEventsEditor({ showToast }) {
  const [events, setEvents] = useState(null);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.getMyStoreEvents().then((r) => setEvents(r.events || [])).catch(() => setEvents([]));
  }, []);

  const saved = (event) => {
    setEditing(null);
    api.getMyStoreEvents().then((r) => setEvents(r.events || [])).catch(() => setEvents((list) => [...(list || []).filter((e) => e.id !== event.id), event]));
  };

  if (!events) return <LoadingState variant="compact" label="Cargando eventos" />;
  return (
    <div className="space-y-3">
      {editing ? (
        <EventForm initial={editing} onCancel={() => setEditing(null)} onSaved={saved} showToast={showToast} />
      ) : (
        <button type="button" onClick={() => setEditing(blank())} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#facc15] px-5 text-sm font-black text-[#12315f] shadow-sm transition hover:bg-yellow-300 active:scale-[0.97]">
          <SvgIcon name="add" className="text-lg" />Nuevo evento
        </button>
      )}
      {events.length === 0 && !editing && <p className="text-sm text-slate-600">Publica torneos, prereleases o noches de juego. Las personas se inscriben desde tu perfil y les recordamos el evento un día antes.</p>}
      <ul className="space-y-2">
        {events.map((e) => (
          <li key={e.id} className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-black text-[#1a2b4b]">{e.title}</p>
                <p className="text-sm text-slate-600">{e.game} · {eventDate(e.startsAt)} · {eventFee(e.feeClp)}</p>
                <p className="text-xs font-bold text-[#1e40af]">{STATUS[e.status]} · {spotsText(e)}</p>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => setOpen(open === e.id ? null : e.id)} className="h-9 rounded-full px-3 text-xs font-bold text-slate-700 ring-1 ring-slate-300 transition hover:ring-[#1e40af]">Inscritos ({e.signups.length})</button>
                <button type="button" onClick={() => setEditing({ ...blank(), ...e, startsAt: toLocalInput(e.startsAt), endsAt: toLocalInput(e.endsAt), capacity: e.capacity ?? '', feeClp: e.feeClp || '' })} className="h-9 rounded-full bg-blue-50 px-3 text-xs font-bold text-[#1e40af] transition hover:bg-blue-100">Editar</button>
              </div>
            </div>
            {open === e.id && (
              e.signups.length === 0 ? <p className="mt-2 text-sm text-slate-500">Aún no hay inscritos.</p> : (
                <ol className="mt-2 list-decimal space-y-0.5 pl-6 text-sm text-slate-700">
                  {e.signups.map((s) => <li key={s.username}>{s.name || s.username} <span className="text-slate-500">@{s.username}</span>{s.status === 'waitlist' && <span className="ml-1 rounded-full bg-amber-100 px-2 text-xs font-bold text-amber-800">en espera</span>}</li>)}
                </ol>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
