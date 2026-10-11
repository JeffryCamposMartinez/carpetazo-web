// Registro de errores propio (sin servicios externos): los errores del servidor y de la web (navegador) se agrupan por huella y se cuentan;
// el equipo recibe un correo cuando aparece un error nuevo y los ve en Moderación → Operación.
// No se guarda nada personal: se limpian correos, RUT, tokens y números largos, y solo se registra la ruta sin identificadores.
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { prisma } from './db.js';
import { sendUserEmail } from './mail.js';

const MAX_PER_MINUTE = 60; // tope de registros: un fallo masivo no llena la base
const ALERT_EVERY_MS = 5 * 60 * 1000;
const KEEP_DAYS = 30;
const context = new AsyncLocalStorage();

export const normalizeRoute = (path) => String(path || '').split('?')[0]
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
  .replace(/\/\d{3,}/g, '/:id')
  .slice(0, 120);

export const scrub = (text, max = 300) => String(text ?? '')
  .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[correo]')
  .replace(/\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g, '[rut]')
  .replace(/Bearer\s+[\w.~+/=-]+/gi, 'Bearer [token]')
  .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[código]')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const firstFrames = (stack) => String(stack || '').split('\n').slice(1, 4).map((line) => line.replace(/\(?(file:\/\/)?[A-Za-z]:?[^)]*[\\/](backend|frontend)[\\/]/i, '(').trim()).join('|');

let windowStart = Date.now();
let windowCount = 0;
const pendingAlerts = new Map(); // huella -> evento nuevo por avisar
let alertTimer = null;

const flushAlerts = async () => {
  alertTimer = null;
  if (!pendingAlerts.size) return;
  const items = [...pendingAlerts.values()].slice(0, 10);
  const extra = pendingAlerts.size - items.length;
  pendingAlerts.clear();
  try {
    const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
    const lines = items.map((item) => `- [${item.kind}] ${item.message}${item.route ? ` (${item.route})` : ''}`);
    const text = `Aparecieron ${items.length + extra} error(es) nuevo(s) en Carpetazo:\n\n${lines.join('\n')}${extra > 0 ? `\n... y ${extra} más` : ''}\n\nRevísalos en https://carpetazo.cl/moderacion (sección Operación).`;
    const html = `<p>Aparecieron <b>${items.length + extra}</b> error(es) nuevo(s) en Carpetazo:</p><ul>${items.map((item) => `<li>[${item.kind}] ${item.message.replace(/[<>&]/g, '')}${item.route ? ` (${item.route.replace(/[<>&]/g, '')})` : ''}</li>`).join('')}</ul><p><a href="https://carpetazo.cl/moderacion">Ver en Moderación → Operación</a></p>`;
    await Promise.all(admins.map((admin) => sendUserEmail(admin.id, { subject: `Carpetazo: ${items.length + extra} error(es) nuevo(s)`, text, html })));
  } catch (_error) { /* el aviso nunca debe causar otro error */ }
};

// Guarda (o cuenta) un error. Nunca lanza.
export const recordError = async ({ kind, message, route = null, stack = null }) => {
  try {
    const now = Date.now();
    if (now - windowStart > 60 * 1000) { windowStart = now; windowCount = 0; }
    if (windowCount >= MAX_PER_MINUTE) return false;
    windowCount += 1;
    const cleanMessage = scrub(message) || 'Error sin mensaje';
    const cleanRoute = route ? normalizeRoute(route) : null;
    const cleanStack = stack ? scrub(firstFrames(stack) || stack, 600) : null;
    const fingerprint = crypto.createHash('sha1').update(`${kind}|${cleanRoute || ''}|${cleanMessage}|${cleanStack || ''}`).digest('hex');
    const rows = await prisma.$queryRaw`
      INSERT INTO "ErrorEvent" ("id", "fingerprint", "kind", "message", "route", "stack", "count", "firstSeen", "lastSeen")
      VALUES (gen_random_uuid()::text, ${fingerprint}, ${kind}, ${cleanMessage}, ${cleanRoute}, ${cleanStack}, 1, now(), now())
      ON CONFLICT ("fingerprint") DO UPDATE SET "count" = "ErrorEvent"."count" + 1, "lastSeen" = now()
      RETURNING (xmax = 0) AS inserted`;
    if (rows[0]?.inserted) {
      pendingAlerts.set(fingerprint, { kind, message: cleanMessage, route: cleanRoute });
      if (!alertTimer) { alertTimer = setTimeout(flushAlerts, ALERT_EVERY_MS); alertTimer.unref?.(); }
    }
    return true;
  } catch (_error) {
    return false;
  }
};

// Contexto de cada petición: ruta (para saber dónde ocurrió el error) y si ya se registró algo
export const requestContext = (req, res, next) => {
  const store = { route: `${req.method} ${normalizeRoute(req.originalUrl || req.url)}`, captured: false };
  res.on('finish', () => {
    if (res.statusCode >= 500 && !store.captured) recordError({ kind: 'http', message: `Respuesta ${res.statusCode}`, route: store.route });
  });
  context.run(store, next);
};

let installed = false;
export const installErrorCapture = () => {
  if (installed || process.env.TEST_AUTH_STUB) return;
  installed = true;
  const original = console.error.bind(console);
  console.error = (...args) => {
    original(...args);
    const error = args.find((arg) => arg instanceof Error);
    if (!error) return;
    const store = context.getStore();
    if (store) store.captured = true;
    recordError({ kind: 'server', message: `${error.name}: ${error.message}`, route: store?.route || null, stack: error.stack });
  };
  process.on('unhandledRejection', (reason) => {
    original('Promesa sin manejar:', reason);
    recordError({ kind: 'server', message: `Promesa rechazada: ${reason?.message || reason}`, stack: reason?.stack });
  });
  process.on('uncaughtException', async (error) => {
    original('Excepción sin capturar:', error);
    await recordError({ kind: 'server', message: `Excepción: ${error.message}`, stack: error.stack });
    await flushAlerts();
    process.exit(1); // el servidor queda en un estado desconocido: se reinicia limpio
  });
};

export const purgeOldErrors = () => prisma.errorEvent.deleteMany({ where: { lastSeen: { lt: new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000) } } });
