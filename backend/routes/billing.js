// Planes, suscripción propia y notificación de Mercado Pago.
import crypto from 'crypto';
import express from 'express';
import { authenticateToken, isAdminEmail } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { getPlanState, lockPlanUser } from '../core/entitlements.js';
import { adminOnlyPlans, paidPlan, publicPlans, validPlanKey } from '../core/plans.js';

const router = express.Router();
// Incluso si la bandera se configurara por error, producción nunca expone el selector sin cobro.
const TEST_MODE = process.env.BILLING_TEST_MODE === '1' && process.env.NODE_ENV !== 'production';
// Solo en pruebas locales se puede apuntar a un Mercado Pago simulado (tests/run.cjs)
const MP_API = (TEST_MODE && process.env.MERCADOPAGO_TEST_API) || 'https://api.mercadopago.com';
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
    error.providerMessage = typeof body?.message === 'string' ? body.message.slice(0, 200) : '';
    error.providerCause = Array.isArray(body?.cause) ? body.cause.map((item) => item?.code).filter(Boolean).slice(0, 4) : [];
    throw error;
  }
  return body;
};

// Mismos criterios que requireAdmin (core/auth.js): claim de Firebase, rol en la base o correo verificado de ADMIN_EMAILS
const isAdminRequest = (req, user) => req.user?.admin === true || req.user?.role === 'admin' || user?.role === 'admin' || (req.user?.email_verified === true && isAdminEmail(req.user?.email));

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
    const scheduled = subscriptions.find((row) => row.status === 'scheduled');
    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, ...state, scheduledChange: scheduled && state.subscription ? { planKey: scheduled.planKey, priceClp: scheduled.priceClp, effectiveAt: state.subscription.currentPeriodEnd || state.subscription.nextPaymentAt } : null, subscriptions: subscriptions.filter((row) => row.status !== 'scheduled').map(safeSubscription), testMode: TEST_MODE, ...(isAdminRequest(req, user) ? { adminPlans: adminOnlyPlans() } : {}) });
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
    if (plan.adminOnly && !isAdminRequest(req, user)) return res.status(404).json({ success: false, message: 'Selecciona un plan pagado válido' });
    // Un checkout abandonado (Mercado Pago sigue en "pending", sin tarjeta autorizada) no debe bloquear para siempre: se descarta y se crea otro.
    // Si Mercado Pago ya la autorizó, se sincroniza y sigue contando como suscripción existente.
    const stale = await prisma.subscription.findFirst({ where: { userId: user.id, status: 'pending', providerSubscriptionId: { not: null } }, orderBy: { createdAt: 'desc' }, select: { id: true, providerSubscriptionId: true } });
    if (stale) {
      try {
        const remote = await mpFetch(`/preapproval/${encodeURIComponent(stale.providerSubscriptionId)}`);
        if (remote.status === 'pending') {
          await mpFetch(`/preapproval/${encodeURIComponent(stale.providerSubscriptionId)}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) }).catch(() => {});
          await prisma.subscription.updateMany({ where: { id: stale.id, status: 'pending' }, data: { status: 'failed' } });
        } else {
          await syncPreapproval(stale.providerSubscriptionId);
        }
      } catch (error) {
        console.error('Error revisando la suscripción pendiente:', error.code || error.message, error.providerStatus || '');
      }
    }
    const id = crypto.randomUUID();
    const providerPlanId = String(process.env[planEnvKey(plan.key)] || '').trim() || null;
    const existing = await prisma.$transaction(async (tx) => {
      await lockPlanUser(tx, user.id);
      const found = await tx.subscription.findFirst({
        where: { userId: user.id, status: { in: ['pending', 'active', 'past_due', 'paused'] }, cancelAtPeriodEnd: false },
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
          : 'Ya tienes una suscripción. Para cambiar de plan usa «Cambiar de plan» en Tu suscripción.'
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
    // Con el detalle de Mercado Pago (código HTTP, causas y su mensaje: nunca el token) se ve por qué rechazó, p. ej. un monto bajo el mínimo
    console.error('Error creating Mercado Pago subscription:', error.code || error.message, error.providerStatus || '', (error.providerCause || []).join(','), error.providerMessage || '');
    sendBillingError(res, error, 'No se pudo iniciar la suscripción');
  }
});

// Cancelar exige confirmación explícita. Mercado Pago deja de cobrar al instante, pero el plan sigue hasta el fin del período ya pagado.
router.post('/api/billing/cancel', authenticateToken, async (req, res) => {
  try {
    if (req.body?.confirm !== true) return res.status(400).json({ success: false, code: 'confirm_required', message: 'Confirma que quieres cancelar tu suscripción.' });
    const user = await ownUser(req.user.sub);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const subscription = await prisma.subscription.findFirst({ where: { userId: user.id, status: { in: ['active', 'past_due', 'paused', 'pending'] }, cancelAtPeriodEnd: false }, orderBy: { createdAt: 'desc' } });
    if (!subscription) return res.status(404).json({ success: false, message: 'No tienes una suscripción activa' });
    if (subscription.providerSubscriptionId) {
      await mpFetch(`/preapproval/${encodeURIComponent(subscription.providerSubscriptionId)}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
    }
    const paidUntil = subscription.currentPeriodEnd || subscription.nextPaymentAt;
    const keepsAccess = subscription.status === 'active' && paidUntil && paidUntil > new Date();
    await prisma.$transaction(async (tx) => {
      await tx.subscription.deleteMany({ where: { userId: user.id, status: 'scheduled' } });
      await tx.subscription.update({
        where: { id: subscription.id },
        data: keepsAccess
          ? { cancelAtPeriodEnd: true, canceledAt: new Date(), currentPeriodEnd: paidUntil, nextPaymentAt: null }
          : { status: 'canceled', canceledAt: new Date(), cancelAtPeriodEnd: false }
      });
    });
    res.json({ success: true, endsAt: keepsAccess ? paidUntil : null, ...(await getPlanState(prisma, user.id)) });
  } catch (error) {
    console.error('Error canceling subscription:', error.code || error.message, error.providerStatus || '');
    sendBillingError(res, error, 'No se pudo cancelar la suscripción');
  }
});

