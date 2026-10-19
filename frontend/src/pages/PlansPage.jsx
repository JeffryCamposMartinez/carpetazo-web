import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import LoadingState, { ButtonSpinner } from '../components/ui/LoadingState';
import { useToast } from '../components/ui/ToastProvider';
import usePageMeta from '../hooks/usePageMeta';
import ConfirmModal from '../components/ui/ConfirmModal';
import SubscriptionPanel, { GrantNote, formatDate } from '../components/plans/SubscriptionPanel';
import SvgIcon from '../components/ui/SvgIcon';

const ICONS = { free: 'style', enthusiast: 'local_fire_department', premium: 'workspace_premium', pro: 'diamond', store: 'storefront', test: 'science' };
const STYLES = {
  free: 'border-slate-200 bg-white',
  enthusiast: 'border-emerald-300 bg-gradient-to-b from-emerald-50 to-white',
  premium: 'border-amber-300 bg-gradient-to-b from-amber-50 to-white',
  pro: 'border-violet-300 bg-gradient-to-b from-violet-50 to-white',
  store: 'border-sky-300 bg-gradient-to-b from-sky-50 to-white',
  test: 'border-dashed border-slate-400 bg-white'
};
const number = (value) => value === null ? 'Ilimitadas' : Number(value).toLocaleString('es-CL');
const price = (value) => value === 0 ? 'Gratis' : `$${Number(value).toLocaleString('es-CL')}`;

function PlanCard({ plan, current, busy, testMode, cta, onChoose }) {
  const active = current === plan.key;
  const features = [
    `${number(plan.folders)} ${plan.folders === 1 ? 'carpeta' : 'carpetas'}`,
    `${number(plan.uniqueCardsPerFolder)} cartas únicas por carpeta`,
    `${number(plan.copiesPerCard)} copias por carta`,
    plan.foldersPerTcg === null ? 'Varias carpetas del mismo TCG' : `${plan.foldersPerTcg} ${plan.foldersPerTcg === 1 ? 'carpeta' : 'carpetas'} por TCG`,
    ...(plan.key === 'free' || plan.adminOnly ? [] : [`Insignia pública ${plan.name}`])
  ];
  return (
    <article className={`relative flex min-h-[30rem] flex-col rounded-3xl border-2 p-6 shadow-[0_16px_38px_-24px_rgba(15,39,80,0.55)] ${STYLES[plan.key]} ${active ? 'ring-4 ring-[#1e40af]/15' : ''}`}>
      {plan.adminOnly && <span className="absolute left-4 top-4 rounded-full bg-slate-700 px-3 py-1 text-xs font-black text-white">Solo administradores</span>}
      {active && <span className="absolute right-4 top-4 rounded-full bg-[#1e40af] px-3 py-1 text-xs font-black text-white">Plan actual</span>}
      <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#12315f] text-[#facc15]"><SvgIcon name={ICONS[plan.key]} translate="no" className="text-[27px]" /></span>
      <h2 className="text-2xl font-black text-[#12315f]">{plan.name}</h2>
      <p className="mt-2 flex flex-wrap items-end gap-x-1 text-[#12315f]"><span className="text-4xl font-black tracking-tight">{price(plan.priceClp)}</span>{plan.priceClp > 0 && <span className="pb-1 text-sm font-bold text-slate-500">/mes</span>}</p>
      <ul className="my-7 flex flex-1 flex-col gap-3">
        {features.map((feature) => <li key={feature} className="flex gap-2 text-sm font-semibold text-slate-700"><SvgIcon name="check_circle" translate="no" className="text-[20px] text-emerald-600" /><span>{feature}</span></li>)}
      </ul>
      <button type="button" disabled={busy || (cta ? cta.disabled : active)} onClick={() => onChoose(plan)} className="flex h-12 items-center justify-center rounded-xl bg-[#1e40af] px-4 font-extrabold text-white shadow-md transition hover:bg-[#1e3a8a] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">
        {busy ? <><ButtonSpinner /><span className="ml-2">Procesando…</span></> : cta ? cta.label : active ? 'Plan activo' : testMode ? 'Probar este plan' : plan.priceClp === 0 ? 'Usar Free' : 'Elegir plan'}
      </button>
    </article>
  );
}

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

  const load = useCallback(async () => {
    const catalog = await api.getPlans();
    setPlans(catalog.plans || []);
    if (currentUser) setBilling(await api.getBillingMe()); else setBilling(null);
  }, [currentUser]);

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
  return (
    <div className="mx-auto w-full max-w-[1500px] flex-1 bg-[#DBEAFE] px-4 py-10 sm:px-7 lg:px-12">
      <header className="mx-auto max-w-3xl text-center">
        <span className="inline-flex rounded-full bg-[#facc15] px-4 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-[#12315f]">Planes Carpetazo</span>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-[#12315f] sm:text-5xl">El espacio que necesita tu colección</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base font-medium text-slate-600">Empieza gratis y aumenta tus carpetas, cartas y copias cuando tu colección crezca.</p>
      </header>

      {currentUser && plan && (
        <section className="mx-auto mt-8 flex max-w-4xl flex-col gap-4 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Tu plan actual</p><p className="mt-1 text-2xl font-black text-[#12315f]">{plan.name}</p></div>
          <div className="grid grid-cols-2 gap-6 text-sm sm:text-right">
            <div><p className="font-bold text-slate-500">Carpetas</p><p className="text-lg font-black text-[#12315f]">{usage?.folders || 0} / {number(plan.folders)}</p></div>
            <div><p className="font-bold text-slate-500">Estado</p><p className="text-lg font-black text-emerald-700">{billing.source === 'subscription' ? 'Suscripción activa' : billing.testMode ? 'Prueba local' : 'Incluido'}</p></div>
          </div>
        </section>
      )}

      {billing?.source === 'grant' && <GrantNote billing={billing} />}
      {sub && <SubscriptionPanel billing={billing} plans={plans} busy={busy === 'cancel'} onCancel={cancelSubscription} onUndoChange={() => applyChange(plans.find((item) => item.key === sub.planKey))} />}

      {billing?.testMode && <div className="mx-auto mt-5 max-w-4xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"><strong>Modo de prueba local:</strong> cambiar de plan aquí no realiza cobros y permite comprobar inmediatamente todos los límites.</div>}

      <section className="mt-9 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        {[...plans, ...(billing?.adminPlans || [])].map((item) => <PlanCard key={item.key} plan={item} current={plan?.key || (currentUser ? 'free' : '')} busy={busy === item.key} testMode={Boolean(billing?.testMode)} cta={ctaFor(item)} onChoose={choose} />)}
      </section>

      <section className="mx-auto mt-10 max-w-4xl rounded-3xl bg-[#12315f] p-6 text-white sm:p-8">
        <h2 className="text-2xl font-black">¿Qué cuenta como carta única?</h2>
        <p className="mt-2 text-sm font-medium leading-6 text-blue-100">Cada combinación de carta e idioma ocupa un espacio. La misma carta en español y en inglés se conserva por separado. Reducir stock o eliminar una carta siempre está permitido, incluso si cambias a un plan menor.</p>
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
