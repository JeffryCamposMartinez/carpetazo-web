// Carpetazo Intelligence — recolección. Sin IP, sin cookies, sin contenido de usuarios.
// Los eventos entran a una cola en memoria y se guardan por lotes: registrar un evento nunca demora una petición.
import crypto from 'node:crypto';
import { prisma } from './db.js';
import { EVENTS, cleanProps } from './analyticsCatalog.js';

const TEST = process.env.TEST_AUTH_STUB === '1';
const FLUSH_EVERY_MS = TEST ? 150 : 2000;
const FLUSH_AT = 200;
const QUEUE_MAX = 5000;
const SETTINGS_TTL_MS = TEST ? 200 : 30000;
const MAX_BATCH_EVENTS = 50;
export const SESSION_GAP_MS = 30 * 60 * 1000;
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

// ---------- Ajustes (con caché corta) ----------
let settings = { enabled: false, retentionDays: 90, sampleRate: 1, at: 0 };
export const getAnalyticsSettings = async (force = false) => {
  if (!force && Date.now() - settings.at < SETTINGS_TTL_MS) return settings;
  try {
    const row = await prisma.analyticsSettings.findUnique({ where: { id: 1 } });
    if (row) settings = { enabled: row.enabled, retentionDays: row.retentionDays, sampleRate: row.sampleRate, at: Date.now() };
    else settings = { ...settings, at: Date.now() };
  } catch (_error) { settings = { ...settings, at: Date.now() }; }
  return settings;
};
export const __setAnalyticsSettings = (next) => { settings = { ...settings, ...next, at: Date.now() }; };

// ---------- Datos del navegador (solo lo necesario, a partir del User-Agent) ----------
export const parseAgent = (userAgent = '') => {
  const ua = String(userAgent);
  const os = /Windows/i.test(ua) ? 'Windows' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Mac OS X|Macintosh/i.test(ua) ? 'macOS' : /Linux|X11/i.test(ua) ? 'Linux' : 'Otro';
  const browser = /Edg\//i.test(ua) ? 'Edge' : /OPR\/|Opera/i.test(ua) ? 'Opera' : /SamsungBrowser/i.test(ua) ? 'Samsung' : /Firefox|FxiOS/i.test(ua) ? 'Firefox' : /Chrome|CriOS/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : 'Otro';
  const device = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'tablet' : /Mobi|iPhone|Android/i.test(ua) ? 'mobile' : 'desktop';
  const bot = /bot|crawler|spider|headless|lighthouse|prerender|facebookexternalhit|whatsapp/i.test(ua);
  return { os, browser, device, bot };
};

const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|brave)\./i;
const SOCIAL = /(^|\.)(facebook|instagram|t\.co|twitter|x\.com|whatsapp|wa\.me|tiktok|youtube|youtu\.be|reddit|discord|telegram|pinterest|linkedin)/i;
// Fuente de tráfico: UTM si viene; si no, el sitio de origen (solo el dominio)
export const classifySource = ({ ref = '', utm = {} } = {}, ownHost = 'carpetazo.cl') => {
  const text = (v, n) => String(v || '').toLowerCase().replace(/[^a-z0-9_.:+\- ]/g, '').trim().slice(0, n);
  const s = text(utm.s, 40); const m = text(utm.m, 40); const c = text(utm.c, 60);
  if (s || m || c) return { source: s || 'utm', medium: m || 'campana', campaign: c };
  const host = text(ref, 80).replace(/^www\./, '');
  if (!host) return { source: 'direct', medium: 'direct', campaign: '' };
  if (host === ownHost || host.endsWith(`.${ownHost}`)) return { source: 'internal', medium: 'internal', campaign: '' };
  if (SEARCH.test(`${host}.`) || SEARCH.test(host)) return { source: host, medium: 'organic', campaign: '' };
  if (SOCIAL.test(host)) return { source: host, medium: 'social', campaign: '' };
  return { source: host, medium: 'referral', campaign: '' };
};

