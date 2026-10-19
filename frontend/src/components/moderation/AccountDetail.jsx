import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import ConfirmModal from '../ui/ConfirmModal';
import { useToast } from '../ui/ToastProvider';
import AccountPlans from './AccountPlans';
import NoticeField, { EMPTY_NOTICE, noticePayload } from './NoticeField';
import PlanManager from './PlanManager';
import { ErrorBox, Spinner, dateOnly } from './shared';

const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 text-base sm:text-[15px] font-normal text-slate-800 outline-none focus:border-[#1e40af]';
const ROLE = { admin: 'Administrador', moderator: 'Moderador', support: 'Soporte', user: 'Sin rol de equipo', deleted: 'Cuenta borrada' };
const SOURCE = { grant: 'Plan asignado por el equipo', subscription: 'Suscripción pagada', default: 'Plan gratuito por defecto' };
const SANCTION = { warning: 'Advertencia', restrict_messages: 'Mensajes restringidos', suspend_selling: 'Ventas suspendidas', suspend: 'Cuenta suspendida', ban: 'Cuenta cerrada' };
const ACTION = { 'plan.granted': 'Plan asignado', 'plan.revoked': 'Plan quitado', 'plan.grant_edited': 'Plan editado', 'user.profile_edited': 'Datos editados', 'subscription.canceled_by_staff': 'Suscripción cancelada', 'user.notice_sent': 'Aviso enviado', 'role.changed': 'Rol cambiado' };
const dateTime = (iso) => (iso ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—');

const Card = ({ title, children, id }) => (
  <section aria-labelledby={id} className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
    <h3 id={id} className="text-base font-extrabold text-[#12315f]">{title}</h3>
    {children}
  </section>
);
const Stat = ({ value, label }) => (
  <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
    <p className="text-xl font-extrabold tabular-nums text-[#12315f]">{value}</p>
    <p className="text-xs text-slate-500">{label}</p>
  </div>
);
const Item = ({ label, children }) => <div><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="text-sm font-semibold text-slate-800 break-words">{children}</dd></div>;

function ProfileEditor({ account, onChanged }) {
  const { showToast } = useToast();
  const [name, setName] = useState(account.name || '');
  const [username, setUsername] = useState(account.username);
  const [bio, setBio] = useState(account.bio || '');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState(EMPTY_NOTICE);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = name !== (account.name || '') || username !== account.username || bio !== (account.bio || '');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const payload = { reason: reason.trim(), ...noticePayload(notice) };
      if (name !== (account.name || '')) payload.name = name;
      if (username !== account.username) payload.username = username;
      if (bio !== (account.bio || '')) payload.bio = bio;
      const result = await api.updateUserProfile(account.username, payload);
      showToast('Datos de la cuenta actualizados', 'success');
      setReason('');
      onChanged(result.username);
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
      showToast(err.message || 'No se pudo guardar', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); setConfirming(true); }}>
      <ErrorBox>{error}</ErrorBox>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold text-slate-700">Nombre<input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} className={`${field} h-12`} /></label>
        <label className="block text-sm font-bold text-slate-700">Usuario (sin @)<input value={username} maxLength={20} onChange={(event) => setUsername(event.target.value)} className={`${field} h-12`} /></label>
      </div>
      <label className="block text-sm font-bold text-slate-700">Presentación<textarea rows={2} maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} className={`${field} resize-none py-2`} /></label>
      {dirty && (
        <>
          <label className="block text-sm font-bold text-slate-700">Motivo (queda en la auditoría)<textarea rows={2} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} className={`${field} resize-none py-2`} /></label>
          <NoticeField id="perfil" value={notice} onChange={setNotice} />
        </>
      )}
      <button type="submit" disabled={busy || !dirty || reason.trim().length < 5} className="h-11 rounded-full bg-[#12315f] px-6 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-[#1e40af] active:scale-[0.97] disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar datos'}</button>
      <ConfirmModal isOpen={confirming} title="Guardar datos de la cuenta" message={`Se cambian los datos de @${account.username}. ${notice.notify ? 'La persona recibirá un aviso con lo que cambió.' : 'La persona no recibirá aviso.'} Quedará en la auditoría.`} confirmText="Guardar" cancelText="Volver" isDestructive={false} onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); save(); }} />
    </form>
  );
}

