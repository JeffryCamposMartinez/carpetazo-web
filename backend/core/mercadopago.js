// Mercado Pago: llamadas a su API y cancelación de una suscripción (la usan billing.js y la administración).
import { prisma } from './db.js';

// Incluso si la bandera se configurara por error, producción nunca usa un Mercado Pago simulado.
const TEST_MODE = process.env.BILLING_TEST_MODE === '1' && process.env.NODE_ENV !== 'production';
// Solo en pruebas locales se puede apuntar a un Mercado Pago simulado (tests/run.cjs)
const MP_API = (TEST_MODE && process.env.MERCADOPAGO_TEST_API) || 'https://api.mercadopago.com';
const mpToken = () => String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();

// El enlace de pago que se entrega al navegador debe ser https y de Mercado Pago (en pruebas locales, el simulado)
export const isMercadoPagoCheckoutUrl = (value) => {
  try {
    const url = new URL(String(value));
    if (TEST_MODE) return url.protocol === 'http:' || url.protocol === 'https:';
    return url.protocol === 'https:' && !url.username && !url.password && /(^|\.)mercadopago\.(com|cl|com\.ar|com\.br|com\.co|com\.mx|com\.pe|com\.uy)$/i.test(url.hostname);
  } catch { return false; }
};

export const mpFetch = async (path, options = {}) => {
  const token = mpToken();
  if (!token) {
    const error = new Error('Mercado Pago todavía no está configurado en este entorno.');
    error.code = 'billing_not_configured';
    error.status = 503;
    throw error;
  }
  const response = await fetch(MP_API + path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('Mercado Pago rechazó la operación. Intenta nuevamente.');
    error.code = 'mercadopago_error';
    error.status = response.status >= 500 ? 502 : 400;
    error.providerStatus = response.status;
    error.providerMessage = typeof body?.message === 'string' ? body.message.slice(0, 200) : '';
    error.providerCause = Array.isArray(body?.cause) ? body.cause.map((item) => item?.code).filter(Boolean).slice(0, 4) : [];
    throw error;
  }
  return body;
};

// Corta los cobros en Mercado Pago y deja la suscripción cancelada en Carpetazo: lo ya pagado sigue vigente hasta el fin del período.
export const cancelSubscriptionRecord = async (subscription) => {
  if (subscription.providerSubscriptionId) {
    await mpFetch(`/preapproval/${encodeURIComponent(subscription.providerSubscriptionId)}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
  }
  const paidUntil = subscription.currentPeriodEnd || subscription.nextPaymentAt;
  const keepsAccess = subscription.status === 'active' && paidUntil && paidUntil > new Date();
  await prisma.$transaction(async (tx) => {
    await tx.subscription.deleteMany({ where: { userId: subscription.userId, status: 'scheduled' } });
    await tx.subscription.update({
      where: { id: subscription.id },
      data: keepsAccess
        ? { cancelAtPeriodEnd: true, canceledAt: new Date(), currentPeriodEnd: paidUntil, nextPaymentAt: null }
        : { status: 'canceled', canceledAt: new Date(), cancelAtPeriodEnd: false }
    });
  });
  return { endsAt: keepsAccess ? paidUntil : null };
};
