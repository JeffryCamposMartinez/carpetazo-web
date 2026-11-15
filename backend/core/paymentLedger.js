// Libro de pagos reales de Mercado Pago. Solo un pago que Mercado Pago confirma como «approved» cuenta como ingreso; el resto se guarda con su estado.
// Cada pago se consulta a Mercado Pago (no se confía en lo que trae el aviso). Un pago con una forma inesperada queda «unverified» y nunca suma ingresos.
import { prisma } from './db.js';

const STATUS = { approved: 'approved', rejected: 'rejected', refunded: 'refunded', charged_back: 'charged_back', cancelled: 'cancelled', canceled: 'cancelled', pending: 'pending', in_process: 'pending', authorized: 'pending' };

const clp = (value) => (Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.round(Number(value)) : 0);

// Pura: interpreta la respuesta de GET /v1/payments/{id}
export const parseMercadoPagoPayment = (payment) => {
  if (!payment || typeof payment !== 'object' || payment.id === undefined || payment.id === null) return null;
  const status = STATUS[String(payment.status || '').toLowerCase()] || 'unverified';
  const paidAt = payment.date_approved ? new Date(payment.date_approved) : null;
  return {
    providerPaymentId: String(payment.id),
    status,
    amountClp: clp(payment.transaction_amount),
    refundedClp: clp(payment.transaction_amount_refunded),
    paidAt: paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : null,
    externalReference: payment.external_reference ? String(payment.external_reference) : null,
    currency: String(payment.currency_id || '')
  };
};

// Dinero confirmado: solo `approved` en pesos chilenos, menos lo reembolsado
export const confirmedAmount = (row) => (row.status === 'approved' ? Math.max(0, row.amountClp - row.refundedClp) : 0);

const link = async (db, externalReference) => {
  if (!externalReference) return { subscriptionId: null, userId: null };
  const sub = await db.subscription.findUnique({ where: { id: externalReference }, select: { id: true, userId: true } }).catch(() => null);
  return { subscriptionId: sub?.id || null, userId: sub?.userId || null };
};

// topic «payment»: el id del aviso es el id del pago. topic «…authorized_payment»: se consulta el cobro autorizado y de ahí el pago asociado.
export const recordMercadoPagoPayment = async (resourceId, topic, fetcher, db = prisma) => {
  const id = encodeURIComponent(String(resourceId));
  let paymentId = String(resourceId);
  let source = 'payment';
  if (String(topic).includes('authorized_payment')) {
    source = 'authorized_payment';
    const authorized = await fetcher(`/authorized_payments/${id}`);
    const inner = authorized?.payment?.id;
    if (inner === undefined || inner === null) {
      // Forma inesperada: se guarda lo mínimo, sin dinero confirmado
      await db.paymentLedger.upsert({ where: { providerPaymentId: `ap_${resourceId}` }, create: { providerPaymentId: `ap_${resourceId}`, status: 'unverified', source }, update: {} });
      return { recorded: true, status: 'unverified' };
    }
    paymentId = String(inner);
  }
  const parsed = parseMercadoPagoPayment(await fetcher(`/v1/payments/${encodeURIComponent(paymentId)}`));
  if (!parsed) return { recorded: false };
  const { subscriptionId, userId } = await link(db, parsed.externalReference);
  const data = { status: parsed.status, amountClp: parsed.amountClp, refundedClp: parsed.refundedClp, paidAt: parsed.paidAt, subscriptionId, userId, source };
  await db.paymentLedger.upsert({ where: { providerPaymentId: parsed.providerPaymentId }, create: { providerPaymentId: parsed.providerPaymentId, ...data }, update: data });
  return { recorded: true, status: parsed.status };
};
