// Escaneo de imágenes subidas con servicios externos en cascada:
//   1. Sightengine (principal)  2. Google Cloud Vision SafeSearch (respaldo)  3. si ninguno responde: política por confianza de la cuenta.
// No hay modelo local: si los dos servicios fallan, decide la reputación de quien sube (ver uploadDecision en server.js).
// Las claves vienen de variables de entorno: SIGHTENGINE_USER, SIGHTENGINE_SECRET, GOOGLE_VISION_KEY. Nunca se registran.
import crypto from 'node:crypto';
import sharp from 'sharp';
import { dHashOf } from './perceptual.js';

const DAY = 24 * 60 * 60 * 1000;
const SCAN_SIZE = 768;                  // lado mayor de la copia que se envía a los servicios
const CACHE_DAYS = 30;                  // cuánto vale un veredicto guardado por sha256
const QUOTA_SAFETY = 0.95;              // se deja de usar un servicio al llegar al 95 % de su cuota mensual
const USAGE_CACHE_MS = 30 * 1000;
const ALLOWED_FORMATS = ['jpeg', 'png', 'webp', 'gif'];


// Umbrales por tipo de imagen. Las ilustraciones de cartas (Mitos y Leyendas, Pokémon, etc.) se tratan con un umbral más permisivo.
export const THRESHOLDS = {
  profile: { block: 0.85, review: 0.5, suggestive: 0.9, violence: 0.95 },
  card: { block: 0.95, review: 0.8, suggestive: 0.8, violence: 1.01 } // violencia nunca bloquea ni revisa en cartas
};

const LIKELIHOOD = { VERY_UNLIKELY: 0, UNLIKELY: 0.15, POSSIBLE: 0.5, LIKELY: 0.8, VERY_LIKELY: 0.95 };

// block: rechazar · review: publicar y revisar · clear: publicar
export const decide = (scores, kind) => {
  const t = THRESHOLDS[kind] || THRESHOLDS.profile;
  const explicit = scores.explicit ?? 0;
  const suggestive = scores.suggestive ?? 1;
  if (kind === 'card') {
    if (explicit >= t.block && suggestive >= t.suggestive) return 'block';
    return explicit >= t.review ? 'review' : 'clear';
  }
  if (explicit >= t.block) return 'block';
  if (explicit >= t.review || (scores.suggestive ?? 0) >= t.suggestive || (scores.violence ?? 0) >= t.violence) return 'review';
  return 'clear';
};

