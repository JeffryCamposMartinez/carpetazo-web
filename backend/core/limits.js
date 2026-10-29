// Límites de solicitudes: general por IP y más estrictos para rutas que escriben o consumen recursos externos.
import crypto from 'crypto';
import net from 'net';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Las vistas previas (WhatsApp, Facebook…) y las páginas para buscadores llegan a la API a través del nginx del sitio,
// todas desde la IP del servidor: sin esto compartirían un solo cupo para todo el mundo. Si nginx se identifica con la
// clave PREVIEW_PROXY_SECRET (cabecera X-Preview-Proxy), se cuenta por la IP real del visitante que nginx informa
// (X-Visitor-Ip). Sin la clave correcta esa cabecera se ignora: nadie puede elegir su IP llamando directo a la API.
const sameProxySecret = (given) => {
  const secret = process.env.PREVIEW_PROXY_SECRET || '';
  if (!secret || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
export const clientIp = (req) => {
  if (sameProxySecret(req.headers['x-preview-proxy'])) {
    const visitor = String(req.headers['x-visitor-ip'] || '').split(',')[0].trim();
    if (net.isIP(visitor)) return visitor;
  }
  return req.ip;
};
const keyByClient = (req) => ipKeyGenerator(clientIp(req));

// IP de confianza sin límite de solicitudes (por ejemplo la del dueño haciendo tareas masivas): RATE_LIMIT_ALLOW_IPS=1.2.3.4,5.6.7.8
// Solo direcciones IP exactas; se compara con la IP real del cliente (la que ve el servidor, no la de la red local).
const allowedIps = new Set((process.env.RATE_LIMIT_ALLOW_IPS || '').split(',').map((value) => value.trim()).filter((value) => net.isIP(value)));
const isAllowedIp = (req) => allowedIps.size > 0 && allowedIps.has(clientIp(req));

const rateLimitMax = Number.parseInt(process.env.RATE_LIMIT_MAX || '2000', 10);

export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.isFinite(rateLimitMax) && rateLimitMax > 0 ? rateLimitMax : 2000,
  // El catálogo de TCGCSV tiene su propio límite: una sola búsqueda de cartas pide decenas de ediciones y gastaba el cupo de toda la sesión
  skip: (req) => req.method === 'OPTIONS' || req.path.startsWith('/tcgcsv/') || isAllowedIp(req),
  keyGenerator: keyByClient,
  message: 'Demasiadas peticiones desde esta IP, por favor intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Límites más estrictos para rutas que escriben o que consumen recursos externos
export const routeLimiter = (windowMs, max) => rateLimit({
  windowMs,
  max,
  skip: (req) => req.method === 'OPTIONS' || isAllowedIp(req),
  keyGenerator: keyByClient,
  message: { success: false, message: 'Demasiadas solicitudes, intenta de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Se aplican sobre la app antes de montar las rutas
export const applyRouteLimits = (app) => {
  app.use('/api/admin/users/:username', routeLimiter(15 * 60 * 1000, 600));
  app.use('/api/admin/users/search', routeLimiter(15 * 60 * 1000, 300));
  app.use('/api/admin/users/:username/plan', routeLimiter(15 * 60 * 1000, 60));
  app.use('/api/billing/checkout', routeLimiter(15 * 60 * 1000, 10));
  app.use('/api/billing/sync', routeLimiter(15 * 60 * 1000, 60));
  app.use('/api/billing/cancel', routeLimiter(15 * 60 * 1000, 10));
  app.use('/api/billing/mercadopago/webhook', routeLimiter(15 * 60 * 1000, 600));
  app.use('/api/orders/create', routeLimiter(15 * 60 * 1000, 20));
  app.use('/api/proxy-image', routeLimiter(15 * 60 * 1000, 600));
  app.use('/api/tcgcsv', routeLimiter(15 * 60 * 1000, 3000));
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
  app.get('/api/cards/mine', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/home/featured', routeLimiter(15 * 60 * 1000, 300));
  app.post('/api/folders', routeLimiter(15 * 60 * 1000, 60));
  app.put('/api/folders/:id', routeLimiter(15 * 60 * 1000, 200));
  app.put('/api/folders/:id/order', routeLimiter(15 * 60 * 1000, 60));
  app.delete('/api/folders/:id', routeLimiter(15 * 60 * 1000, 60));
  app.post('/api/folders/:id/cards', routeLimiter(15 * 60 * 1000, 600));
  app.post('/api/folders/:id/in-person-sales', routeLimiter(15 * 60 * 1000, 120));
  app.get('/api/folders/:id/in-person-sales', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/in-person-sales/mine', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/inventory/export', routeLimiter(60 * 60 * 1000, 20));
  app.get('/api/visits/mine', routeLimiter(15 * 60 * 1000, 120));
  app.get('/api/featured-cards/mine', routeLimiter(15 * 60 * 1000, 300));
  app.put('/api/folders/:id/cards/:cardId/featured', routeLimiter(15 * 60 * 1000, 300));
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
  app.post('/api/users/upload-audio', routeLimiter(15 * 60 * 1000, 60)); // mensajes de voz
  app.get('/api/tcg/search', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/tcg/search-index', routeLimiter(15 * 60 * 1000, 600));
  app.get('/api/tcg/suggest', routeLimiter(15 * 60 * 1000, 600));
  app.post('/api/tcg/products/metadata', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/cards/search', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/cards/:id/offers', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/cards/reference-prices', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/wishlist/me', routeLimiter(15 * 60 * 1000, 300));
  app.get('/api/wishlist/matches', routeLimiter(15 * 60 * 1000, 120));
  app.post('/api/wishlist', routeLimiter(15 * 60 * 1000, 120));
  app.post('/api/wishlists', routeLimiter(15 * 60 * 1000, 60));
  app.put('/api/wishlists/:id', routeLimiter(15 * 60 * 1000, 120));
  app.delete('/api/wishlists/:id', routeLimiter(15 * 60 * 1000, 60));
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
  app.post('/api/admin/backup', routeLimiter(60 * 60 * 1000, 5));
  app.get('/api/admin/backup/status', routeLimiter(15 * 60 * 1000, 60));
  app.post('/api/admin/terms/evidence', routeLimiter(15 * 60 * 1000, 60));
  app.post('/api/reports', routeLimiter(15 * 60 * 1000, 80));
  app.post('/api/feedback', routeLimiter(15 * 60 * 1000, 10));
  app.get('/api/feedback/mine', routeLimiter(15 * 60 * 1000, 100));
  app.use('/api/admin/feedback', routeLimiter(15 * 60 * 1000, 300));
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
  app.use('/api/og', routeLimiter(15 * 60 * 1000, 600)); // vista previa de enlaces: los programas de mensajería la piden seguido, la imagen queda en memoria
  app.use('/api/admin/team', routeLimiter(15 * 60 * 1000, 120)); // buscador del equipo y cambios de rol
  app.use('/api/client-errors', routeLimiter(15 * 60 * 1000, 30)); // errores de la web: pocos por persona, nunca pueden inundar la base
  app.use('/api/chats/stream', routeLimiter(15 * 60 * 1000, 60)); // conexión en tiempo real: se renueva cada ~9 minutos
  app.use('/api/chats/forward', routeLimiter(15 * 60 * 1000, 60));
  app.use('/api/chats/search', routeLimiter(15 * 60 * 1000, 240));
  app.use('/api/chats', routeLimiter(15 * 60 * 1000, 900)); // lista, ajustes y privacidad del chat
  app.use('/api/messages/item', routeLimiter(15 * 60 * 1000, 600)); // reacciones, destacados y correcciones
  app.post('/api/messages/:otherId/read', routeLimiter(15 * 60 * 1000, 900));
  app.use('/api/onboarding', routeLimiter(15 * 60 * 1000, 120)); // guía de primeros pasos
  app.use('/api/notifications', routeLimiter(15 * 60 * 1000, 60)); // preferencias, dispositivos y baja desde el correo
  app.use('/api/seo', routeLimiter(15 * 60 * 1000, 600)); // páginas para buscadores y sitemap: los rastreadores piden muchas seguidas
  app.use('/api/admin/catalog-import', routeLimiter(15 * 60 * 1000, 100));
  app.use('/api/admin/tcg-catalog-import', routeLimiter(15 * 60 * 1000, 400)); // el catálogo completo son decenas de archivos, con dos pedidos cada uno
  app.post('/api/admin/cases/:id/export', routeLimiter(15 * 60 * 1000, 20));
};
