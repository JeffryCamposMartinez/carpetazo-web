// Planes, suscripción propia y notificación de Mercado Pago.
import crypto from 'crypto';
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { getPlanState, lockPlanUser } from '../core/entitlements.js';
import { paidPlan, publicPlans, validPlanKey } from '../core/plans.js';

const router = express.Router();
const MP_API = 'https://api.mercadopago.com';
// Incluso si la bandera se configurara por error, producción nunca expone el selector sin cobro.
const TEST_MODE = process.env.BILLING_TEST_MODE === '1' && process.env.NODE_ENV !== 'production';
const WEB_URL = (process.env.APP_WEB_URL || (TEST_MODE ? 'http://localhost:5173' : 'https://carpetazo.cl')).replace(/\/$/, '');

const planEnvKey = (key) => `MERCADOPAGO_PLAN_${key.toUpperCase()}_ID`;
const mpToken = () => String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();

const mpFetch = async (path, options = {}) => {
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
    error.providerCause = Array.isArray(body?.cause) ? body.cause.map((item) => item?.code).filter(Boolean).slice(0, 4) : [];
    throw error;
  }
  return body;
};

const ownUser = (firebaseUid) => prisma.user.findUnique({
  where: { firebaseUid },
  select: { id: true, email: true, role: true }
});

const safeSubscription = (subscription) => subscription ? {
  id: subscription.id,
  planKey: subscription.planKey,
  status: subscription.status,
  provider: subscription.provider,
  priceClp: subscription.priceClp,
  currency: subscription.currency,
  currentPeriodEnd: subscription.currentPeriodEnd,
  nextPaymentAt: subscription.nextPaymentAt,
  cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  canceledAt: subscription.canceledAt,
  createdAt: subscription.createdAt
} : null;

// Solo los errores propios (con código) muestran su mensaje; el resto va genérico y el detalle al log.
const sendBillingError = (res, error, fallback) => {
  const own = ['billing_not_configured', 'mercadopago_error', 'mercadopago_invalid_response'].includes(error.code);
  res.status(own ? error.status || 500 : 500).json({ success: false, code: own ? error.code : 'billing_error', message: own ? error.message : fallback });
};

router.get('/api/plans', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ success: true, plans: publicPlans() });
});

router.get('/api/billing/me', authenticateToken, async (req, res) => {
  try {
    const user = await ownUser(req.user.sub);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const [state, subscriptions] = await Promise.all([
      getPlanState(prisma, user.id),
      prisma.subscription.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 12 })
    ]);
    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, ...state, subscriptions: subscriptions.map(safeSubscription), testMode: TEST_MODE });
  } catch (error) {
    console.error('Error loading billing state:', error);
    res.status(500).json({ success: false, message: 'No se pudo cargar tu plan' });
  }
});

// Selector local para comprobar límites sin dinero. Esta ruta no existe lógicamente si la bandera está apagada.
router.post('/api/billing/test-plan', authenticateToken, async (req, res) => {
  if (!TEST_MODE) return res.status(404).json({ success: false, message: 'Ruta no encontrada' });
  try {
    const planKey = req.body?.planKey;
    if (!validPlanKey(planKey)) return res.status(400).json({ success: false, message: 'Plan inválido' });
    const user = await ownUser(req.user.sub);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    await prisma.$transaction(async (tx) => {
      await tx.planGrant.updateMany({ where: { userId: user.id, revokedAt: null, reason: 'Prueba local de planes' }, data: { revokedAt: new Date() } });
      await tx.planGrant.create({ data: { userId: user.id, planKey, reason: 'Prueba local de planes' } });
    });
    res.json({ success: true, ...(await getPlanState(prisma, user.id)) });
  } catch (error) {
    console.error('Error changing local test plan:', error);
    res.status(500).json({ success: false, message: 'No se pudo activar el plan de prueba' });
  }
});

router.post('/api/billing/checkout', authenticateToken, async (req, res) => {
  let localSubscriptionId = null;
  try {
    const plan = paidPlan(req.body?.planKey);
    if (!plan) return res.status(400).json({ success: false, message: 'Selecciona un plan pagado válido' });
    const user = await ownUser(req.user.sub);
    if (!user || !user.email) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const id = crypto.randomUUID();
    const providerPlanId = String(process.env[planEnvKey(plan.key)] || '').trim() || null;
    const existing = await prisma.$transaction(async (tx) => {
      await lockPlanUser(tx, user.id);
      const found = await tx.subscription.findFirst({
        where: { userId: user.id, status: { in: ['pending', 'active', 'past_due', 'paused'] } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, planKey: true, status: true }
      });
      if (found) return found;
      await tx.subscription.create({
        data: { id, userId: user.id, planKey: plan.key, status: 'pending', provider: 'mercadopago', providerPlanId, priceClp: plan.priceClp }
      });
      return null;
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        code: 'subscription_exists',
        message: existing.status === 'pending'
          ? 'Ya tienes una suscripción en verificación.'
          : 'Ya tienes una suscripción. Cancélala antes de contratar otro plan.'
      });
    }
    localSubscriptionId = id;

    const payload = {
      reason: `Carpetazo ${plan.name}`,
      external_reference: id,
      payer_email: user.email,
      back_url: `${WEB_URL}/planes?estado=suscripcion`,
      status: 'pending',
      ...(providerPlanId
        ? { preapproval_plan_id: providerPlanId }
        : { auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: plan.priceClp, currency_id: 'CLP' } })
    };
    const created = await mpFetch('/preapproval', { method: 'POST', body: JSON.stringify(payload), headers: { 'X-Idempotency-Key': id } });
    if (!created?.id || !created?.init_point) throw Object.assign(new Error('Mercado Pago no devolvió un enlace de pago.'), { code: 'mercadopago_invalid_response', status: 502 });

    await prisma.subscription.update({
      where: { id },
      data: { providerSubscriptionId: String(created.id), status: created.status === 'authorized' ? 'active' : 'pending', nextPaymentAt: created.next_payment_date ? new Date(created.next_payment_date) : null }
    });
    res.json({ success: true, checkoutUrl: created.init_point, subscriptionId: id });
  } catch (error) {
    if (localSubscriptionId) await prisma.subscription.updateMany({ where: { id: localSubscriptionId, status: 'pending' }, data: { status: 'failed' } }).catch(() => {});
    console.error('Error creating Mercado Pago subscription:', error.code || error.message);
    sendBillingError(res, error, 'No se pudo iniciar la suscripción');
  }
});

