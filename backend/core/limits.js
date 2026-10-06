// Límites de solicitudes: general por IP y más estrictos para rutas que escriben o consumen recursos externos.
import rateLimit from 'express-rate-limit';

const rateLimitMax = Number.parseInt(process.env.RATE_LIMIT_MAX || '2000', 10);

export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.isFinite(rateLimitMax) && rateLimitMax > 0 ? rateLimitMax : 2000,
  skip: (req) => req.method === 'OPTIONS',
  message: 'Demasiadas peticiones desde esta IP, por favor intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Límites más estrictos para rutas que escriben o que consumen recursos externos
export const routeLimiter = (windowMs, max) => rateLimit({
  windowMs,
  max,
  skip: (req) => req.method === 'OPTIONS',
  message: { success: false, message: 'Demasiadas solicitudes, intenta de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Se aplican sobre la app antes de montar las rutas
export const applyRouteLimits = (app) => {
  app.use('/api/orders/create', routeLimiter(15 * 60 * 1000, 20));
  app.use('/api/proxy-image', routeLimiter(15 * 60 * 1000, 600));
  app.use('/api/folders/:id/visit', routeLimiter(15 * 60 * 1000, 120));
  app.use('/api/users/username/check', routeLimiter(15 * 60 * 1000, 60));
  app.use('/api/users/username/available', routeLimiter(15 * 60 * 1000, 60));
  app.use('/api/orders/mine/:id/status', routeLimiter(15 * 60 * 1000, 120));
  app.use('/api/folders/me/stats', routeLimiter(15 * 60 * 1000, 600));
  app.use('/api/folders/:id/cards-bulk', routeLimiter(15 * 60 * 1000, 120));
  app.use('/api/orders/mine/pending', routeLimiter(15 * 60 * 1000, 600));
  // Rutas que escriben datos o hacen consultas pesadas
  app.get('/api/folders/search', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/sellers', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/home/featured', routeLimiter(15 * 60 * 1000, 300));
  app.post('/api/folders', routeLimiter(15 * 60 * 1000, 60));
  app.put('/api/folders/:id', routeLimiter(15 * 60 * 1000, 200));
  app.put('/api/folders/:id/order', routeLimiter(15 * 60 * 1000, 60));
  app.delete('/api/folders/:id', routeLimiter(15 * 60 * 1000, 60));
  app.post('/api/folders/:id/cards', routeLimiter(15 * 60 * 1000, 600));
  app.put('/api/folders/:id/cards/:cardId', routeLimiter(15 * 60 * 1000, 600));
  app.delete('/api/folders/:id/cards/:cardId', routeLimiter(15 * 60 * 1000, 600));
  app.delete('/api/cards/:id', routeLimiter(15 * 60 * 1000, 600));
  app.post('/api/messages', routeLimiter(15 * 60 * 1000, 300));
  app.post('/api/messages/:otherId', routeLimiter(15 * 60 * 1000, 300));
  app.post('/api/messages/:otherId/typing', routeLimiter(15 * 60 * 1000, 900));
  app.put('/api/messages/:id/read', routeLimiter(15 * 60 * 1000, 600));
  app.post('/api/users/sync', routeLimiter(15 * 60 * 1000, 60));
  app.put('/api/users/me', routeLimiter(15 * 60 * 1000, 60));
  app.delete('/api/users/me', routeLimiter(15 * 60 * 1000, 10));
  app.post('/api/users/upload-image', routeLimiter(15 * 60 * 1000, 30));
  app.get('/api/tcg/search', routeLimiter(15 * 60 * 1000, 300));
  app.post('/api/tcg/products/metadata', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/cards/search', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/cards/:id/offers', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/cards/reference-prices', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/wishlist/me', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/wishlist/matches', routeLimiter(15 * 60 * 1000, 120));
  app.post('/api/wishlist', routeLimiter(15 * 60 * 1000, 120));
  app.put('/api/wishlist/:id', routeLimiter(15 * 60 * 1000, 120));
  app.delete('/api/wishlist/:id', routeLimiter(15 * 60 * 1000, 120));
  app.get('/api/users/:username/wishlist', routeLimiter(15 * 60 * 1000, 300));
  app.post('/api/reviews', routeLimiter(15 * 60 * 1000, 20));
  app.get('/api/reviews/pending', routeLimiter(15 * 60 * 1000, 300));
  app.post('/api/reviews/:id/report', routeLimiter(15 * 60 * 1000, 10));
  app.get('/api/users/:username/reviews', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/tcg/sets', routeLimiter(15 * 60 * 1000, 120));
  app.get('/api/tcg/cards', routeLimiter(15 * 60 * 1000, 120));
  app.get('/api/folders', routeLimiter(15 * 60 * 1000, 120));
  app.use('/api/admin/reviews', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/legal/versions', routeLimiter(15 * 60 * 1000, 300));
  app.post('/api/users/me/accept-terms', routeLimiter(15 * 60 * 1000, 30));
  app.delete('/api/users/me/unaccepted', routeLimiter(15 * 60 * 1000, 10));
  app.post('/api/admin/test-email', routeLimiter(15 * 60 * 1000, 10));
  app.post('/api/admin/terms/evidence', routeLimiter(15 * 60 * 1000, 60));
  app.post('/api/reports', routeLimiter(15 * 60 * 1000, 80));
  app.get('/api/reports/reasons', routeLimiter(15 * 60 * 1000, 200));
  app.get('/api/reports/mine', routeLimiter(15 * 60 * 1000, 100));
  app.use('/api/admin/reports', routeLimiter(15 * 60 * 1000, 300));
  app.use('/api/admin/audit', routeLimiter(15 * 60 * 1000, 120));
  app.use('/api/admin/cases', routeLimiter(15 * 60 * 1000, 300));
  app.use('/api/admin/sanctions', routeLimiter(15 * 60 * 1000, 200));
  app.use('/api/admin/appeals', routeLimiter(15 * 60 * 1000, 200));
  app.use('/api/admin/users', routeLimiter(15 * 60 * 1000, 200));
  app.use('/api/admin/evidence', routeLimiter(15 * 60 * 1000, 300));
  app.post('/api/reports/:id/evidence', routeLimiter(15 * 60 * 1000, 20));
  app.post('/api/appeals', routeLimiter(15 * 60 * 1000, 10));
  app.get('/api/me/moderation', routeLimiter(15 * 60 * 1000, 100));
  app.post('/api/me/cases/:id/response', routeLimiter(15 * 60 * 1000, 10));
  app.use('/api/blocks', routeLimiter(15 * 60 * 1000, 100));
  app.get('/api/me/orders/:code', routeLimiter(15 * 60 * 1000, 40));
  app.get('/api/admin/metrics', routeLimiter(15 * 60 * 1000, 60));
  app.get('/api/admin/summary', routeLimiter(15 * 60 * 1000, 300));
  app.use('/api/admin/retention', routeLimiter(15 * 60 * 1000, 30));
  app.post('/api/admin/cases/:id/export', routeLimiter(15 * 60 * 1000, 20));
};
