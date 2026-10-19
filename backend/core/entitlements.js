import { PLANS, limitReached, validPlanKey } from './plans.js';

const ACTIVE_SUBSCRIPTION_STATES = ['active', 'past_due'];
const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const QUOTA_MESSAGES = {
  plan_folder_limit: 'Alcanzaste el máximo de carpetas de tu plan.',
  plan_unique_card_limit: 'Esta carpeta alcanzó el máximo de cartas únicas de tu plan.',
  plan_copy_limit: 'Alcanzaste el máximo de copias de esta carta para tu plan.',
  card_identity_conflict: 'Esta carta ya existe en la carpeta con el mismo idioma.'
};

export class PlanLimitError extends Error {
  constructor(code, { current = null, limit = null, planKey = 'free', details = {} } = {}) {
    super(QUOTA_MESSAGES[code] || 'La operación supera los límites de tu plan.');
    this.code = code;
    this.status = 409;
    this.current = current;
    this.limit = limit;
    this.planKey = planKey;
    this.details = details;
  }
}

export const sendPlanError = (res, error) => res.status(error.status || 409).json({
  success: false,
  code: error.code || 'plan_limit',
  message: error.message,
  plan: error.planKey,
  current: error.current,
  limit: error.limit,
  ...error.details
});

const activeGrantWhere = (userId, now) => ({
  userId,
  revokedAt: null,
  // Tolerancia de 2 s: startsAt lo fija el motor de Prisma y su reloj puede ir unos ms por delante del de Node.
  startsAt: { lte: new Date(now.getTime() + 2000) },
  OR: [{ endsAt: null }, { endsAt: { gt: now } }]
});

export const getEffectivePlan = async (db, userId, now = new Date()) => {
  // Una concesión «Free» no manda sobre nada: quitar un plan asignado vuelve al plan automático, y una suscripción pagada siempre cuenta
  const grant = await db.planGrant.findFirst({
    where: { ...activeGrantWhere(userId, now), planKey: { not: 'free' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, planKey: true, endsAt: true, reason: true }
  });
  if (grant && validPlanKey(grant.planKey)) return { plan: PLANS[grant.planKey], source: 'grant', grant };

  // Una cancelación programada conserva el plan hasta el fin del período pagado; después vuelve a Free
  const subscriptions = await db.subscription.findMany({
    where: { userId, status: { in: ACTIVE_SUBSCRIPTION_STATES } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, planKey: true, status: true, provider: true, priceClp: true, currentPeriodEnd: true, nextPaymentAt: true, cancelAtPeriodEnd: true, updatedAt: true }
  });
  const subscription = subscriptions.find((row) => !(row.cancelAtPeriodEnd && row.currentPeriodEnd && row.currentPeriodEnd <= now));
  if (subscription && validPlanKey(subscription.planKey)) {
    const graceBase = subscription.currentPeriodEnd || subscription.updatedAt;
    const graceUntil = subscription.status === 'past_due' ? new Date(graceBase.getTime() + PAST_DUE_GRACE_MS) : null;
    if (subscription.status !== 'past_due' || graceUntil > now) {
      // Cambio de plan programado (fila 'scheduled'): rige desde el fin del período ya pagado, sin esperar al aviso de Mercado Pago
      const scheduled = await db.subscription.findFirst({ where: { userId, status: 'scheduled' }, orderBy: { createdAt: 'desc' }, select: { planKey: true } });
      const due = scheduled && validPlanKey(scheduled.planKey) && subscription.currentPeriodEnd && subscription.currentPeriodEnd <= now;
      return { plan: PLANS[due ? scheduled.planKey : subscription.planKey], source: 'subscription', subscription: { ...subscription, graceUntil, scheduledPlanKey: scheduled?.planKey || null } };
    }
  }
  return { plan: PLANS.free, source: 'default' };
};

export const getPlanUsage = async (db, userId) => {
  const folders = await db.folder.findMany({
    where: { userId },
    select: { id: true, _count: { select: { cards: true } }, cards: { select: { stock: true }, orderBy: { stock: 'desc' }, take: 1 } }
  });
  const byFolder = {};
  for (const folder of folders) {
    byFolder[folder.id] = { uniqueCards: folder._count.cards, highestCopies: folder.cards[0]?.stock || 0 };
  }
  return { folders: folders.length, byFolder };
};

export const getPlanState = async (db, userId) => {
  const [{ plan, source, grant, subscription }, usage] = await Promise.all([getEffectivePlan(db, userId), getPlanUsage(db, userId)]);
  return { plan: { ...plan }, source, grant: grant || null, subscription: subscription || null, usage };
};

export const lockPlanUser = (tx, userId) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'plan:' + userId}))`;

export const assertCanCreateFolder = async (tx, userId) => {
  const { plan } = await getEffectivePlan(tx, userId);
  const folders = await tx.folder.count({ where: { userId } });
  if (limitReached(folders, plan.folders)) throw new PlanLimitError('plan_folder_limit', { current: folders, limit: plan.folders, planKey: plan.key });
  return plan;
};

export const assertStockChange = (plan, previousStock, nextStock) => {
  if (nextStock > previousStock && plan.copiesPerCard !== null && nextStock > plan.copiesPerCard) {
    throw new PlanLimitError('plan_copy_limit', { current: previousStock, limit: plan.copiesPerCard, planKey: plan.key, details: { requested: nextStock } });
  }
};

export const assertCanAddUniqueCard = async (tx, userId, folderId, stock) => {
  const { plan } = await getEffectivePlan(tx, userId);
  const uniqueCards = await tx.card.count({ where: { folderId } });
  if (limitReached(uniqueCards, plan.uniqueCardsPerFolder)) throw new PlanLimitError('plan_unique_card_limit', { current: uniqueCards, limit: plan.uniqueCardsPerFolder, planKey: plan.key });
  assertStockChange(plan, 0, stock);
  return plan;
};