router.post('/api/billing/cancel', authenticateToken, async (req, res) => {
  try {
    const user = await ownUser(req.user.sub);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const subscription = await prisma.subscription.findFirst({ where: { userId: user.id, status: { in: ['active', 'past_due', 'paused', 'pending'] } }, orderBy: { createdAt: 'desc' } });
    if (!subscription) return res.status(404).json({ success: false, message: 'No tienes una suscripción activa' });
    if (subscription.providerSubscriptionId) {
      await mpFetch(`/preapproval/${encodeURIComponent(subscription.providerSubscriptionId)}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
    }
    const updated = await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'canceled', canceledAt: new Date(), cancelAtPeriodEnd: false } });
    res.json({ success: true, subscription: safeSubscription(updated), ...(await getPlanState(prisma, user.id)) });
  } catch (error) {
    console.error('Error canceling subscription:', error.code || error.message);
    sendBillingError(res, error, 'No se pudo cancelar la suscripción');
  }
});

const signatureParts = (header) => Object.fromEntries(String(header || '').split(',').map((part) => part.trim().split('=', 2)).filter(([key, value]) => key && value));
const secureEqual = (a, b) => {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
const webhookSignatureValid = (req, resourceId) => {
  const secret = String(process.env.MERCADOPAGO_WEBHOOK_SECRET || '').trim();
  if (!secret) return TEST_MODE && req.headers['x-local-billing-test'] === '1';
  const { ts, v1 } = signatureParts(req.headers['x-signature']);
  const requestId = String(req.headers['x-request-id'] || '');
  if (!ts || !v1 || !requestId || !resourceId) return false;
  const manifest = `id:${String(resourceId).toLowerCase()};request-id:${requestId};ts:${ts};`;
  return secureEqual(v1, crypto.createHmac('sha256', secret).update(manifest).digest('hex'));
};

const providerStatus = (status) => ({ authorized: 'active', pending: 'pending', paused: 'paused', cancelled: 'canceled', canceled: 'canceled' }[status] || 'pending');
const syncPreapproval = async (resourceId) => {
  const remote = await mpFetch(`/preapproval/${encodeURIComponent(resourceId)}`);
  const subscription = await prisma.subscription.findFirst({
    where: { OR: [{ providerSubscriptionId: String(resourceId) }, ...(remote.external_reference ? [{ id: String(remote.external_reference) }] : [])] }
  });
  if (!subscription) return null;
  return prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      providerSubscriptionId: String(remote.id || resourceId),
      status: providerStatus(remote.status),
      nextPaymentAt: remote.next_payment_date ? new Date(remote.next_payment_date) : null,
      canceledAt: ['cancelled', 'canceled'].includes(remote.status) ? new Date() : subscription.canceledAt
    }
  });
};

router.post('/api/billing/mercadopago/webhook', async (req, res) => {
  const topic = String(req.body?.type || req.body?.topic || req.query?.type || 'unknown');
  const resourceId = String(req.body?.data?.id || req.query?.['data.id'] || req.body?.resource || '');
  if (!webhookSignatureValid(req, resourceId)) return res.status(401).json({ success: false, message: 'Firma inválida' });
  const eventId = String(req.body?.id || req.headers['x-request-id'] || `${topic}:${resourceId}`);
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');
  let event;
  try {
    event = await prisma.billingEvent.create({ data: { providerEventId: eventId, topic, resourceId: resourceId || null, payloadHash } });
  } catch (error) {
    if (error.code === 'P2002') {
      event = await prisma.billingEvent.findUnique({ where: { provider_providerEventId: { provider: 'mercadopago', providerEventId: eventId } } });
      if (!event || ['processed', 'ignored'].includes(event.status)) return res.json({ success: true, duplicate: true });
    } else {
      throw error;
    }
  }
  try {
    const subscription = topic.includes('preapproval') && resourceId ? await syncPreapproval(resourceId) : null;
    await prisma.billingEvent.update({ where: { id: event.id }, data: { status: subscription ? 'processed' : 'ignored', attempts: { increment: 1 }, subscriptionId: subscription?.id || null, processedAt: new Date(), error: null } });
    return res.json({ success: true });
  } catch (error) {
    await prisma.billingEvent.update({ where: { id: event.id }, data: { status: 'failed', attempts: { increment: 1 }, error: String(error.code || error.message || 'error').slice(0, 300) } }).catch(() => {});
    console.error('Error processing Mercado Pago webhook:', error.code || error.message, error.providerStatus || '');
    return res.status(500).json({ success: false });
  }
});

export default router;
