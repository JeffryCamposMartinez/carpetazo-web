// Catálogo comercial único. `null` significa sin límite comercial.
// Funciones por plan: quien baja de plan conserva lo que ya tiene (listas, banner, redes…) pero no puede agregar más; solo los avisos y la prioridad se ajustan al plan vigente.
export const PLAN_KEYS = ['free', 'enthusiast', 'premium', 'pro', 'store', 'test'];

export const PLANS = Object.freeze({
  free: Object.freeze({ key: 'free', name: 'Común', priceClp: 0, folders: 1, uniqueCardsPerFolder: 45, copiesPerCard: 10, wishlistLists: 1, wishlistItems: 25, profileBanner: false, profileStudio: false, socialLinks: 1, featuredCards: 3, visitsDetail: false, listingBoost: 0, inventoryExport: false, prioritySupport: false }),
  enthusiast: Object.freeze({ key: 'enthusiast', name: 'Raro', priceClp: 990, folders: 3, uniqueCardsPerFolder: 54, copiesPerCard: 20, wishlistLists: 3, wishlistItems: 50, profileBanner: true, profileStudio: false, socialLinks: 2, featuredCards: 6, visitsDetail: false, listingBoost: 0, inventoryExport: true, prioritySupport: false }),
  premium: Object.freeze({ key: 'premium', name: 'Épico', priceClp: 1990, folders: 8, uniqueCardsPerFolder: 72, copiesPerCard: 40, wishlistLists: 6, wishlistItems: 100, profileBanner: true, profileStudio: true, socialLinks: 3, featuredCards: 12, visitsDetail: true, listingBoost: 0, inventoryExport: true, prioritySupport: false }),
  pro: Object.freeze({ key: 'pro', name: 'Legendario', priceClp: 3990, folders: 20, uniqueCardsPerFolder: 108, copiesPerCard: 80, wishlistLists: 10, wishlistItems: 150, profileBanner: true, profileStudio: true, socialLinks: 3, featuredCards: 24, visitsDetail: true, listingBoost: 1, inventoryExport: true, prioritySupport: true }),
  store: Object.freeze({ key: 'store', name: 'Tienda', priceClp: 9990, folders: null, uniqueCardsPerFolder: null, copiesPerCard: null, wishlistLists: 10, wishlistItems: 300, profileBanner: true, profileStudio: true, socialLinks: 3, featuredCards: 48, visitsDetail: true, listingBoost: 2, inventoryExport: true, prioritySupport: true }),
  // Solo administradores: sirve para probar una suscripción real con un cobro mínimo de Mercado Pago, $950 en CLP (no se lista ni se puede contratar sin serlo)
  test: Object.freeze({ key: 'test', name: 'Prueba', priceClp: 950, folders: 3, uniqueCardsPerFolder: 54, copiesPerCard: 25, adminOnly: true, wishlistLists: 3, wishlistItems: 50, profileBanner: true, profileStudio: false, socialLinks: 2, featuredCards: 6, visitsDetail: false, listingBoost: 0, inventoryExport: true, prioritySupport: false })
});

const PLAN_BADGES = Object.freeze({
  free: Object.freeze({ key: 'free', label: 'Común' }),
  enthusiast: Object.freeze({ key: 'enthusiast', label: 'Raro' }),
  premium: Object.freeze({ key: 'premium', label: 'Épico' }),
  pro: Object.freeze({ key: 'pro', label: 'Legendario' }),
  store: Object.freeze({ key: 'store', label: 'Tienda' })
});

export const paidPlan = (key) => (key && key !== 'free' ? PLANS[key] || null : null);
export const validPlanKey = (key) => typeof key === 'string' && PLAN_KEYS.includes(key);
export const publicPlans = () => PLAN_KEYS.filter((key) => !PLANS[key].adminOnly).map((key) => ({ ...PLANS[key] }));
export const adminOnlyPlans = () => PLAN_KEYS.filter((key) => PLANS[key].adminOnly).map((key) => ({ ...PLANS[key] }));
export const publicPlanBadge = (key) => PLAN_BADGES[key] ? { ...PLAN_BADGES[key] } : null;

export const limitReached = (current, limit, increase = 1) => limit !== null && current + increase > limit;
