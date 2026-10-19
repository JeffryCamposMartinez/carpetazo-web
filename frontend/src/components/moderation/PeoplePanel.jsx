import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { EmptyState, ErrorBox, Pills, QUICK_REASONS, ROW, SANCTION_TYPES, Spinner, dateOnly } from './shared';
import TermsEvidence from './TermsEvidence';
import PlanManager from './PlanManager';
import Select from '../ui/Select';
import ConfirmModal from '../ui/ConfirmModal';
import { useToast } from '../ui/ToastProvider';
import SvgIcon from '../ui/SvgIcon';

const STATUS = {
  active: { label: 'Vigente', bar: 'bg-red-600', text: 'text-red-700' },
  pending_approval: { label: 'Falta la segunda aprobación', bar: 'bg-amber-500', text: 'text-amber-800' },
  revoked: { label: 'Levantada', bar: 'bg-slate-300', text: 'text-slate-600' },
  expired: { label: 'Venció', bar: 'bg-slate-300', text: 'text-slate-600' }
};
const COUNT_LABELS = { open: 'pendientes', actioned: 'con medida', dismissed: 'descartados' };
const ROLE_LABELS = { user: 'Sin rol de equipo', coadmin: 'Co-administrador', support: 'Soporte', moderator: 'Moderador', admin: 'Administrador' };