function NoticeSender({ username, onSent }) {
  const { showToast } = useToast();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await api.notifyUser(username, message.trim());
      showToast(`Aviso enviado a @${username}`, 'success');
      setMessage('');
      onSent();
    } catch (err) {
      showToast(err.message || 'No se pudo enviar el aviso', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); setConfirming(true); }}>
      <label className="block text-sm font-bold text-slate-700">Mensaje para la persona
        <textarea rows={3} maxLength={600} value={message} onChange={(event) => setMessage(event.target.value)} className={`${field} resize-none py-2`} />
        <span className="mt-1 block text-xs font-medium text-slate-500">Llega a su bandeja de mensajes, a su correo y como notificación del navegador. {message.length}/600</span>
      </label>
      <button type="submit" disabled={busy || message.trim().length < 5} className="h-11 rounded-full bg-[#1e40af] px-6 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-[#12315f] active:scale-[0.97] disabled:opacity-50">{busy ? 'Enviando…' : 'Enviar aviso'}</button>
      <ConfirmModal isOpen={confirming} title="Enviar aviso" message={`Se enviará este mensaje a @${username}. Quedará en la auditoría.`} confirmText="Enviar" cancelText="Volver" isDestructive={false} onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); send(); }} />
    </form>
  );
}

// Sección «Cuenta completa»: todo lo que se sabe de una persona, sus planes con todas las fechas, y el control para cambiarlo
export default function AccountDetail({ focusUsername, onFocusUsed }) {
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState([]);
  const [details, setDetails] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.getPlans().then((res) => setPlans(res.plans || [])).catch(() => {}); }, []);

  const load = useCallback((name) => {
    if (!name) return;
    setError('');
    setLoading(true);
    api.getUserDetails(name).then((res) => { setDetails(res); setSearch(name); setMatches([]); }).catch((err) => { setDetails(null); setError(err.status === 404 ? 'No encontramos a esa persona.' : (err.message || 'No se pudo cargar la ficha.')); }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (focusUsername) { load(focusUsername); onFocusUsed?.(); } }, [focusUsername, load, onFocusUsed]);

  const clean = search.trim().toLowerCase().replace(/^@/, '');
  useEffect(() => {
    if (clean.length < 2 || clean === details?.account.username) { setMatches([]); return undefined; }
    let cancelled = false;
    const timer = setTimeout(() => { api.searchUsersModeration(clean).then((res) => { if (!cancelled) setMatches(res.users || []); }).catch(() => { if (!cancelled) setMatches([]); }); }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [clean, details]);

  const submit = async (event) => {
    event.preventDefault();
    if (!clean) return;
    try {
      const { users = [] } = await api.searchUsersModeration(clean);
      if (users.some((user) => user.username === clean) || users.length === 1) return load(users.find((user) => user.username === clean)?.username || users[0].username);
      setMatches(users);
      setError(users.length ? '' : 'No encontramos a nadie con un nombre parecido.');
    } catch (err) { setError(err.message || 'No se pudo buscar.'); }
  };
  const refresh = (nextUsername) => load(nextUsername || details.account.username);

  const account = details?.account;
  return (
    <div className="space-y-4">
      <form className="flex gap-2" onSubmit={submit}>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Usuario o nombre, sin la @" aria-label="Buscar a una persona" maxLength={30} className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-800 outline-none focus:border-[#1e40af] sm:text-[15px]" />
        <button type="submit" className="h-12 shrink-0 rounded-xl bg-[#1e40af] px-5 text-sm font-bold text-white">Buscar</button>
      </form>
      <ErrorBox>{error}</ErrorBox>
      {matches.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-900/5" aria-label="Personas con un nombre parecido">
          {matches.map((user) => (
            <li key={user.username}><button type="button" onClick={() => load(user.username)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 focus-visible:bg-blue-50 focus-visible:outline-none">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#12315f] text-sm font-extrabold text-[#facc15]">{(user.name || user.username).charAt(0).toUpperCase()}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-extrabold text-[#12315f]">{user.name || user.username}</span><span className="block truncate text-xs text-slate-500">@{user.username}</span></span>
            </button></li>
          ))}
        </ul>
      )}
      {loading && <Spinner label="Cargando la ficha…" />}
      {!account && !loading && !error && <p className="rounded-2xl bg-white/60 px-5 py-10 text-center text-sm text-slate-600">Busca a una persona para ver todos sus datos, sus planes con todas las fechas y cambiar lo que haga falta. Cada cambio le llega como aviso.</p>}

      {account && !loading && (
        <div className="space-y-4 xl:grid xl:grid-cols-2 xl:items-start xl:gap-4 xl:space-y-0">
          <div className="space-y-4">
            <Card id="cuenta" title="Cuenta">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#12315f] text-lg font-extrabold text-[#facc15]">{(account.name || account.username).charAt(0).toUpperCase()}</span>
                <div className="min-w-0"><p className="truncate text-lg font-extrabold leading-tight text-[#12315f]">{account.name || account.username}</p><p className="text-sm font-bold text-[#1e40af]">@{account.username}</p></div>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Item label="Correo">{account.email}{account.emailVerified ? ' · verificado' : ' · sin verificar'}</Item>
                <Item label="Rol">{ROLE[account.role] || account.role}{account.isOwner ? ' · propietaria' : ''}</Item>
                <Item label="Cuenta creada">{dateTime(account.createdAt)}</Item>
                <Item label="Última actividad">{dateTime(account.lastSeenAt)}</Item>
                <Item label="Ubicación pública">{[account.comuna, account.region].filter(Boolean).join(', ') || '—'}</Item>
                <Item label="Notificaciones del navegador">{account.pushDevices ? `${account.pushDevices} ${account.pushDevices === 1 ? 'dispositivo' : 'dispositivos'}` : 'ninguno'}</Item>
              </dl>
              <h4 className="pt-1 text-sm font-extrabold text-[#12315f]">Editar datos</h4>
              <ProfileEditor key={`${account.username}-${account.updatedAt}`} account={account} onChanged={refresh} />
            </Card>
            <Card id="actividad" title="Actividad">
              <div className="grid grid-cols-3 gap-2">
                <Stat value={details.activity.folders} label="carpetas" />
                <Stat value={details.activity.cards} label="cartas" />
                <Stat value={details.activity.completedSales} label="ventas hechas" />
                <Stat value={details.activity.purchases} label="compras" />
                <Stat value={details.activity.reviewsReceived} label="reseñas" />
                <Stat value={details.activity.openReportsAgainstThem} label="reportes abiertos" />
              </div>
            </Card>
            <Card id="avisar" title="Enviar un aviso"><NoticeSender username={account.username} onSent={refresh} /></Card>
          </div>
          <div className="space-y-4">
            <Card id="plan" title="Plan">
              <p className="text-sm text-slate-700"><strong className="text-[#12315f]">{details.plan.name}</strong> · {SOURCE[details.plan.source]}{details.plan.source === 'grant' && details.plan.grant ? (details.plan.grant.endsAt ? ` · hasta el ${dateOnly(details.plan.grant.endsAt)}` : ' · sin fecha de término') : ''}</p>
              <PlanManager username={account.username} setError={setError} onChanged={refresh} />
              <AccountPlans details={details} plans={plans} onChanged={refresh} />
            </Card>
            <Card id="medidas" title="Medidas">
              {details.sanctions.length ? <ul className="space-y-1.5">{details.sanctions.map((row) => <li key={row.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200"><strong className="text-[#12315f]">{SANCTION[row.type] || row.type}</strong> · {row.status} · {dateOnly(row.createdAt)}{row.expiresAt ? ` → ${dateOnly(row.expiresAt)}` : ''}<span className="block text-xs text-slate-500">{row.reason}</span></li>)}</ul> : <p className="text-sm text-slate-500">Sin medidas.</p>}
            </Card>
            <Card id="historial" title="Historial de cambios del equipo">
              {details.history.length ? <ul className="space-y-1.5">{details.history.map((row) => <li key={row.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200"><strong className="text-[#12315f]">{ACTION[row.action] || row.action}</strong> · {dateTime(row.createdAt)}{row.by ? ` · ${row.by}` : ''}<span className="block text-xs text-slate-500">{row.note}</span></li>)}</ul> : <p className="text-sm text-slate-500">Todavía no hay cambios registrados.</p>}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
