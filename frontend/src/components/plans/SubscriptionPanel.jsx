import { useState } from 'react';
import ConfirmModal from '../ui/ConfirmModal';
import { ButtonSpinner } from '../ui/LoadingState';

export const formatDate = (value) => value ? new Date(value).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const money = (value) => `$${Number(value).toLocaleString('es-CL')}`;

// Plan que el equipo asignó a mano: no se cobra ni se cancela
export function GrantNote({ billing }) {
  const endsAt = billing.grant?.endsAt;
  return (
    <section id="tu-suscripcion" className="mx-auto mt-5 max-w-4xl scroll-mt-28 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-[#12315f]">Tu plan {billing.plan.name}</h2>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-700">Este plan lo asignó el equipo de Carpetazo{endsAt ? ` y vence el ${formatDate(endsAt)}` : ' y no tiene fecha de término'}. No es una suscripción: no se te cobra nada y no hay nada que cancelar. Si quieres uno propio, elige un plan pagado más abajo.</p>
    </section>
  );
}

// "Tu suscripción": estado del cobro, cambio programado y, aparte de todo lo demás, la cancelación (siempre con confirmación).
export default function SubscriptionPanel({ billing, plans, busy, onCancel, onUndoChange }) {
  const [confirming, setConfirming] = useState(false);
  const sub = billing?.subscription;
  if (!sub) return null;
  const ending = Boolean(sub.cancelAtPeriodEnd);
  const scheduled = billing.scheduledChange;
  const scheduledPlan = scheduled && plans.find((item) => item.key === scheduled.planKey);
  const endDate = formatDate(sub.currentPeriodEnd || sub.nextPaymentAt);
  const pastDue = sub.status === 'past_due';

  return (
    <section id="tu-suscripcion" className="mx-auto mt-5 max-w-4xl scroll-mt-28 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-[#12315f]">Tu suscripción</h2>
      <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div><dt className="font-bold text-slate-500">Plan</dt><dd className="text-base font-black text-[#12315f]">{billing.plan.name} · {money(sub.priceClp ?? billing.plan.priceClp)}/mes</dd></div>
        <div><dt className="font-bold text-slate-500">{ending ? 'Tu plan termina el' : 'Próximo cobro'}</dt><dd className="text-base font-black text-[#12315f]">{endDate || 'Por confirmar'}</dd></div>
        <div><dt className="font-bold text-slate-500">Estado</dt><dd className={`text-base font-black ${pastDue ? 'text-red-700' : ending ? 'text-amber-700' : 'text-emerald-700'}`}>{pastDue ? 'Pago pendiente' : ending ? 'Cancelada, activa hasta el fin del período' : 'Activa'}</dd></div>
      </dl>

      {pastDue && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">No pudimos cobrar tu último pago. Mercado Pago lo reintentará; si no se regulariza, tu cuenta volverá al plan Común.</p>}
      {ending && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">No se te volverá a cobrar. Conservas {billing.plan.name} hasta el {endDate}; después tu cuenta vuelve a Común. Si cambias de idea, elige un plan abajo para contratar de nuevo.</p>}
      {scheduled && !ending && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-[#12315f] sm:flex-row sm:items-center sm:justify-between">
          <span>Cambio programado: el {formatDate(scheduled.effectiveAt)} pasas a <strong>{scheduledPlan?.name || scheduled.planKey}</strong> ({money(scheduled.priceClp)}/mes). Hasta entonces mantienes {billing.plan.name}.</span>
          <button type="button" disabled={busy} onClick={onUndoChange} className="h-10 shrink-0 rounded-lg border border-[#1e40af] px-4 font-extrabold text-[#1e40af] transition hover:bg-white disabled:opacity-60">Deshacer cambio</button>
        </div>
      )}

      {!ending && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-600">Para cambiar de plan, elige otro más abajo. No pagas dos veces y el cambio rige desde tu próximo cobro.</p>
          <button type="button" disabled={busy} onClick={() => setConfirming(true)} className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-slate-500 underline-offset-2 transition hover:bg-red-50 hover:text-red-700 hover:underline disabled:opacity-60">
            {busy && <ButtonSpinner />}Cancelar suscripción
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={confirming}
        title="¿Cancelar tu suscripción?"
        message={`No se te volverá a cobrar. Conservas ${billing.plan.name} hasta el ${endDate || 'fin del período pagado'} y después tu cuenta vuelve a Común (tus cartas y carpetas no se borran). Para volver a un plan pagado tendrás que contratarlo de nuevo.`}
        confirmText="Sí, cancelar suscripción"
        cancelText="Mantener mi suscripción"
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); onCancel(); }}
      />
    </section>
  );
}
