import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import Select from '../ui/Select';
import ConfirmModal from '../ui/ConfirmModal';
import { useToast } from '../ui/ToastProvider';
import { dateOnly } from './shared';

const SOURCE_TEXT = { grant: 'Plan asignado por el equipo', subscription: 'Suscripción pagada', default: 'Plan gratuito por defecto' };
const money = (value) => (value ? `$${value.toLocaleString('es-CL')}` : 'Gratis');
const field = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 text-base sm:text-[15px] font-normal text-slate-800 outline-none focus:border-[#1e40af]';

// Plan de una persona dentro de la ficha (solo administradores). Una concesión manual manda sobre la suscripción.
export default function PlanManager({ username, setError }) {
  const [state, setState] = useState(null);
  const [plans, setPlans] = useState([]);
  const [planKey, setPlanKey] = useState('premium');
  const [days, setDays] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const { showToast } = useToast();

  const load = useCallback(() => {
    api.getUserPlan(username).then(setState).catch((err) => setError(err.message || 'No se pudo cargar el plan.'));
  }, [username, setError]);
  useEffect(() => { setState(null); load(); }, [load]);
  useEffect(() => { api.getPlans().then((res) => setPlans(res.plans || [])).catch(() => {}); }, []);

  const submit = async (key) => {
    setBusy(true);
    setError('');
    try {
      await api.setUserPlan(username, { planKey: key, reason: reason.trim(), days: key !== 'auto' && days ? Number(days) : undefined });
      setReason('');
      setDays('');
      load();
      showToast(key === 'auto' ? `Plan asignado quitado a @${username}` : `Plan ${plans.find((plan) => plan.key === key)?.name || key} asignado a @${username}`, 'success');
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el plan.');
      showToast(err.message || 'No se pudo cambiar el plan', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!state) return <div className="h-24 animate-pulse rounded-2xl bg-white ring-1 ring-slate-900/5" aria-label="Cargando plan" />;
  const grant = state.source === 'grant' ? state.grant : null;
  const ready = reason.trim().length >= 5 && !busy;

  return (
    <section aria-label="Plan de la persona" className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-900/5">
      <h3 className="text-base font-extrabold text-[#12315f]">Plan de @{username}</h3>
      <p className="text-sm text-slate-700">
        <strong className="text-[#12315f]">{state.plan.name}</strong> · {SOURCE_TEXT[state.source]}
        {grant?.endsAt ? ` · hasta el ${dateOnly(grant.endsAt)}` : grant ? ' · sin fecha de término' : ''}
      </p>
      <p className="text-xs text-slate-500">Usa {state.usage.folders} {state.usage.folders === 1 ? 'carpeta' : 'carpetas'}. Cambiar el plan no borra nada de lo que ya tiene.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold text-slate-700">Plan
          <Select value={planKey} onChange={(event) => setPlanKey(event.target.value)} className={`${field} h-12`}>
            {(plans.length ? plans : [{ key: 'premium', name: 'Premium' }]).filter((plan) => plan.key !== 'free').map((plan) => <option key={plan.key} value={plan.key}>{plan.name} · {money(plan.priceClp)}</option>)}
          </Select>
        </label>
        <label className="block text-sm font-bold text-slate-700">Días (vacío: sin fecha de término)
          <input type="number" inputMode="numeric" min="1" max="3650" value={days} onChange={(event) => setDays(event.target.value)} className={`${field} h-12`} />
        </label>
      </div>
      <label className="block text-sm font-bold text-slate-700">Motivo (queda en la auditoría)
        <textarea rows={2} maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} className={`${field} resize-none py-2`} />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" disabled={!ready} onClick={() => setPending(planKey)} className="h-12 rounded-full bg-[#12315f] px-5 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-[#1e40af] disabled:opacity-50">{busy ? 'Guardando…' : 'Asignar plan'}</button>
        <button type="button" disabled={!ready || !grant} onClick={() => setPending('auto')} className="h-12 rounded-full border-2 border-slate-300 px-5 text-sm font-extrabold text-slate-700 transition-[background-color,transform] duration-150 active:scale-[0.97] hover:bg-slate-50 disabled:opacity-50">Quitar plan asignado</button>
      </div>
      <ConfirmModal
        isOpen={Boolean(pending)}
        title={pending === 'auto' ? 'Quitar el plan asignado' : 'Asignar plan'}
        message={pending === 'auto'
          ? `@${username} vuelve a su plan automático (${state.subscription ? 'su suscripción' : 'Free'}). No se borra nada de lo que ya tiene. Quedará en la auditoría.`
          : `@${username} pasará a ${plans.find((plan) => plan.key === pending)?.name || pending} ${days ? `por ${days} días` : 'sin fecha de término'}, sin cobro. Quedará en la auditoría.`}
        confirmText={pending === 'auto' ? 'Quitar plan' : 'Asignar plan'}
        cancelText="Volver"
        isDestructive={pending === 'auto'}
        onCancel={() => setPending(null)}
        onConfirm={() => { const key = pending; setPending(null); submit(key); }}
      />
    </section>
  );
}
