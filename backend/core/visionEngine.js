// Motor de reconocimiento del escáner: llamada con respaldo opcional, vigilancia y aviso al equipo cuando no responde.
// VISION_ENGINE_URL / VISION_ENGINE_KEY = motor principal. VISION_ENGINE_FALLBACK_URL / VISION_ENGINE_FALLBACK_KEY = motor de respaldo (opcional):
// si el principal no contesta se prueba con el de respaldo en la misma petición. Sin respaldo, el escaneo falla con un mensaje claro.
import { prisma } from './db.js';
import { sendUserEmail } from './mail.js';
import { recordError } from './errorLog.js';

const ALERT_AFTER_FAILURES = 3; // fallos seguidos antes de avisar (un tropiezo aislado no despierta a nadie)
const ALERT_EVERY_MS = 30 * 60 * 1000; // un aviso de caída cada media hora como máximo
const PROBE_EVERY_MS = 60 * 1000;
const PRIMARY_TIMEOUT_WITH_FALLBACK_MS = 9000; // con respaldo no se espera 30 s a un motor caído

const base = (value) => String(value || '').replace(/\/+$/, '');
const engines = () => ({
  primary: { name: 'principal', url: base(process.env.VISION_ENGINE_URL), key: process.env.VISION_ENGINE_KEY || '' },
  fallback: { name: 'respaldo', url: base(process.env.VISION_ENGINE_FALLBACK_URL), key: process.env.VISION_ENGINE_FALLBACK_KEY || '' },
});
const usable = (engine) => Boolean(engine.url && engine.key);

const state = { failures: 0, downSince: null, lastAlertAt: 0, alerted: false, lastOkAt: 0, lastCheckAt: 0, usingFallback: false };

export const engineConfigured = () => usable(engines().primary);

// Estado para la vigilancia externa: solo si el escáner puede responder ahora (sin direcciones ni claves)
export const engineStatus = () => ({
  available: state.failures < ALERT_AFTER_FAILURES || state.usingFallback,
  backup: usable(engines().fallback),
  usingBackup: state.usingFallback,
  failures: state.failures,
});

const notifyAdmins = async (subject, text) => {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } });
    await Promise.all(admins.map((admin) => sendUserEmail(admin.id, { subject, text, html: `<p>${text.replace(/\n/g, '<br>')}</p>` })));
  } catch (_error) { /* el aviso nunca debe causar otro error */ }
};

const markFailure = (detail) => {
  state.failures += 1;
  state.lastCheckAt = Date.now();
  if (!state.downSince) state.downSince = Date.now();
  if (state.failures >= ALERT_AFTER_FAILURES && Date.now() - state.lastAlertAt > ALERT_EVERY_MS) {
    state.lastAlertAt = Date.now();
    state.alerted = true;
    recordError({ kind: 'scanner', message: `El motor del escáner no responde (${detail})`, route: 'scanner' });
    notifyAdmins('Carpetazo: el escáner no responde', `El motor de reconocimiento del escáner lleva ${state.failures} fallos seguidos (${detail}).\n\nMientras tanto el escáner no puede reconocer cartas; el resto de la web funciona. Revisa el equipo donde corre el motor (notebook) o su conexión.${usable(engines().fallback) ? '' : '\n\nNo hay motor de respaldo configurado.'}`);
  }
};

const markOk = (usedFallback) => {
  const wasDown = state.alerted;
  const downFor = state.downSince ? Math.round((Date.now() - state.downSince) / 60000) : 0;
  state.failures = usedFallback ? state.failures : 0;
  state.usingFallback = usedFallback;
  state.lastOkAt = Date.now();
  state.lastCheckAt = Date.now();
  if (!usedFallback) { state.downSince = null; state.alerted = false; }
  if (wasDown && !usedFallback) notifyAdmins('Carpetazo: el escáner volvió a responder', `El motor del escáner respondió de nuevo después de unos ${downFor} minuto(s) sin servicio.`);
};

const call = (engine, path, init, timeoutMs) => fetch(`${engine.url}${path}`, {
  ...init,
  headers: { ...(init.headers || {}), 'x-service-key': engine.key },
  redirect: 'error',
  signal: AbortSignal.timeout(timeoutMs),
});

// Llama al motor: primero el principal y, si falla (sin red, tiempo agotado o error 5xx), el de respaldo. Devuelve la Response del que contestó.
// Un error 4xx del motor no es una caída: se devuelve tal cual. Lanza si ninguno contestó.
export async function engineFetch(path, init, { timeoutMs = 30000 } = {}) {
  const { primary, fallback } = engines();
  const hasFallback = usable(fallback);
  let lastError = null;
  for (const [engine, isFallback] of [[primary, false], [fallback, true]]) {
    if (!usable(engine)) continue;
    try {
      const response = await call(engine, path, init, !isFallback && hasFallback ? Math.min(timeoutMs, PRIMARY_TIMEOUT_WITH_FALLBACK_MS) : timeoutMs);
      if (response.status >= 500) throw new Error(`respondió ${response.status}`);
      markOk(isFallback);
      return response;
    } catch (error) {
      lastError = error;
      if (!isFallback) markFailure(error.message || 'sin respuesta'); // cuenta la caída del principal aunque el respaldo conteste
    }
  }
  throw lastError || new Error('Motor no configurado');
}

// Vigilancia: cada minuto se pregunta al motor principal si está vivo, para avisar aunque nadie esté escaneando
let probeTimer = null;
export function startEngineWatch() {
  if (probeTimer || !engineConfigured() || process.env.TEST_AUTH_STUB === '1') return;
  const probe = async () => {
    const { primary } = engines();
    try {
      const response = await fetch(`${primary.url}/health`, { signal: AbortSignal.timeout(6000), redirect: 'error' });
      if (!response.ok) throw new Error(`salud ${response.status}`);
      markOk(false);
    } catch (error) {
      markFailure(error.message || 'sin respuesta');
    }
  };
  probeTimer = setInterval(probe, PROBE_EVERY_MS);
  probeTimer.unref?.();
}

// Calienta la conexión con el motor justo antes de escanear (la web lo pide al abrir la cámara): así la primera foto no paga la conexión.
// Una vez cada 10 s como máximo, sin esperar la respuesta y sin contar como fallo ni como acierto del motor.
let lastWarmAt = 0;
export const warmEngine = () => {
  const now = Date.now();
  if (!engineConfigured() || process.env.TEST_AUTH_STUB === '1' || now - lastWarmAt < 10000) return false;
  lastWarmAt = now;
  fetch(`${engines().primary.url}/health`, { signal: AbortSignal.timeout(4000), redirect: 'error' }).catch(() => {});
  return true;
};

// Solo para las pruebas
export const __resetEngineState = () => { lastWarmAt = 0; return Object.assign(state, { failures: 0, downSince: null, lastAlertAt: 0, alerted: false, lastOkAt: 0, lastCheckAt: 0, usingFallback: false }); };
