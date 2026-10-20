import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import LoadingState from '../components/ui/LoadingState';
import { useToast } from '../components/ui/ToastProvider';
import usePageMeta from '../hooks/usePageMeta';
import ConfirmModal from '../components/ui/ConfirmModal';
import SubscriptionPanel, { formatDate } from '../components/plans/SubscriptionPanel';
import PlanCards from '../components/plans/PlanCards';

const number = (value) => value === null ? 'Ilimitadas' : Number(value).toLocaleString('es-CL');

export default function PlansPage() {
  usePageMeta({
    title: 'Planes para colecciones de cartas TCG | Carpetazo',
    description: 'Compara los planes Free, Entusiasta, Premium, Pro y Tienda de Carpetazo para organizar y vender tus cartas TCG.',
    path: '/planes'
  });
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [changeTarget, setChangeTarget] = useState(null);
  const [focusKey, setFocusKey] = useState(null);

  const load = useCallback(async () => {
    const catalog = await api.getPlans();
    setPlans(catalog.plans || []);
    if (currentUser) setBilling(await api.getBillingMe()); else setBilling(null);
  }, [currentUser]);

  useEffect(() => {
    try { if (!sessionStorage.getItem('cz-plans-view')) { sessionStorage.setItem('cz-plans-view', '1'); api.trackMetric('plans_view'); } } catch (_error) { api.trackMetric('plans_view'); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load().catch((error) => { if (!cancelled) showToast(error.message || 'No se pudieron cargar los planes', 'error'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load, showToast]);

  useEffect(() => {
    if (!currentUser || searchParams.get('estado') !== 'suscripcion') return undefined;
    let attempts = 0;
    let cancelled = false;
    let timer;
    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        await api.syncSubscription().catch(() => {}); // pide a Mercado Pago el estado real, sin esperar el aviso
        const next = await api.getBillingMe();
        if (cancelled) return;
        setBilling(next);
        if (next.source === 'subscription' || attempts >= 6) {
          showToast(next.source === 'subscription' ? 'Tu suscripción ya está activa' : 'El pago sigue en verificación', next.source === 'subscription' ? 'success' : 'info');
          setSearchParams({}, { replace: true });
          return;
        }
      } catch { /* se reintenta */ }
      timer = window.setTimeout(poll, 2500);
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [currentUser, searchParams, setSearchParams, showToast]);

  const sub = billing?.source === 'subscription' && !billing?.testMode ? billing.subscription : null;
  const managing = Boolean(sub) && !sub.cancelAtPeriodEnd;
  const scheduled = managing ? billing.scheduledChange : null;

  const goToSubscription = () => document.getElementById('tu-suscripcion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const refresh = async () => setBilling(await api.getBillingMe());

  const applyChange = async (plan) => {
    setBusy(plan.key);
    try {
      const result = await api.changeSubscriptionPlan(plan.key);
      await refresh();
      showToast(plan.key === sub?.planKey ? 'Cambio de plan deshecho' : `Listo: pasas a ${plan.name} el ${formatDate(result.effectiveAt)}`, 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo cambiar el plan', 'error');
    } finally {
      setBusy('');
    }
  };

  const cancelSubscription = async () => {
    setBusy('cancel');
    try {
      const result = await api.cancelSubscription();
      await refresh();
      showToast(result.endsAt ? `Suscripción cancelada. Conservas tu plan hasta el ${formatDate(result.endsAt)}` : 'Suscripción cancelada', 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo cancelar la suscripción', 'error');
    } finally {
      setBusy('');
    }
  };

  const choose = async (plan) => {
    if (!currentUser) {
      window.dispatchEvent(new Event('carpetazo:open-auth'));
      return;
    }
    if (managing && !billing?.testMode) {
      if (plan.key === 'free') return goToSubscription(); // volver a Free es cancelar, y eso se hace solo desde «Tu suscripción»
      if (plan.key === sub.planKey) return applyChange(plan); // deshace un cambio programado
      return setChangeTarget(plan);
    }
    setBusy(plan.key);
    try {
      if (billing?.testMode) {
        const next = await api.setLocalTestPlan(plan.key);
        setBilling(previous => ({ ...previous, ...next }));
        showToast(`Plan ${plan.name} activado para pruebas locales`, 'success');
      } else if (plan.key === 'free') {
        showToast(billing?.source === 'grant' ? 'Tu plan lo asignó el equipo de Carpetazo: no es una suscripción y no hay nada que cancelar.' : 'Ya estás en el plan Free: no tienes una suscripción que cancelar.', 'info');
      } else {
        api.trackMetric('plan_cta', plan.key);
        const response = await api.createSubscriptionCheckout(plan.key);
        window.location.assign(response.checkoutUrl);
      }
    } catch (error) {
      showToast(error.message || 'No se pudo cambiar el plan', 'error');
    } finally {
      setBusy('');
    }
  };

  const ctaFor = (item) => {
    if (!managing) return undefined;
    if (item.key === 'free') return { label: 'Se cancela en Tu suscripción', disabled: false };
    if (scheduled?.planKey === item.key) return { label: 'Cambio programado', disabled: true };
    if (item.key === sub.planKey) return scheduled ? { label: 'Mantener este plan', disabled: false } : { label: 'Plan activo', disabled: true };
    return { label: 'Cambiar a este plan', disabled: false };
  };

  if (loading) return <div className="mx-auto flex min-h-[60vh] w-full max-w-[1500px] items-center justify-center bg-[#DBEAFE]"><LoadingState variant="page" label="Cargando planes…" /></div>;
  const plan = billing?.plan;
  const usage = billing?.usage;
  const currentIndex = plans.findIndex((item) => item.key === plan?.key);
  const suggestedKey = plans[Math.min(Math.max(currentIndex + 1, 1), plans.length - 1)]?.key; // por defecto se destaca el plan siguiente al tuyo
  return (
    <div className="mx-auto w-full max-w-[1500px] flex-1 bg-[#DBEAFE] px-4 py-7 sm:px-7 sm:py-9 lg:px-12">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="text-balance text-3xl font-black tracking-tight text-[#12315f] sm:text-4xl">El espacio que necesita tu colección</h1>
        <p className="mx-auto mt-2 max-w-xl text-pretty text-sm font-medium text-slate-600 sm:text-base">Empieza gratis y crece cuando tu colección lo pida. Elige un plan y mira qué suma respecto al anterior.</p>
      </header>

      {currentUser && plan && (
        <section className="mx-auto mt-5 flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl bg-white px-4 py-2.5 text-sm shadow-sm ring-1 ring-[#12315f]/10">
          <p className="flex items-center gap-2 font-bold text-slate-500">Tu plan <span className="rounded-full bg-[#facc15] px-3 py-0.5 text-sm font-black text-[#12315f]">{plan.name}</span></p>
          <p className="min-w-0 flex-1 basis-56 text-[13px] font-semibold text-slate-600">
            {billing.source === 'grant'
              ? `Lo asignó el equipo de Carpetazo${billing.grant?.endsAt ? ` y vence el ${formatDate(billing.grant.endsAt)}` : ', sin fecha de término'}. No se cobra ni hay nada que cancelar.`
              : billing.source === 'subscription' ? 'Suscripción activa.' : billing.testMode ? 'Prueba local.' : 'Incluido.'}
          </p>
          <p className="font-bold text-slate-500">Carpetas <span className="font-black text-[#12315f]">{usage?.folders || 0} / {number(plan.folders)}</span></p>
        </section>
      )}

      {sub && <SubscriptionPanel billing={billing} plans={plans} busy={busy === 'cancel'} onCancel={cancelSubscription} onUndoChange={() => applyChange(plans.find((item) => item.key === sub.planKey))} />}

      {billing?.testMode && <div className="mx-auto mt-5 max-w-4xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"><strong>Modo de prueba local:</strong> cambiar de plan aquí no realiza cobros y permite comprobar inmediatamente todos los límites.</div>}

      <PlanCards
        plans={plans}
        current={plan?.key || (currentUser ? 'free' : '')}
        focus={focusKey || suggestedKey}
        onFocus={setFocusKey}
        busyKey={busy}
        testMode={Boolean(billing?.testMode)}
        ctaFor={ctaFor}
        onChoose={choose}
      />

      <section className="mx-auto mt-10 max-w-4xl rounded-3xl bg-[#12315f] p-6 text-center text-white sm:p-8">
        <h2 className="text-2xl font-black">¿Qué cuenta como carta única?</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm font-medium leading-6 text-blue-100">Cada combinación de carta e idioma ocupa un espacio. La misma carta en español y en inglés se conserva por separado. Reducir stock o eliminar una carta siempre está permitido, incluso si cambias a un plan menor.</p>
        {!currentUser && <Link to="/bienvenida" className="mt-5 inline-flex h-11 items-center rounded-xl bg-[#facc15] px-5 font-black text-[#12315f]">Conocer Carpetazo</Link>}
      </section>
      <ConfirmModal
        isOpen={Boolean(changeTarget)}
        title={`Cambiar a ${changeTarget?.name || ''}`}
        message={changeTarget ? `Mantienes ${billing.plan.name} hasta el ${formatDate(sub.currentPeriodEnd || sub.nextPaymentAt)}. Desde ese día pasas a ${changeTarget.name} y se te cobra $${Number(changeTarget.priceClp).toLocaleString('es-CL')} al mes. No pagas nada ahora y puedes deshacer el cambio antes de esa fecha.` : ''}
        confirmText="Programar cambio"
        cancelText="Volver"
        isDestructive={false}
        onCancel={() => setChangeTarget(null)}
        onConfirm={() => { const plan = changeTarget; setChangeTarget(null); applyChange(plan); }}
      />
    </div>
  );
}
