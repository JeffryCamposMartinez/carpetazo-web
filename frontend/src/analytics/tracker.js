// Rastreador propio de Carpetazo Intelligence. Sin cookies, sin IP, sin huella digital: un identificador aleatorio en el navegador
// y una sesión que se renueva tras 30 min sin actividad. Respeta «No rastrear», Global Privacy Control y el interruptor «No medir mi uso».
// Nunca bloquea la interfaz: si algo falla, descarta.
import { API_BASE_URL, apiFetch } from '../services/api';
import { auth } from '../services/firebase';
import { WEB_EVENTS } from './eventCatalog';

const OPT_OUT_KEY = 'cz:no-track';
const SESSION_GAP_MS = 30 * 60 * 1000;
const FLUSH_MS = 5000;
const MAX_BATCH = 50;
const KNOWN = new Set(WEB_EVENTS);

const store = (kind) => { try { return window[kind]; } catch (_error) { return null; } };
const read = (kind, key) => { try { return store(kind)?.getItem(key) ?? null; } catch (_error) { return null; } };
const write = (kind, key, value) => { try { store(kind)?.setItem(key, value); } catch (_error) { /* sin almacenamiento */ } };
const uuid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40).padEnd(8, '0');

let active = false;
let started = false;
let queue = [];
let ctxCache = null;

export const trackingOptedOut = () => read('localStorage', OPT_OUT_KEY) === '1' || navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
export const setTrackingOptOut = (off) => { write('localStorage', OPT_OUT_KEY, off ? '1' : '0'); if (off) { active = false; queue = []; } };

const visitorId = () => { let id = read('localStorage', 'cz:vid'); if (!id) { id = uuid(); write('localStorage', 'cz:vid', id); } return id; };
const sessionId = () => {
  const now = Date.now();
  let id = read('localStorage', 'cz:sid'); const last = Number(read('localStorage', 'cz:sid-at')) || 0;
  if (!id || now - last > SESSION_GAP_MS) { id = uuid(); ctxCache = null; write('localStorage', 'cz:sid', id); write('localStorage', 'cz:ref', ''); write('localStorage', 'cz:utm', ''); sessionStartSources(); }
  write('localStorage', 'cz:sid-at', String(now));
  return id;
};
// Origen y UTM se capturan una vez, al empezar la sesión
const sessionStartSources = () => {
  try {
    const params = new URLSearchParams(location.search);
    const utm = { s: params.get('utm_source') || '', m: params.get('utm_medium') || '', c: params.get('utm_campaign') || '' };
    write('localStorage', 'cz:utm', JSON.stringify(utm));
    const host = document.referrer ? new URL(document.referrer).hostname : '';
    write('localStorage', 'cz:ref', host);
  } catch (_error) { /* sin origen */ }
};
const context = () => {
  const sid = sessionId();
  if (!ctxCache || ctxCache.sid !== sid) {
    let utm = {}; try { utm = JSON.parse(read('localStorage', 'cz:utm') || '{}'); } catch (_error) { utm = {}; }
    ctxCache = { vid: visitorId(), sid, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '', vp: `${window.innerWidth}x${window.innerHeight}`, ref: read('localStorage', 'cz:ref') || '', utm };
  }
  return ctxCache;
};

// Id de categoría del buscador -> clave de juego del catálogo de eventos
const GAME_BY_CATEGORY = { 1: 'pokemon', 99: 'myl', 68: 'onepiece', yugioh: 'yugioh', magic: 'magic', riftbound: 'riftbound', lorcana: 'lorcana', digimon: 'digimon' };
export const gameOf = (category) => GAME_BY_CATEGORY[String(category)] || 'otro';

export const track = (name, props = {}) => {
  if (!active || !KNOWN.has(name)) return;
  queue.push({ id: uuid(), name, at: new Date().toISOString(), path: location.pathname, props });
  if (queue.length >= MAX_BATCH) flush();
};