// Cambiar de plan con una suscripción activa: el nuevo precio se cobra desde el próximo cobro y el plan cambia ese mismo día
// (nadie paga dos veces ni pierde lo ya pagado). Elegir el plan actual deshace un cambio programado.
router.post('/api/billing/change-plan', authenticateToken, async (req, res) => {
  try {
    const plan = paidPlan(req.body?.planKey);
    if (!plan) return res.status(400).json({ success: false, message: 'Selecciona un plan pagado válido' });
    const user = await ownUser(req.user.sub);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (plan.adminOnly && !isAdminRequest(req, user)) return res.status(404).json({ success: false, message: 'Selecciona un plan pagado válido' });
    const subscription = await prisma.subscription.findFirst({ where: { userId: user.id, status: { in: ['active', 'past_due', 'paused', 'pending'] }, cancelAtPeriodEnd: false }, orderBy: { createdAt: 'desc' } });
    if (!subscription || subscription.status !== 'active' || !subscription.providerSubscriptionId) {
      return res.status(409).json({ success: false, code: 'no_active_subscription', message: subscription ? 'Tu suscripción aún no está activa o tiene un pago pendiente.' : 'No tienes una suscripción activa para cambiar.' });
    }
    if (subscription.providerPlanId) return res.status(409).json({ success: false, message: 'Esta suscripción no admite cambio de plan. Cancélala y contrata de nuevo.' });
    const revert = plan.key === subscription.planKey;
    const price = revert ? subscription.priceClp : plan.priceClp;
    await mpFetch(`/preapproval/${encodeURIComponent(subscription.providerSubscriptionId)}`, { method: 'PUT', body: JSON.stringify({ auto_recurring: { transaction_amount: price, currency_id: 'CLP' } }) });
    await prisma.$transaction(async (tx) => {
      await lockPlanUser(tx, user.id);
      await tx.subscription.deleteMany({ where: { userId: user.id, status: 'scheduled' } });
      if (!revert) await tx.subscription.create({ data: { userId: user.id, planKey: plan.key, status: 'scheduled', provider: 'mercadopago', priceClp: plan.priceClp } });
    });
    res.json({ success: true, effectiveAt: subscription.currentPeriodEnd || subscription.nextPaymentAt, ...(await getPlanState(prisma, user.id)) });
  } catch (error) {
    console.error('Error changing subscription plan:', error.code || error.message, error.providerStatus || '', error.providerMessage || '');
    sendBillingError(res, error, 'No se pudo cambiar el plan');
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
  const now = new Date();
  const status = providerStatus(remote.status);
  const nextDate = remote.next_payment_date ? new Date(remote.next_payment_date) : null;
  const data = { providerSubscriptionId: String(remote.id || resourceId), status, nextPaymentAt: nextDate };
  if (status === 'canceled') {
    // Cancelada desde Mercado Pago: lo pagado sigue vigente hasta el fin del período
    const paidUntil = subscription.currentPeriodEnd || subscription.nextPaymentAt;
    data.canceledAt = subscription.canceledAt || now;
    if (subscription.status === 'active' && paidUntil && paidUntil > now) Object.assign(data, { status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: paidUntil, nextPaymentAt: null });
  } else if (status === 'active') {
    data.cancelAtPeriodEnd = false;
    if (nextDate) data.currentPeriodEnd = nextDate;
    data.currentPeriodStart = subscription.currentPeriodStart || now;
    // Un cobro nuevo (el próximo cobro avanzó): rige el plan programado, si lo hay
    if (subscription.status === 'active' && nextDate && subscription.currentPeriodEnd && nextDate > subscription.currentPeriodEnd) {
      data.currentPeriodStart = subscription.currentPeriodEnd;
      const scheduled = await prisma.subscription.findFirst({ where: { userId: subscription.userId, status: 'scheduled' }, orderBy: { createdAt: 'desc' } });
      if (scheduled) {
        Object.assign(data, { planKey: scheduled.planKey, priceClp: scheduled.priceClp });
        await prisma.subscription.delete({ where: { id: scheduled.id } }).catch(() => {});
      }
    }
  }
  const updated = await prisma.subscription.update({ where: { id: subscription.id }, data });
  if (data.status === 'active' && subscription.status !== 'active') {
    // La suscripción nueva reemplaza a una anterior que solo esperaba su fecha de término
    await prisma.subscription.updateMany({ where: { userId: subscription.userId, id: { not: subscription.id }, status: { in: ['active', 'past_due', 'paused'] }, cancelAtPeriodEnd: true }, data: { status: 'expired' } });
  }
  return updated;
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