function SanctionRow({ sanction, level, onChanged, setError, showUser }) {
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const status = STATUS[sanction.status] || STATUS.expired;
  const revoke = async () => {
    const note = window.prompt('Motivo para levantar la medida (mínimo 5 caracteres):');
    if (!note || note.trim().length < 5) return;
    setBusy(true);
    try { await api.revokeSanction(sanction.id, note.trim()); onChanged(); showToast(sanction.status === 'pending_approval' ? 'Medida rechazada' : 'Medida levantada', 'success'); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const approve = async () => {
    if (!window.confirm('¿Aprobar el cierre de esta cuenta? Es una medida grave: la persona queda sin poder escribir.')) return;
    setBusy(true);
    try { await api.approveSanction(sanction.id); onChanged(); showToast('Cierre de cuenta aprobado', 'success'); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const until = sanction.expiresAt ? `hasta el ${dateOnly(sanction.expiresAt)}` : sanction.type === 'warning' ? '' : 'sin fecha de término';
  return (
    <li className={`${ROW} mod-row-in p-4`}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[15px] font-extrabold leading-snug text-[#12315f]">{sanction.typeLabel}{showUser && sanction.user ? ` a @${sanction.user.username}` : ''}</p>
        <time dateTime={sanction.createdAt} className="shrink-0 pt-0.5 text-xs text-slate-500">{dateOnly(sanction.createdAt)}</time>
      </div>
      <p className="mt-1 text-sm leading-snug text-slate-700">{sanction.reason}</p>
      {sanction.note && <p className="mt-1 text-sm italic text-slate-500">Nota interna: {sanction.note}</p>}
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span className={`flex items-center gap-1.5 font-bold ${status.text}`}><span aria-hidden="true" className={`h-2 w-2 rounded-full ${status.bar}`} />{status.label}</span>
        {until && <span>{until}</span>}
        {sanction.automatic && <span className="font-bold text-purple-700">La aplicó el sistema</span>}
        <span>Por {sanction.createdBy || 'el equipo'}{sanction.approvedBy ? `, aprobada por ${sanction.approvedBy}` : ''}</span>
      </p>
      {level >= 3 && ['active', 'pending_approval'].includes(sanction.status) && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
          {sanction.status === 'pending_approval' && <button type="button" disabled={busy} onClick={approve} className="h-11 rounded-full bg-red-600 px-5 text-sm font-extrabold text-white disabled:opacity-50">Aprobar cierre</button>}
          <button type="button" disabled={busy} onClick={revoke} className="h-11 rounded-full border-2 border-slate-400 px-5 text-sm font-extrabold text-slate-700 disabled:opacity-50">{sanction.status === 'pending_approval' ? 'Rechazar' : 'Levantar'}</button>
        </div>
      )}
    </li>
  );
}

function SanctionForm({ username, level, reportId, onDone, onCancel, setError }) {
  const [type, setType] = useState('warning');
  const [days, setDays] = useState('7');
  const [reason, setReason] = useState(QUICK_REASONS.warning);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { showToast } = useToast();
  const needsDays = type !== 'warning' && type !== 'ban';
  const typeLabel = (SANCTION_TYPES.find(([key]) => key === type)?.[1] || 'Medida').replace(/ \(.*\)$/, '');
  const types = SANCTION_TYPES.filter(([key]) => key !== 'ban' || level >= 3);
  const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 text-base sm:text-[15px] font-normal text-slate-800 outline-none focus:border-[#1e40af]';

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await api.applySanction(username, { type, reason: reason.trim(), note: note.trim() || undefined, durationDays: needsDays && days ? Number(days) : undefined, reportId });
      onDone();
      showToast(type === 'ban' ? `Cierre de @${username} pedido: falta la aprobación de otro administrador` : `${typeLabel} aplicada a @${username}`, 'success');
    } catch (err) {
      setError(err.message || 'No se pudo aplicar la medida.');
      showToast(err.message || 'No se pudo aplicar la medida', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <form onSubmit={(event) => { event.preventDefault(); setConfirming(true); }} className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-900/10">
      <h3 className="text-base font-extrabold text-[#12315f]">Aplicar una medida a @{username}</h3>
      <label className="block text-sm font-bold text-slate-700">Tipo de medida
        <Select value={type} onChange={(event) => { setType(event.target.value); setReason(QUICK_REASONS[event.target.value]); }} className={`${field} h-12`}>
          {types.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </Select>
      </label>
      {needsDays && (
        <label className="block text-sm font-bold text-slate-700">Cuántos días{level < 3 ? ' (máximo 30)' : ' (vacío: hasta nuevo aviso)'}
          <input type="number" min="1" max={level >= 3 ? 365 : 30} value={days} onChange={(event) => setDays(event.target.value)} className={`${field} h-12`} />
        </label>
      )}
      <label className="block text-sm font-bold text-slate-700">Motivo que verá la persona
        <textarea rows={3} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} className={`${field} resize-none py-2`} />
      </label>
      <label className="block text-sm font-bold text-slate-700">Nota interna (opcional)
        <textarea rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className={`${field} resize-none py-2`} />
      </label>
      {type === 'ban' && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">El cierre queda pendiente hasta que otro administrador lo apruebe.</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="h-12 rounded-full border-2 border-slate-300 px-5 text-sm font-extrabold text-slate-700">Cancelar</button>
        <button type="submit" disabled={busy || reason.trim().length < 5 || (needsDays && level < 3 && !days)} className="h-12 rounded-full bg-[#12315f] px-5 text-sm font-extrabold text-white disabled:opacity-50">{busy ? 'Aplicando…' : 'Aplicar medida'}</button>
      </div>
    </form>
    <ConfirmModal
      isOpen={confirming}
      title={type === 'ban' ? 'Pedir el cierre de la cuenta' : `Aplicar: ${typeLabel}`}
      message={`Vas a aplicar «${typeLabel}» a @${username}${needsDays && days ? ` por ${days} días` : ''}. La persona verá el motivo y quedará en la auditoría.${type === 'ban' ? ' El cierre queda pendiente hasta que otro administrador lo apruebe.' : ''}`}
      confirmText="Aplicar medida"
      cancelText="Volver"
      onCancel={() => setConfirming(false)}
      onConfirm={() => { setConfirming(false); submit(); }}
    />
    </>
  );
}

const Stat = ({ value, label }) => (
  <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
    <p className="text-xl font-extrabold tabular-nums text-[#12315f]">{value}</p>
    <p className="text-xs text-slate-500">{label}</p>
  </div>
);

// Ficha de una persona (historial, medidas, roles) y lista de medidas del sitio
export default function PeoplePanel({ level, focusUsername, focusReportId, onFocusUsed, onOpenAccount }) {
  const [search, setSearch] = useState('');
  const [username, setUsername] = useState('');
  const [profile, setProfile] = useState(null);
  const [list, setList] = useState(null);
  const [listStatus, setListStatus] = useState('pending_approval');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const [matches, setMatches] = useState([]);
  const [rolePending, setRolePending] = useState(null);
  const [coAdminTyped, setCoAdminTyped] = useState(null); // null = cerrado; texto = confirmación escribiendo el usuario
  const { showToast } = useToast();
  const [searching, setSearching] = useState(false);

  const loadList = useCallback(() => {
    api.getAdminSanctions(listStatus).then((res) => setList(res.sanctions)).catch((err) => { setList([]); setError(err.message || 'No se pudo cargar la lista.'); });
  }, [listStatus]);
  useEffect(() => { setList(null); loadList(); }, [loadList]);

  const loadProfile = useCallback((name) => {
    if (!name) return;
    setError('');
    setProfile(null);
    api.getUserModeration(name).then((res) => { setProfile(res); setUsername(name); }).catch((err) => { setUsername(''); setError(err.status === 404 ? 'No encontramos a esa persona. Escribe su usuario sin la @.' : (err.message || 'No se pudo cargar la ficha.')); });
  }, []);

  useEffect(() => {
    if (focusUsername) { setSearch(focusUsername); loadProfile(focusUsername); onFocusUsed?.(); }
  }, [focusUsername, loadProfile, onFocusUsed]);

  const cleanQuery = search.trim().toLowerCase().replace(/^@/, '');

  // Mientras se escribe se sugieren personas con un nombre parecido (con una pequeña espera para no consultar en cada letra)
  useEffect(() => {
    if (cleanQuery.length < 2 || cleanQuery === username) { setMatches([]); return undefined; }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      api.searchUsersModeration(cleanQuery).then((res) => { if (!cancelled) setMatches(res.users || []); }).catch(() => { if (!cancelled) setMatches([]); }).finally(() => { if (!cancelled) setSearching(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [cleanQuery, username]);

  const pickMatch = (name) => { setSearch(name); setMatches([]); setShowForm(false); loadProfile(name); };

  const submitSearch = async (event) => {
    event.preventDefault();
    setShowForm(false);
    if (!cleanQuery) return;
    setError('');
    try {
      const { users = [] } = await api.searchUsersModeration(cleanQuery);
      if (users.some((user) => user.username === cleanQuery)) return pickMatch(cleanQuery);
      setProfile(null);
      setUsername('');
      setMatches(users);
      if (!users.length) setError('No encontramos a nadie con un nombre parecido.');
    } catch (err) {
      setError(err.message || 'No se pudo buscar.');
    }
  };

  const refresh = () => { loadList(); if (username) loadProfile(username); };

  const changeRole = async (role) => {
    setRoleBusy(true);
    setError('');
    try { await api.setStaffRole(username, role); loadProfile(username); showToast(`@${username}: ${ROLE_LABELS[role] || role}`, 'success'); } catch (err) { setError(err.message || 'No se pudo cambiar el rol.'); } finally { setRoleBusy(false); }
  };

  // El rol de co-administrador (poderes de administrador) pide escribir el usuario, igual que en la pestaña Equipo
  const grantCoAdmin = async () => {
    const typed = coAdminTyped;
    setCoAdminTyped(null);
    setRoleBusy(true);
    setError('');
    try {
      const found = (await api.searchTeamPeople(username)).people?.find((person) => person.username?.toLowerCase() === username.toLowerCase());
      if (!found) throw new Error('No se encontró a la persona.');
      await api.setTeamRole(found.id, 'coadmin', typed);
      loadProfile(username);
      showToast(`@${username}: Co-administrador`, 'success');
    } catch (err) { setError(err.message || 'No se pudo dar el rol de co-administrador.'); } finally { setRoleBusy(false); }
  };

  const counts = (group) => Object.entries(group || {}).map(([key, value]) => `${value} ${COUNT_LABELS[key] || key}`).join(', ') || 'ninguno';
  const canSanction = level >= 2 && profile && !['admin', 'coadmin', 'moderator', 'support'].includes(profile.user.role);

  return (
    <div className="space-y-6 xl:grid xl:grid-cols-2 xl:items-start xl:gap-6 xl:space-y-0">
      <section aria-label="Ficha de una persona">
        <h2 className="mb-2 px-1 text-base font-extrabold text-[#12315f]">Buscar a una persona</h2>
        <form className="mb-3 flex gap-2" onSubmit={submitSearch}>
          <div className="relative min-w-0 flex-1">
            <SvgIcon name="person_search" translate="no" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Usuario o nombre, sin la @" aria-label="Usuario o nombre" maxLength={30} className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-base sm:text-[15px] text-slate-800 outline-none focus:border-[#1e40af]" />
          </div>
          <button type="submit" className="h-12 shrink-0 rounded-xl bg-[#1e40af] px-5 text-sm font-bold text-white">Buscar</button>
        </form>
        <ErrorBox>{error}</ErrorBox>
        {(matches.length > 0 || searching) && (
          <div className="mb-3 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/5" role="listbox" aria-label="Personas con un nombre parecido">
            <p className="px-4 pt-3 text-xs font-bold text-slate-500">{searching && !matches.length ? 'Buscando…' : 'Personas con un nombre parecido'}</p>
            <ul className="divide-y divide-slate-100">
              {matches.map((user) => (
                <li key={user.username}>
                  <button type="button" role="option" aria-selected="false" onClick={() => pickMatch(user.username)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none">
                    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#12315f] text-sm font-extrabold text-[#facc15]">{(user.name || user.username).charAt(0).toUpperCase()}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-[#12315f]">{user.name || user.username}</span><span className="block truncate text-xs text-slate-500">@{user.username} · hace {user.ageDays} {user.ageDays === 1 ? 'día' : 'días'}</span></span>
                    {['admin', 'coadmin', 'moderator', 'support'].includes(user.role) && <span className="shrink-0 rounded-full bg-[#facc15] px-2 py-0.5 text-[11px] font-extrabold text-[#12315f]">Equipo</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {username && !profile && <Spinner />}
        {!username && !profile && !error && <p className="rounded-2xl bg-white/60 px-5 py-8 text-center text-sm text-slate-600">Busca por usuario para ver su historial de reportes, sus medidas y aplicar una nueva.</p>}

        {profile && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#12315f] text-lg font-extrabold text-[#facc15]">{(profile.user.name || profile.user.username || '?').charAt(0).toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="truncate text-lg font-extrabold leading-tight text-[#12315f]">{profile.user.name || profile.user.username}</p>
                  <Link to={`/${profile.user.username}`} className="text-sm font-bold text-[#1e40af] underline-offset-2 hover:underline">@{profile.user.username}</Link>
                  {level >= 3 && onOpenAccount && <button type="button" onClick={() => onOpenAccount(profile.user.username)} className="ml-3 text-sm font-bold text-slate-600 underline-offset-2 hover:text-[#1e40af] hover:underline">Ver cuenta completa</button>}
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600">{ROLE_LABELS[profile.user.role] || profile.user.role}. Cuenta creada hace {profile.user.ageDays} días.</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat value={profile.stats.completedSales} label="ventas" />
                <Stat value={profile.stats.completedPurchases} label="compras" />
                <Stat value={profile.stats.appeals} label="apelaciones" />
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex gap-2"><dt className="shrink-0 font-bold text-slate-500">Reportes recibidos</dt><dd className="text-slate-700">{counts(profile.reportsReceived)}</dd></div>
                <div className="flex gap-2"><dt className="shrink-0 font-bold text-slate-500">Reportes que hizo</dt><dd className="text-slate-700">{counts(profile.reportsMade)}</dd></div>
                {profile.cases.length > 0 && <div className="flex gap-2"><dt className="shrink-0 font-bold text-slate-500">Casos de estafa</dt><dd className="text-slate-700">{profile.cases.map((item) => `${item.shortCode} (${item.status})`).join(', ')}</dd></div>}
              </dl>
              {level >= 3 && !['admin', 'coadmin'].includes(profile.user.role) && (
                <fieldset className="mt-4">
                  <legend className="mb-1.5 text-sm font-bold text-slate-500">Rol en el equipo</legend>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {[['user', 'Ninguno'], ['support', 'Soporte'], ['moderator', 'Moderador'], ['coadmin', 'Co-administrador']].map(([key, label]) => (
                      <button key={key} type="button" disabled={roleBusy || profile.user.role === key} aria-pressed={profile.user.role === key} onClick={() => (key === 'coadmin' ? setCoAdminTyped('') : setRolePending(key))} className={`h-10 rounded-full text-sm font-bold ${profile.user.role === key ? 'bg-[#12315f] text-white' : 'bg-white text-[#12315f] ring-1 ring-slate-300'} disabled:opacity-100`}>{label}</button>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>

            {level >= 3 && <PlanManager username={profile.user.username} setError={setError} />}

            {canSanction && (showForm
              ? <SanctionForm username={profile.user.username} level={level} reportId={focusReportId} setError={setError} onCancel={() => setShowForm(false)} onDone={() => { setShowForm(false); refresh(); }} />
              : <button type="button" onClick={() => setShowForm(true)} className="h-12 w-full rounded-full bg-red-600 px-6 text-sm font-extrabold text-white">Aplicar una medida a esta cuenta</button>)}

            <h3 className="px-1 pt-2 text-base font-extrabold text-[#12315f]">Historial de medidas</h3>
            {profile.sanctions.length === 0 ? <p className="px-1 text-sm text-slate-600">Esta persona no tiene medidas.</p> : (
              <ul className="space-y-2">{profile.sanctions.map((item) => <SanctionRow key={item.id} sanction={item} level={level} onChanged={refresh} setError={setError} />)}</ul>
            )}
          </div>
        )}
      </section>

      <section aria-label="Medidas del sitio">
        <h2 className="mb-2 px-1 text-base font-extrabold text-[#12315f]">Medidas en todo el sitio</h2>
        <Pills label="Estado de las medidas" value={listStatus} onChange={setListStatus} options={[['pending_approval', 'Por aprobar'], ['active', 'Vigentes'], ['revoked', 'Levantadas'], ['expired', 'Vencidas']]} />
        {list === null ? <Spinner /> : list.length === 0 ? (
          <EmptyState icon="verified_user" title={listStatus === 'pending_approval' ? 'No hay cierres por aprobar' : 'No hay medidas en esta lista'}>
            {listStatus === 'pending_approval' ? 'Cuando un administrador pida cerrar una cuenta, otro debe aprobarlo desde aquí.' : 'Las medidas aparecen aquí a medida que se aplican.'}
          </EmptyState>
        ) : (
          <ul className="space-y-2">{list.map((item) => <SanctionRow key={item.id} sanction={item} level={level} onChanged={refresh} setError={setError} showUser />)}</ul>
        )}
      </section>

      {level >= 3 && <TermsEvidence key={username} initialUsername={username} />}

      {coAdminTyped !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setCoAdminTyped(null); }}>
          <form role="dialog" aria-modal="true" aria-labelledby="coadmin-title" onSubmit={(event) => { event.preventDefault(); if (coAdminTyped.trim().replace(/^@/, '').toLowerCase() === username.toLowerCase()) grantCoAdmin(); }} className="w-full max-w-sm rounded-2xl border border-[#285896] bg-[#142e55] p-6 shadow-2xl">
            <h3 id="coadmin-title" className="text-xl font-bold text-white">Dar rol de co-administrador</h3>
            <p className="mt-2 text-sm text-[#e0e7ff]/90">@{username} tendrá los poderes de un administrador, pero no podrá actuar sobre administradores, otros co-administradores ni la cuenta propietaria. Queda en la auditoría y se le avisa.</p>
            <label className="mt-4 block text-sm font-bold text-[#e0e7ff]">Para confirmar, escribe <span className="text-[#ffcb05]">@{username}</span>
              <input autoFocus value={coAdminTyped} onChange={(event) => setCoAdminTyped(event.target.value)} autoComplete="off" className="mt-1.5 h-11 w-full rounded-lg border border-[#285896] bg-white px-3 text-base font-semibold text-[#12315f] outline-none focus:border-[#ffcb05]" />
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setCoAdminTyped(null)} className="rounded-lg px-4 py-2 text-sm font-bold text-[#e0e7ff] hover:bg-[#1a3b68]">Volver</button>
              <button type="submit" disabled={coAdminTyped.trim().replace(/^@/, '').toLowerCase() !== username.toLowerCase()} className="rounded-lg bg-[#ffcb05] px-4 py-2 text-sm font-bold text-[#001a4d] disabled:opacity-40">Dar el rol</button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(rolePending)}
        title="Cambiar el rol en el equipo"
        message={`@${username} pasará de «${ROLE_LABELS[profile?.user.role] || 'Sin rol de equipo'}» a «${ROLE_LABELS[rolePending] || rolePending}». Cambia lo que puede ver y hacer en Moderación, y queda en la auditoría.`}
        confirmText="Cambiar rol"
        cancelText="Volver"
        isDestructive={rolePending === 'admin'}
        onCancel={() => setRolePending(null)}
        onConfirm={() => { const role = rolePending; setRolePending(null); changeRole(role); }}
      />
    </div>
  );
}