const send = async (events, beacon) => {
  const body = JSON.stringify({ ctx: context(), events });
  if (beacon && navigator.sendBeacon) { navigator.sendBeacon(`${API_BASE_URL}/analytics/collect`, new Blob([body], { type: 'text/plain' })); return; }
  const headers = { 'Content-Type': 'text/plain' };
  try { if (auth.currentUser) headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`; } catch (_error) { /* anónimo */ }
  await fetch(`${API_BASE_URL}/analytics/collect`, { method: 'POST', headers, body, keepalive: true });
};
export const flush = (beacon = false) => {
  if (!queue.length) return;
  const events = queue.splice(0, MAX_BATCH);
  send(events, beacon).catch(() => { /* se descarta */ });
};

// ---------- Páginas: vista, tiempo activo y profundidad de scroll ----------
const page = { path: null, activeMs: 0, lastTick: 0, lastActivity: 0, maxScroll: 0, marks: new Set() };
const tickActive = () => {
  const now = Date.now();
  if (page.lastTick && document.visibilityState === 'visible' && now - page.lastActivity < 30000) page.activeMs += Math.min(now - page.lastTick, 5000);
  page.lastTick = now;
};
const scrollPct = () => { const h = document.documentElement; const max = h.scrollHeight - window.innerHeight; return max > 0 ? Math.min(100, Math.round((window.scrollY / max) * 100)) : 100; };
const closePage = () => {
  if (!page.path) return;
  tickActive();
  track('page_leave', { sec: Math.round(page.activeMs / 1000), maxScroll: page.maxScroll });
};
export const trackPageView = (pathname, title = '') => {
  if (!active || pathname === page.path) return;
  closePage();
  Object.assign(page, { path: pathname, activeMs: 0, lastTick: Date.now(), lastActivity: Date.now(), maxScroll: 0, marks: new Set() });
  track('page_view', { title: String(title).slice(0, 80) });
};

// ---------- Rendimiento y errores ----------
const vitals = () => {
  if (!('PerformanceObserver' in window)) return;
  const sent = new Set();
  const report = (name, value) => { if (sent.has(name)) return; sent.add(name); const good = { LCP: 2500, CLS: 0.1, INP: 200, TTFB: 800, FCP: 1800 }[name]; const poor = { LCP: 4000, CLS: 0.25, INP: 500, TTFB: 1800, FCP: 3000 }[name]; track('web_vital', { name, value: Math.round(value * 1000) / 1000, rating: value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor' }); };
  let lcp = 0; let cls = 0; let inp = 0;
  const observe = (type, cb, extra = {}) => { try { new PerformanceObserver((list) => list.getEntries().forEach(cb)).observe({ type, buffered: true, ...extra }); } catch (_error) { /* no soportado */ } };
  observe('largest-contentful-paint', (e) => { lcp = e.startTime; });
  observe('layout-shift', (e) => { if (!e.hadRecentInput) cls += e.value; });
  observe('event', (e) => { if (e.interactionId) inp = Math.max(inp, e.duration); }, { durationThreshold: 40 });
  observe('paint', (e) => { if (e.name === 'first-contentful-paint') report('FCP', e.startTime); });
  const nav = performance.getEntriesByType?.('navigation')?.[0];
  if (nav) report('TTFB', nav.responseStart);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { if (lcp) report('LCP', lcp); report('CLS', cls); if (inp) report('INP', inp); } }, { once: true });
};

export const initTracking = async () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  try {
    if (trackingOptedOut()) return;
    const config = await apiFetch('/analytics/config');
    if (!config?.enabled) return;
    active = true;
    const activity = () => { page.lastActivity = Date.now(); };
    ['pointerdown', 'keydown', 'touchstart', 'mousemove'].forEach((type) => window.addEventListener(type, activity, { passive: true }));
    window.addEventListener('scroll', () => {
      activity();
      const pct = scrollPct();
      page.maxScroll = Math.max(page.maxScroll, pct);
      for (const mark of [25, 50, 75, 100]) if (pct >= mark && !page.marks.has(mark)) { page.marks.add(mark); track('scroll_depth', { pct: mark }); }
    }, { passive: true });
    document.addEventListener('click', (event) => { const el = event.target?.closest?.('[data-track]'); if (el) track('ui_click', { id: el.getAttribute('data-track'), area: el.getAttribute('data-track-area') || '' }); }, { capture: true });
    window.addEventListener('error', (event) => track('js_error', { message: String(event.message || 'error'), source: String(event.filename || '').split('/').pop() }));
    window.addEventListener('unhandledrejection', (event) => track('js_error', { message: String(event.reason?.message || event.reason || 'promesa rechazada'), source: 'promise' }));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { closePage(); page.path = null; flush(true); } });
    window.addEventListener('pagehide', () => { closePage(); flush(true); });
    window.setInterval(() => { tickActive(); flush(false); }, FLUSH_MS);
    vitals();
  } catch (_error) { /* sin analítica: el sitio sigue igual */ }
};
