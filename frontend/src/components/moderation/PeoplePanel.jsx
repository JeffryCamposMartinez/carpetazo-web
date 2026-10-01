import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { Badge, ErrorBox, Pills, QUICK_REASONS, SANCTION_TYPES, Spinner, dateOnly } from './shared';

const STATUS_LABELS = { active: 'Vigente', pending_approval: 'Pendiente de segunda aprobación', revoked: 'Levantada', expired: 'Venció' };
const STATUS_CLASSES = { active: 'bg-red-100 text-red-800', pending_approval: 'bg-amber-100 text-amber-900', revoked: 'bg-slate-200 text-slate-700', expired: 'bg-slate-200 text-slate-700' };
const COUNT_LABELS = { open: 'pendientes', actioned: 'con medida', dismissed: 'descartados' };

function SanctionRow({ sanction, level, onChanged, setError }) {
  const [busy, setBusy] = useState(false);
  const revoke = async () => {
    const note = window.prompt('Motivo para levantar la medida (mínimo 5 caracteres):');
    if (!note || note.trim().length < 5) return;
    setBusy(true);
    try { await api.revokeSanction(sanction.id, note.trim()); onChanged(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const approve = async () => {
    if (!window.confirm('¿Aprobar el cierre de esta cuenta? Es una medida grave y deja a la persona sin poder escribir.')) return;
    setBusy(true);
    try { await api.approveSanction(sanction.id); onChanged(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <li className="rounded-2xl bg-white p-3 text-sm shadow-sm ring-1 ring-slate-900/5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-extrabold text-[#12315f]">{sanction.typeLabel}</span>
        <Badge className={STATUS_CLASSES[sanction.status]}>{STATUS_LABELS[sanction.status]}</Badge>
        {sanction.automatic && <Badge className="bg-purple-100 text-purple-800">Automática</Badge>}
        <span className="ml-auto text-xs font-semibold text-slate-500">{dateOnly(sanction.createdAt)}{sanction.expiresAt ? ` → ${dateOnly(sanction.expiresAt)}` : ''}</span>
      </div>
      {sanction.user && <p className="text-xs font-bold text-slate-500">@{sanction.user.username}</p>}
      <p className="mt-1 text-slate-700">{sanction.reason}</p>
      {sanction.note && <p className="text-xs italic text-slate-500">Nota interna: {sanction.note}</p>}
      <p className="text-xs text-slate-400">Por {sanction.createdBy || 'equipo'}{sanction.approvedBy ? ` · aprobada por ${sanction.approvedBy}` : ''}</p>
      {level >= 3 && ['active', 'pending_approval'].includes(sanction.status) && (
        <div className="mt-2 flex gap-2">
          {sanction.status === 'pending_approval' && <button type="button" disabled={busy} onClick={approve} className="h-10 rounded-full bg-red-600 px-4 text-sm font-extrabold text-white disabled:opacity-50">Aprobar cierre</button>}
          <button type="button" disabled={busy} onClick={revoke} className="h-10 rounded-full border-2 border-slate-400 px-4 text-sm font-extrabold text-slate-700 disabled:opacity-50">{sanction.status === 'pending_approval' ? 'Rechazar' : 'Levantar'}</button>
        </div>
      )}
    </li>
  );
}

function SanctionForm({ username, level, reportId, onDone, setError }) {
  const [type, setType] = useState('warning');
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState(QUICK_REASONS.warning);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const needsDays = type !== 'warning' && type !== 'ban';
  const types = SANCTION_TYPES.filter(([key]) => key !== 'ban' || level >= 3);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.applySanction(username, { type, reason: reason.trim(), note: note.trim() || undefined, durationDays: needsDays && days ? Number(days) : undefined, reportId });
      onDone();
    } catch (err) {
      setError(err.message || 'No se pudo aplicar la medida.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
      <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Aplicar medida a @{username}</h3>
      <label className="block text-sm font-extrabold text-slate-700">
        Tipo
        <select value={type} onChange={(event) => { setType(event.target.value); setReason(QUICK_REASONS[event.target.value]); }} className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold">
          {types.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      {needsDays && (
        <label className="block text-sm font-extrabold text-slate-700">
          Duración (días){level < 3 ? ' · máximo 30' : ' · vacío = hasta nuevo aviso'}
          <input type="number" min="1" max={level >= 3 ? 365 : 30} value={days} onChange={(event) => setDays(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold" />
        </label>
      )}
      <label className="block text-sm font-extrabold text-slate-700">
        Motivo que verá la persona
        <textarea rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-[#1e40af]" />
      </label>
      <label className="block text-sm font-extrabold text-slate-700">
        Nota interna (opcional)
        <textarea rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-[#1e40af]" />
      </label>
      {type === 'ban' && <p className="text-xs font-bold text-amber-800">El cierre queda pendiente hasta que otro administrador lo apruebe.</p>}
      <button type="submit" disabled={busy || reason.trim().length < 5 || (needsDays && level < 3 && !days)} className="h-11 w-full rounded-full bg-[#12315f] px-6 text-sm font-extrabold text-white disabled:opacity-50">{busy ? 'Aplicando…' : 'Aplicar medida'}</button>
    </form>
  );
}

// Ficha de una persona (historial, medidas, roles) y lista de medidas del sitio
export default function PeoplePanel({ level, focusUsername, focusReportId, onFocusUsed }) {
  const [search, setSearch] = useState('');
  const [username, setUsername] = useState('');
  const [profile, setProfile] = useState(null);
  const [list, setList] = useState(null);
  const [listStatus, setListStatus] = useState('pending_approval');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);

  const loadList = useCallback(() => {
    api.getAdminSanctions(listStatus).then((res) => setList(res.sanctions)).catch((err) => { setList([]); setError(err.message || 'No se pudo cargar la lista.'); });
  }, [listStatus]);
  useEffect(() => { loadList(); }, [loadList]);

  const loadProfile = useCallback((name) => {
    if (!name) return;
    setError('');
    setProfile(null);
    api.getUserModeration(name).then((res) => { setProfile(res); setUsername(name); }).catch((err) => { setUsername(''); setError(err.status === 404 ? 'No encontramos a esa persona.' : (err.message || 'No se pudo cargar la ficha.')); });
  }, []);

  useEffect(() => {
    if (focusUsername) { setSearch(focusUsername); loadProfile(focusUsername); onFocusUsed?.(); }
  }, [focusUsername, loadProfile, onFocusUsed]);

  const refresh = () => { loadList(); if (username) loadProfile(username); };

  const changeRole = async (role) => {
    setRoleBusy(true);
    setError('');
    try { await api.setStaffRole(username, role); loadProfile(username); } catch (err) { setError(err.message || 'No se pudo cambiar el rol.'); } finally { setRoleBusy(false); }
  };

  const counts = (group) => Object.entries(group || {}).map(([key, value]) => `${value} ${COUNT_LABELS[key] || key}`).join(' · ') || 'ninguno';

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-label="Buscar persona">
        <ErrorBox>{error}</ErrorBox>
        <form className="mb-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); loadProfile(search.trim().toLowerCase().replace(/^@/, '')); setShowForm(false); }}>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Usuario (sin @)" aria-label="Usuario" maxLength={20} className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#1e40af]" />
          <button type="submit" className="h-11 rounded-xl bg-[#1e40af] px-5 text-sm font-bold text-white">Buscar</button>
        </form>
        {username && !profile && <Spinner />}
        {profile && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-900/5">
              <p className="text-lg font-black text-[#12315f]">{profile.user.name || profile.user.username} <Link to={`/${profile.user.username}`} className="text-sm font-bold text-blue-700 underline-offset-2 hover:underline">@{profile.user.username}</Link></p>
              <p className="text-xs font-semibold text-slate-500">Rol: {profile.user.role} · Cuenta de {profile.user.ageDays} días · {profile.stats.completedSales} ventas · {profile.stats.completedPurchases} compras · {profile.stats.appeals} apelaciones</p>
              <p className="mt-1 text-xs text-slate-600">Reportes recibidos: {counts(profile.reportsReceived)}</p>
              <p className="text-xs text-slate-600">Reportes que hizo: {counts(profile.reportsMade)}</p>
              {profile.cases.length > 0 && <p className="mt-1 text-xs text-slate-600">Casos de estafa: {profile.cases.map((item) => `${item.shortCode} (${item.status})`).join(', ')}</p>}
              {level >= 3 && profile.user.role !== 'admin' && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Rol del equipo</span>
                  {[['user', 'Ninguno'], ['support', 'Soporte (lectura)'], ['moderator', 'Moderador']].map(([key, label]) => (
                    <button key={key} type="button" disabled={roleBusy || profile.user.role === key} onClick={() => changeRole(key)} className={`h-9 rounded-full px-3 text-xs font-extrabold ${profile.user.role === key ? 'bg-[#12315f] text-white' : 'bg-white text-[#12315f] ring-1 ring-slate-300'} disabled:opacity-60`}>{label}</button>
                  ))}
                </div>
              )}
            </div>
            {level >= 2 && !['admin', 'moderator', 'support'].includes(profile.user.role) && (
              showForm
                ? <SanctionForm username={profile.user.username} level={level} reportId={focusReportId} setError={setError} onDone={() => { setShowForm(false); refresh(); }} />
                : <button type="button" onClick={() => setShowForm(true)} className="h-11 w-full rounded-full bg-red-600 px-6 text-sm font-extrabold text-white">Aplicar una medida a esta cuenta</button>
            )}
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Historial de medidas</h3>
            {profile.sanctions.length === 0 ? <p className="text-sm font-semibold text-slate-500">Sin medidas.</p> : (
              <ul className="space-y-2">{profile.sanctions.map((item) => <SanctionRow key={item.id} sanction={item} level={level} onChanged={refresh} setError={setError} />)}</ul>
            )}
          </div>
        )}
      </section>

      <section aria-label="Medidas del sitio">
        <Pills label="Estado de las medidas" value={listStatus} onChange={setListStatus} options={[['pending_approval', 'Por aprobar'], ['active', 'Vigentes'], ['revoked', 'Levantadas'], ['expired', 'Vencidas']]} />
        {list === null ? <Spinner /> : list.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-900/5">No hay medidas en esta lista.</p>
        ) : (
          <ul className="space-y-2">{list.map((item) => <SanctionRow key={item.id} sanction={item} level={level} onChanged={refresh} setError={setError} />)}</ul>
        )}
      </section>
    </div>
  );
}
