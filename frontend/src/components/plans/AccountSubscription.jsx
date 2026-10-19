import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import LoadingState from '../ui/LoadingState';
import { useToast } from '../ui/ToastProvider';
import SubscriptionPanel, { GrantNote, formatDate } from './SubscriptionPanel';

// "Mi cuenta → Plan": el mismo panel de Tu suscripción de /planes, para ver el estado y cancelar sin salir de la cuenta.
export default function AccountSubscription() {
  const { showToast } = useToast();
  const [billing, setBilling] = useState(null);
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const [state, catalog] = await Promise.all([api.getBillingMe(), api.getPlans()]);
    setBilling(state);
    setPlans(catalog.plans || []);
  }, []);
  useEffect(() => { load().catch(() => setFailed(true)); }, [load]);

  const run = async (action, success) => {
    setBusy(true);
    try {
      const result = await action();
      await load();
      showToast(success(result), 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo completar la acción', 'error');
    } finally {
      setBusy(false);
    }
  };
  const cancel = () => run(() => api.cancelSubscription(), (result) => (result.endsAt ? `Suscripción cancelada. Conservas tu plan hasta el ${formatDate(result.endsAt)}` : 'Suscripción cancelada'));
  const undoChange = () => run(() => api.changeSubscriptionPlan(billing.subscription.planKey), () => 'Cambio de plan deshecho');

  if (failed) return <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">No pudimos cargar tu plan. Recarga la página.</p>;
  if (!billing) return <LoadingState label="Cargando tu plan…" />;
  const subscribed = billing.source === 'subscription' && billing.subscription;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200">
        <h3 className="text-lg font-black text-[#1a2b4b]">Plan {billing.plan.name}</h3>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          {subscribed ? 'Suscripción pagada con Mercado Pago.' : billing.source === 'grant' ? 'Plan asignado por el equipo de Carpetazo.' : 'Plan gratuito.'} Usas {billing.usage?.folders || 0} de {billing.plan.folders === null ? 'carpetas ilimitadas' : `${billing.plan.folders} ${billing.plan.folders === 1 ? 'carpeta' : 'carpetas'}`}.
        </p>
        <Link to="/planes" className="mt-4 inline-flex h-11 items-center rounded-xl bg-[#12315f] px-4 text-sm font-extrabold text-white hover:bg-[#1e40af]">{subscribed ? 'Cambiar de plan' : 'Ver planes'}</Link>
      </div>
      {subscribed && <SubscriptionPanel billing={billing} plans={plans} busy={busy} onCancel={cancel} onUndoChange={undoChange} />}
      {billing.source === 'grant' && <GrantNote billing={billing} />}
      {billing.source === 'default' && <p className="px-1 text-sm font-medium text-slate-600">No tienes una suscripción activa, así que no hay nada que cancelar.</p>}
    </div>
  );
}