// Las variables pegadas en un panel suelen traer un espacio, un salto de línea o comillas de más: eso rompería la autenticación sin avisar
export const cleanEnv = (value) => (typeof value === 'string' ? value.trim().replace(/^(['"])(.*)\1$/s, '$2').trim() : '');

const failure = (code) => Object.assign(new Error(`scan_${code}`), { scanCode: code });

const timed = (ms) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
};

// ---------- Proveedores ----------
const sightengineProvider = ({ user, secret, fetchImpl }) => ({
  name: 'sightengine',
  async check(buffer, signal) {
    const form = new FormData();
    form.append('media', new Blob([buffer], { type: 'image/jpeg' }), 'image.jpg');
    form.append('models', 'nudity-2.1'); // un solo modelo: cada modelo adicional consume operaciones de la cuota
    form.append('api_user', user);
    form.append('api_secret', secret);
    const res = await fetchImpl('https://api.sightengine.com/1.0/check.json', { method: 'POST', body: form, signal });
    let json = null;
    try { json = await res.json(); } catch (_error) { json = null; }
    if (!res.ok || json?.status === 'failure') {
      const type = json?.error?.type;
      if (type === 'usage_limit') throw failure('quota');
      if (type === 'credentials_error') throw failure('auth');
      if (type === 'media_error') throw failure('media');
      if (res.status === 429) throw failure('rate');
      throw failure('transient');
    }
    const nudity = json?.nudity;
    if (!nudity || typeof nudity.none !== 'number') throw failure('transient');
    return {
      scores: { explicit: Math.max(nudity.sexual_activity || 0, nudity.sexual_display || 0, nudity.erotica || 0), suggestive: nudity.very_suggestive ?? null, violence: null },
      operations: Number(json?.request?.operations) || 1
    };
  }
});

const googleProvider = ({ key, fetchImpl }) => ({
  name: 'google',
  async check(buffer, signal) {
    const body = { requests: [{ image: { content: buffer.toString('base64') }, features: [{ type: 'SAFE_SEARCH_DETECTION' }] }] };
    const res = await fetchImpl(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    let json = null;
    try { json = await res.json(); } catch (_error) { json = null; }
    const status = json?.error?.status;
    if (res.status === 429 || status === 'RESOURCE_EXHAUSTED') throw failure('quota');
    if (res.status === 401 || res.status === 403 || status === 'PERMISSION_DENIED' || status === 'UNAUTHENTICATED') throw failure('auth');
    if (status === 'INVALID_ARGUMENT') throw failure('media');
    if (!res.ok) throw failure('transient');
    const first = json?.responses?.[0];
    if (first?.error) throw failure(first.error.code === 8 ? 'quota' : first.error.code === 3 ? 'media' : 'transient');
    const annotation = first?.safeSearchAnnotation;
    if (!annotation) throw failure('transient');
    const level = (value) => (value in LIKELIHOOD ? LIKELIHOOD[value] : null);
    return { scores: { explicit: level(annotation.adult), suggestive: level(annotation.racy), violence: level(annotation.violence) }, operations: 1 };
  }
});

// ---------- Escáner en cascada ----------
export const createImageScanner = ({ prisma, env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now() }) => {
  // Cuotas mensuales gratuitas de cada servicio (se pueden ajustar por variable de entorno)
  const LIMITS = { sightengine: Number(env.SIGHTENGINE_MONTHLY_LIMIT) || 2000, google: Number(env.GOOGLE_VISION_MONTHLY_LIMIT) || 1000 };
  const providers = [];
  const sightengineUser = cleanEnv(env.SIGHTENGINE_USER);
  const sightengineSecret = cleanEnv(env.SIGHTENGINE_SECRET);
  const googleKey = cleanEnv(env.GOOGLE_VISION_KEY);
  if (sightengineUser && sightengineSecret) providers.push(sightengineProvider({ user: sightengineUser, secret: sightengineSecret, fetchImpl }));
  if (googleKey) providers.push(googleProvider({ key: googleKey, fetchImpl }));
  const testMode = env.TEST_AUTH_STUB === '1' && env.IMAGE_SCAN_TEST === '1';
  const enabled = env.IMAGE_SCAN_DISABLED !== '1' && (providers.length > 0 || testMode);
  const totalBudgetMs = Number(env.IMAGE_SCAN_BUDGET_MS) || 8000;
  const providerTimeoutMs = Number(env.IMAGE_SCAN_PROVIDER_TIMEOUT_MS) || 4000;

  const month = () => new Date(now()).toISOString().slice(0, 7);
  const usageCache = new Map(); // proveedor -> { month, used, until }
  const breakers = new Map();   // proveedor -> { fails, openUntil }

  const usedThisMonth = async (name) => {
    const hit = usageCache.get(name);
    if (hit && hit.month === month() && hit.until > now()) return hit.used;
    const row = await prisma.scanUsage.findUnique({ where: { provider_month: { provider: name, month: month() } }, select: { used: true } });
    const used = row?.used || 0;
    usageCache.set(name, { month: month(), used, until: now() + USAGE_CACHE_MS });
    return used;
  };
  const canUse = async (name) => (await usedThisMonth(name)) < Math.floor((LIMITS[name] || 0) * QUOTA_SAFETY);
  const recordUsage = async (name, operations) => {
    await prisma.scanUsage.upsert({ where: { provider_month: { provider: name, month: month() } }, create: { provider: name, month: month(), used: operations }, update: { used: { increment: operations } } });
    usageCache.delete(name);
  };
  const markExhausted = async (name) => {
    const limit = LIMITS[name] || 0;
    const used = await usedThisMonth(name);
    if (used < limit) await prisma.scanUsage.upsert({ where: { provider_month: { provider: name, month: month() } }, create: { provider: name, month: month(), used: limit }, update: { used: limit } });
    usageCache.delete(name);
  };
  const breakerOpen = (name) => (breakers.get(name)?.openUntil || 0) > now();
  const breakerFail = (name, openMs) => {
    const state = breakers.get(name) || { fails: 0, openUntil: 0 };
    state.fails += 1;
    if (openMs || state.fails >= 3) { state.openUntil = now() + (openMs || 60 * 1000); state.fails = 0; }
    breakers.set(name, state);
  };
  const breakerOk = (name) => breakers.set(name, { fails: 0, openUntil: 0 });

  const logEvent = (event) => prisma.scanEvent.create({ data: event }).catch(() => {});

  // Un aviso por proveedor y causa cada 5 minutos en el log (sin credenciales ni direcciones)
  const warned = new Map();
  const warnOnce = (name, code) => {
    const key = name + ':' + code;
    if ((warned.get(key) || 0) > now()) return;
    warned.set(key, now() + 5 * 60 * 1000);
    console.warn('Image scan: ' + name + ' no respondió (' + code + ')');
  };

  // Devuelve { verdict: 'clear' | 'review' | 'block' | 'unavailable', provider, scores, ms, fallback }
  const scan = async (buffer, { kind = 'profile', force = null } = {}) => {
    const started = now();
    if (force && env.TEST_AUTH_STUB === '1') {
      const forced = { verdict: force, provider: force === 'unavailable' ? null : 'sightengine', scores: null, ms: 0, fallback: false };
      logEvent({ provider: forced.provider || 'none', kind, verdict: force, fallback: false, ms: 0 });
      return forced;
    }
    let fallback = false;
    const attempts = [];
    const deadline = started + totalBudgetMs;
    for (const provider of providers) {
      const remaining = deadline - now();
      if (remaining < 400) break;
      if (!(await canUse(provider.name))) { attempts.push(provider.name + ':cuota'); fallback = true; continue; }
      if (breakerOpen(provider.name)) { attempts.push(provider.name + ':circuito'); fallback = true; continue; }
      const timer = timed(Math.min(providerTimeoutMs, remaining));
      try {
        const { scores, operations } = await provider.check(buffer, timer.signal);
        breakerOk(provider.name);
        recordUsage(provider.name, operations).catch(() => {});
        const result = { verdict: decide(scores, kind), provider: provider.name, scores, ms: now() - started, fallback };
        logEvent({ provider: provider.name, kind, verdict: result.verdict, fallback, ms: result.ms, detail: attempts.length ? attempts.join(',') : null });
        return { ...result, detail: attempts.join(',') || null };
      } catch (error) {
        fallback = true;
        const code = error.scanCode || (error.name === 'AbortError' ? 'timeout' : 'transient');
        attempts.push(provider.name + ':' + code);
        warnOnce(provider.name, code);
        if (code === 'quota') await markExhausted(provider.name).catch(() => {});
        else if (code === 'auth') { breakerFail(provider.name, 10 * 60 * 1000); console.error(`Image scan: credenciales rechazadas por ${provider.name}`); }
        else if (code !== 'media') breakerFail(provider.name);
      } finally {
        timer.done();
      }
    }
    if (!providers.length) attempts.push('sin_proveedores');
    const result = { verdict: 'unavailable', provider: null, scores: null, ms: now() - started, fallback, detail: attempts.join(',') || 'sin_tiempo' };
    logEvent({ provider: 'none', kind, verdict: 'unavailable', fallback, ms: result.ms, detail: result.detail });
    return result;
  };

  // Veredicto ya conocido para este archivo exacto (no gasta cuota)
  const cachedVerdict = async (sha256) => {
    const row = await prisma.imageHash.findFirst({ where: { sha256, verdict: { in: ['clear', 'block'] }, createdAt: { gte: new Date(now() - CACHE_DAYS * DAY) } }, orderBy: { createdAt: 'desc' }, select: { verdict: true, provider: true } });
    return row || null;
  };

  const usageSnapshot = async () => Promise.all(['sightengine', 'google'].map(async (name) => ({
    provider: name, configured: providers.some((provider) => provider.name === name), used: await usedThisMonth(name), limit: LIMITS[name], stopAt: Math.floor(LIMITS[name] * QUOTA_SAFETY), month: month()
  })));

  return { enabled, scan, cachedVerdict, usageSnapshot, logEvent, providers: providers.map((provider) => provider.name) };
};

// ---------- Preparación de la imagen: se decodifica una vez y de ahí salen la huella, el sha256 y la copia a escanear ----------
export const prepareImage = async (buffer) => {
  const base = sharp(buffer, { limitInputPixels: 80_000_000 }).rotate();
  const meta = await sharp(buffer, { limitInputPixels: 80_000_000 }).metadata();
  if (!ALLOWED_FORMATS.includes(meta.format)) throw Object.assign(new Error('unsupported_format'), { scanCode: 'format' });
  const [hash, scanJpeg] = await Promise.all([
    dHashOf(base),
    // Se aplana sobre blanco para que nada quede escondido en la transparencia; solo se envía esta copia reducida
    base.clone().flatten({ background: '#ffffff' }).resize(SCAN_SIZE, SCAN_SIZE, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()
  ]);
  return { hash, sha256: crypto.createHash('sha256').update(buffer).digest('hex'), scanJpeg };
};

// Una cuenta es de confianza si no es nueva, no tiene medidas vigentes y no tuvo contenido retirado hace poco
export const isTrustedUploader = async (prisma, user, env = process.env) => {
  if (!user) return false;
  const minDays = Number(env.TRUST_MIN_ACCOUNT_DAYS) || 7;
  if (Date.now() - new Date(user.createdAt).getTime() < minDays * DAY) return false;
  const [sanctions, removed] = await Promise.all([
    prisma.sanction.count({ where: { userId: user.id, status: 'active' } }),
    prisma.report.count({ where: { targetOwnerId: user.id, status: 'actioned', decidedAt: { gte: new Date(Date.now() - 180 * DAY) } } })
  ]);
  return sanctions === 0 && removed === 0;
};
