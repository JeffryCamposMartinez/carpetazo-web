// Catálogo comercial único. `null` significa sin límite comercial.
export const PLAN_KEYS = ['free', 'enthusiast', 'premium', 'pro', 'store', 'test'];

export const PLANS = Object.freeze({
  free: Object.freeze({ key: 'free', name: 'Free', priceClp: 0, folders: 1, uniqueCardsPerFolder: 54, copiesPerCard: 25, foldersPerTcg: 1 }),
  enthusiast: Object.freeze({ key: 'enthusiast', name: 'Entusiasta', priceClp: 990, folders: 3, uniqueCardsPerFolder: 54, copiesPerCard: 25, foldersPerTcg: 2 }),
  premium: Object.freeze({ key: 'premium', name: 'Premium', priceClp: 2990, folders: 8, uniqueCardsPerFolder: 72, copiesPerCard: 50, foldersPerTcg: null }),
  pro: Object.freeze({ key: 'pro', name: 'Pro', priceClp: 4990, folders: 20, uniqueCardsPerFolder: 108, copiesPerCard: 100, foldersPerTcg: null }),
  store: Object.freeze({ key: 'store', name: 'Tienda', priceClp: 9990, folders: null, uniqueCardsPerFolder: null, copiesPerCard: null, foldersPerTcg: null }),
  // Solo administradores: sirve para probar una suscripción real con un cobro mínimo de Mercado Pago, $950 en CLP (no se lista ni se puede contratar sin serlo)
  test: Object.freeze({ key: 'test', name: 'Prueba', priceClp: 950, folders: 3, uniqueCardsPerFolder: 54, copiesPerCard: 25, foldersPerTcg: 2, adminOnly: true })
});

const PLAN_BADGES = Object.freeze({
  enthusiast: Object.freeze({ key: 'enthusiast', label: 'Entusiasta' }),
  premium: Object.freeze({ key: 'premium', label: 'Premium' }),
  pro: Object.freeze({ key: 'pro', label: 'Pro' }),
  store: Object.freeze({ key: 'store', label: 'Tienda' })
});

export const paidPlan = (key) => (key && key !== 'free' ? PLANS[key] || null : null);
export const validPlanKey = (key) => typeof key === 'string' && PLAN_KEYS.includes(key);
export const publicPlans = () => PLAN_KEYS.filter((key) => !PLANS[key].adminOnly).map((key) => ({ ...PLANS[key] }));
export const adminOnlyPlans = () => PLAN_KEYS.filter((key) => PLANS[key].adminOnly).map((key) => ({ ...PLANS[key] }));
export const publicPlanBadge = (key) => PLAN_BADGES[key] ? { ...PLAN_BADGES[key] } : null;

export const limitReached = (current, limit, increase = 1) => limit !== null && current + increase > limit;