// Ruta sin parámetros ni identificadores: así las páginas se agrupan (/carpeta/:id) y no se guardan nombres de usuario
const STATIC_ROUTES = new Set(['/', '/bienvenida', '/dashboard', '/perfil', '/mensajes', '/moderacion', '/sugerencias', '/planes', '/carpetas', '/cartas', '/cartas/catalogo', '/vendedores', '/terminos', '/privacidad']);
export const normalizePath = (raw) => {
  const path = String(raw || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (STATIC_ROUTES.has(path)) return path;
  if (/^\/carpeta\/[^/]+$/.test(path)) return '/carpeta/:id';
  if (/^\/c\/[^/]+$/.test(path)) return '/c/:id';
  if (/^\/carta\/[^/]+$/.test(path)) return '/carta/:id';
  if (/^\/catalogo\/[^/]+(\/[^/]+)?$/.test(path)) return '/catalogo/:id';
  if (/^\/[^/]+$/.test(path)) return '/:usuario';
  return '/otra';
};

// ---------- Validación de un evento ----------
export const buildEvent = (raw, ctx, now = Date.now()) => {
  if (!raw || typeof raw !== 'object' || !ID_RE.test(String(raw.id || ''))) return null;
  const def = EVENTS[raw.name];
  if (!def || def.origin === 'server') return null; // desde la web solo entran eventos de la web
  let at = Number(new Date(raw.at ?? now));
  if (!Number.isFinite(at) || at > now + 5 * 60 * 1000 || at < now - 48 * 3600 * 1000) at = now;
  const props = cleanProps(raw.name, raw.props);
  if (JSON.stringify(props).length > 1024) return null;
  return {
    id: String(raw.id), name: raw.name, at: new Date(at), visitorId: ctx.visitorId, sessionId: ctx.sessionId, userId: ctx.userId || null,
    path: normalizePath(raw.path), props: Object.keys(props).length ? props : null,
    device: ctx.device, browser: ctx.browser, os: ctx.os, viewport: ctx.viewport, source: ctx.source, medium: ctx.medium, campaign: ctx.campaign, tz: ctx.tz, origin: 'web'
  };
};

export const buildContext = ({ ctx = {}, userAgent = '', userId = null }) => {
  const agent = parseAgent(userAgent);
  const id = (v) => (ID_RE.test(String(v || '')) ? String(v) : null);
  const visitorId = id(ctx.vid); const sessionId = id(ctx.sid);
  if (!visitorId || !sessionId || agent.bot) return null;
  const viewport = /^\d{2,5}x\d{2,5}$/.test(String(ctx.vp || '')) ? String(ctx.vp) : '';
  const tz = /^[A-Za-z_]+\/[A-Za-z_\-/]+$|^UTC$/.test(String(ctx.tz || '')) ? String(ctx.tz).slice(0, 40) : '';
  return { visitorId, sessionId, userId, viewport, tz, ...classifySource({ ref: ctx.ref, utm: ctx.utm }), device: agent.device, browser: agent.browser, os: agent.os };
};

// ---------- Cola y guardado por lotes ----------
let queue = [];
let timer = null;
let dropped = 0;
export const analyticsQueueStats = () => ({ queued: queue.length, dropped });

export const enqueueEvents = (events) => {
  for (const event of events) {
    if (queue.length >= QUEUE_MAX) { dropped += 1; continue; }
    queue.push(event);
  }
  if (queue.length >= FLUSH_AT) flushAnalytics().catch(() => {});
  else if (!timer) { timer = setTimeout(() => { timer = null; flushAnalytics().catch(() => {}); }, FLUSH_EVERY_MS); timer.unref?.(); }
};

const SESSION_UPSERT = (s) => prisma.$executeRaw`
  INSERT INTO "AnalyticsSession" ("id","visitorId","userId","startedAt","lastAt","entryPath","exitPath","pages","events","activeSec","device","browser","os","source","medium","campaign","tz")
  VALUES (${s.id}, ${s.visitorId}, ${s.userId}, ${s.first}, ${s.last}, ${s.entryPath}, ${s.exitPath}, ${s.pages}, ${s.events}, ${s.activeSec}, ${s.device}, ${s.browser}, ${s.os}, ${s.source}, ${s.medium}, ${s.campaign}, ${s.tz})
  ON CONFLICT ("id") DO UPDATE SET
    "lastAt" = GREATEST("AnalyticsSession"."lastAt", EXCLUDED."lastAt"),
    "startedAt" = LEAST("AnalyticsSession"."startedAt", EXCLUDED."startedAt"),
    "exitPath" = CASE WHEN EXCLUDED."lastAt" >= "AnalyticsSession"."lastAt" THEN EXCLUDED."exitPath" ELSE "AnalyticsSession"."exitPath" END,
    "pages" = "AnalyticsSession"."pages" + EXCLUDED."pages",
    "events" = "AnalyticsSession"."events" + EXCLUDED."events",
    "activeSec" = "AnalyticsSession"."activeSec" + EXCLUDED."activeSec",
    "userId" = COALESCE("AnalyticsSession"."userId", EXCLUDED."userId")`;

export const flushAnalytics = async () => {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!queue.length) return { saved: 0 };
  const batch = queue.splice(0, queue.length);
  try {
    // Los ids ya guardados se descartan antes de contar nada: un reintento nunca duplica visitas ni sesiones
    const known = new Set((await prisma.analyticsEvent.findMany({ where: { id: { in: batch.map((e) => e.id) } }, select: { id: true } })).map((r) => r.id));
    const fresh = [...new Map(batch.filter((e) => !known.has(e.id)).map((e) => [e.id, e])).values()];
    if (fresh.length) {
      await prisma.analyticsEvent.createMany({ data: fresh, skipDuplicates: true });
      const sessions = new Map();
      for (const e of fresh.filter((x) => x.sessionId && x.visitorId).sort((a, b) => a.at - b.at)) {
        const s = sessions.get(e.sessionId) || { id: e.sessionId, visitorId: e.visitorId, userId: e.userId, first: e.at, last: e.at, entryPath: e.name === 'page_view' ? e.path : '', exitPath: e.path, pages: 0, events: 0, activeSec: 0, device: e.device, browser: e.browser, os: e.os, source: e.source, medium: e.medium, campaign: e.campaign, tz: e.tz };
        s.events += 1; s.last = e.at; s.exitPath = e.path; s.userId = s.userId || e.userId;
        if (e.name === 'page_view') { s.pages += 1; if (!s.entryPath) s.entryPath = e.path; }
        if (e.name === 'page_leave' && typeof e.props?.sec === 'number') s.activeSec += Math.max(0, Math.min(3600, Math.round(e.props.sec)));
        sessions.set(e.sessionId, s);
      }
      for (const s of sessions.values()) await SESSION_UPSERT(s);
    }
    return { saved: fresh.length };
  } catch (error) {
    console.warn('No se pudieron guardar eventos de analítica:', error?.message || error);
    if (queue.length + batch.length <= QUEUE_MAX) queue = batch.concat(queue); else dropped += batch.length; // se reintenta una vez; si ya está llena, se descarta
    return { saved: 0, error: true };
  }
};

// Evento originado en el servidor (hechos que no dependen del navegador: registros, pedidos, suscripciones…)
export const trackServer = async (name, { userId = null, props = {}, path = '' } = {}) => {
  try {
    const def = EVENTS[name];
    if (!def || def.origin !== 'server') return false;
    if (!(await getAnalyticsSettings()).enabled) return false;
    const clean = cleanProps(name, props);
    enqueueEvents([{ id: crypto.randomUUID(), name, at: new Date(), visitorId: null, sessionId: null, userId, path: normalizePath(path), props: Object.keys(clean).length ? clean : null, device: '', browser: '', os: '', viewport: '', source: '', medium: '', campaign: '', tz: '', origin: 'server' }]);
    return true;
  } catch (_error) { return false; }
};

export const MAX_EVENTS_PER_BATCH = MAX_BATCH_EVENTS;
export const __resetAnalyticsQueue = () => { queue = []; dropped = 0; if (timer) { clearTimeout(timer); timer = null; } };
