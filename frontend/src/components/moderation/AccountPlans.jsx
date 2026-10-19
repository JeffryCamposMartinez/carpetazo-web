import { useState } from 'react';
import { api } from '../../services/api';
import ConfirmModal from '../ui/ConfirmModal';
import Select from '../ui/Select';
import { useToast } from '../ui/ToastProvider';
import NoticeField, { EMPTY_NOTICE, noticePayload } from './NoticeField';
import { dateOnly } from './shared';

const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 text-base sm:text-[15px] font-normal text-slate-800 outline-none focus:border-[#1e40af]';
const money = (value) => `$${Number(value).toLocaleString('es-CL')}`;
const toInput = (iso) => { if (!iso) return ''; const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const toIso = (local) => (local ? new Date(local).toISOString() : null);
const dateTime = (iso) => (iso ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—');
const SUB_STATUS = { active: 'Activa', pending: 'Pendiente de pago', past_due: 'Pago atrasado', paused: 'Pausada', canceled: 'Cancelada', expired: 'Vencida', failed: 'Fallida' };
const PAY_STATUS = { approved: 'Aprobado', authorized: 'Autorizado', rejected: 'Rechazado', pending: 'Pendiente', cancelled: 'Cancelado', refunded: 'Devuelto' };

function GrantRow({ grant, plans, username, onChanged }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [planKey, setPlanKey] = useState(grant.planKey);
  const [startsAt, setStartsAt] = useState(toInput(grant.startsAt));
  const [endsAt, setEndsAt] = useState(toInput(grant.endsAt));
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState(EMPTY_NOTICE);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api.editUserGrant(username, grant.id, { planKey, startsAt: toIso(startsAt), endsAt: toIso(endsAt), reason: reason.trim(), ...noticePayload(notice) });
      showToast('Plan asignado actualizado', 'success');
      setOpen(false);
      setReason('');
      onChanged();
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
      showToast(err.message || 'No se pudo guardar', 'error');
    } finally {
      setBusy(false);
    }
  };

  const state = grant.revokedAt ? 'Quitado' : grant.active ? 'Vigente' : new Date(grant.startsAt) > new Date() ? 'Programado' : 'Vencido';
  return (
    <li className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-[#12315f]">{grant.planName} <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${grant.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{state}</span></p>
        {!grant.revokedAt && <button type="button" onClick={() => setOpen((value) => !value)} className="h-9 rounded-lg px-3 text-sm font-extrabold text-[#1e40af] hover:bg-blue-50" aria-expanded={open}>{open ? 'Cerrar' : 'Editar'}</button>}
      </div>
      <p className="mt-1 text-xs text-slate-600">Desde {dateTime(grant.startsAt)} · hasta {grant.endsAt ? dateTime(grant.endsAt) : 'sin fecha de término'}{grant.revokedAt ? ` · quitado el ${dateOnly(grant.revokedAt)}` : ''}</p>
      <p className="mt-0.5 text-xs text-slate-500">Motivo: {grant.reason}{grant.grantedBy ? ` · por ${grant.grantedBy}` : ''}</p>
      {open && (
        <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); setConfirming(true); }}>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-800">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-bold text-slate-700">Plan
              <Select value={planKey} onChange={(event) => setPlanKey(event.target.value)} className={`${field} h-12`}>
                {plans.filter((plan) => plan.key !== 'free').map((plan) => <option key={plan.key} value={plan.key}>{plan.name}</option>)}
              </Select>
            </label>
            <label className="block text-sm font-bold text-slate-700">Inicio
              <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required className={`${field} h-12`} />
            </label>
            <label className="block text-sm font-bold text-slate-700">Término (vacío: sin fecha)
              <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className={`${field} h-12`} />
            </label>
          </div>
          <label className="block text-sm font-bold text-slate-700">Motivo (queda en la auditoría)
            <textarea rows={2} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} className={`${field} resize-none py-2`} />
          </label>
          <NoticeField id={`grant-${grant.id}`} value={notice} onChange={setNotice} />
          <button type="submit" disabled={busy || reason.trim().length < 5} className="h-11 rounded-full bg-[#12315f] px-6 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-[#1e40af] active:scale-[0.97] disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar cambios'}</button>
        </form>
      )}
      <ConfirmModal isOpen={confirming} title="Guardar cambios del plan" message={`Se actualiza el plan asignado a @${username}.${notice.notify ? ' La persona recibirá un aviso con lo que cambió.' : ' La persona no recibirá aviso.'} Quedará en la auditoría.`} confirmText="Guardar" cancelText="Volver" isDestructive={false} onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); save(); }} />
    </li>
  );
}

function SubscriptionRow({ sub, username, onChanged }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState(EMPTY_NOTICE);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancellable = ['active', 'past_due', 'paused', 'pending'].includes(sub.status) && !sub.cancelAtPeriodEnd;

  const cancel = async () => {
    setBusy(true);
    try {
      const result = await api.cancelUserSubscription(username, { reason: reason.trim(), ...noticePayload(notice) });
      showToast(result.endsAt ? `Suscripción cancelada: conserva el plan hasta el ${dateOnly(result.endsAt)}` : 'Suscripción cancelada', 'success');
      setOpen(false);
      setReason('');
      onChanged();
    } catch (err) {
      showToast(err.message || 'No se pudo cancelar la suscripción', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-[#12315f]">{sub.planName} · {money(sub.priceClp)}/mes <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-extrabold text-slate-700">{sub.cancelAtPeriodEnd ? 'Cancelada, vigente hasta el término' : SUB_STATUS[sub.status] || sub.status}</span></p>
        {cancellable && <button type="button" onClick={() => setOpen((value) => !value)} className="h-9 rounded-lg px-3 text-sm font-extrabold text-red-700 hover:bg-red-50" aria-expanded={open}>{open ? 'Cerrar' : 'Cancelar suscripción'}</button>}
      </div>
      <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-slate-600 sm:grid-cols-2">
        <div>Contratada: {dateTime(sub.createdAt)}</div>
        <div>Período actual: {dateOnly(sub.currentPeriodStart) || '—'} → {dateOnly(sub.currentPeriodEnd) || '—'}</div>
        <div>Próximo cobro: {sub.nextPaymentAt ? dateOnly(sub.nextPaymentAt) : '—'}</div>
        <div>{sub.canceledAt ? `Cancelada: ${dateTime(sub.canceledAt)}` : 'Sin cancelación'}</div>
        {sub.providerReference && <div>Referencia Mercado Pago: {sub.providerReference}</div>}
      </dl>
      {sub.payments?.length > 0 && (
        <details className="mt-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-bold text-[#1e40af]">Pagos ({sub.payments.length})</summary>
          <ul className="mt-1 space-y-0.5">{sub.payments.map((payment) => <li key={payment.id}>{dateTime(payment.paidAt || payment.createdAt)} · {money(payment.amountClp)} · {PAY_STATUS[payment.status] || payment.status}</li>)}</ul>
        </details>
      )}
      {open && (
        <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); setConfirming(true); }}>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">Se corta el cobro en Mercado Pago ahora. La persona conserva el plan hasta el fin del período ya pagado y no se puede reactivar: tendría que contratar de nuevo.</p>
          <label className="block text-sm font-bold text-slate-700">Motivo (queda en la auditoría)
            <textarea rows={2} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} className={`${field} resize-none py-2`} />
          </label>
          <NoticeField id={`sub-${sub.id}`} value={notice} onChange={setNotice} />
          <button type="submit" disabled={busy || reason.trim().length < 5} className="h-11 rounded-full bg-red-600 px-6 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-red-700 active:scale-[0.97] disabled:opacity-50">{busy ? 'Cancelando…' : 'Cancelar la suscripción'}</button>
        </form>
      )}
      <ConfirmModal isOpen={confirming} title="Cancelar la suscripción" message={`Vas a cancelar la suscripción ${sub.planName} de @${username}. ${notice.notify ? 'Recibirá un aviso.' : 'No recibirá aviso.'} Esto no se puede deshacer.`} confirmText="Sí, cancelar" cancelText="Volver" onCancel={() => setConfirming(false)} onConfirm={() => { setConfirming(false); cancel(); }} />
    </li>
  );
}

// Concesiones del equipo y suscripciones pagadas de una cuenta, con todas sus fechas
export default function AccountPlans({ details, plans, onChanged }) {
  const username = details.account.username;
  return (
    <div className="space-y-5">
      <div>
        <h4 className="mb-2 text-sm font-extrabold text-[#12315f]">Planes asignados por el equipo</h4>
        {details.grants.length ? <ul className="space-y-2">{details.grants.map((grant) => <GrantRow key={grant.id} grant={grant} plans={plans} username={username} onChanged={onChanged} />)}</ul> : <p className="text-sm text-slate-500">Nunca se le asignó un plan.</p>}
      </div>
      <div>
        <h4 className="mb-2 text-sm font-extrabold text-[#12315f]">Suscripciones pagadas</h4>
        {details.subscriptions.length ? <ul className="space-y-2">{details.subscriptions.map((sub) => <SubscriptionRow key={sub.id} sub={sub} username={username} onChanged={onChanged} />)}</ul> : <p className="text-sm text-slate-500">No tiene suscripciones.</p>}
      </div>
    </div>
  );
}
