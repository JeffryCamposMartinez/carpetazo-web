// Latencia y errores por endpoint (ruta con parámetros, p. ej. «GET /api/folders/:id»). Se acumula en memoria y se guarda cada minuto como
// agregado diario: no se guarda un registro por petición. Solo cuando la analítica está encendida.
import { prisma } from './db.js';
import { getAnalyticsSettings } from './analytics.js';

const FLUSH_MS = 60 * 1000;
let acc = new Map();
let timer = null;

const dayChile = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());

export const recordRequest = (method, route, status, ms) => {
  if (!route || !String(route).startsWith('/api/')) return;
  const key = `${method} ${route}`;
  const row = acc.get(key) || { n: 0, sum: 0, max: 0, slow: 0, e4: 0, e5: 0 };
  row.n += 1; row.sum += ms; row.max = Math.max(row.max, ms);
  if (ms > 1000) row.slow += 1;
  if (status >= 500) row.e5 += 1; else if (status >= 400) row.e4 += 1;
  acc.set(key, row);
};

export const apiTimingMiddleware = (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    if (process.env.TEST_AUTH_STUB === '1' && !process.env.ANALYTICS_TEST) return;
    const route = req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : '';
    recordRequest(req.method, route, res.statusCode, Number(process.hrtime.bigint() - started) / 1e6);
  });
  next();
};

export const flushApiTiming = async () => {
  if (!acc.size) return 0;
  const snapshot = acc; acc = new Map();
  if (!(await getAnalyticsSettings()).enabled) return 0;
  const day = dayChile();
  let rows = 0;
  for (const [key, r] of snapshot) {
    for (const [metric, value, mode] of [['api_count', r.n, 'add'], ['api_ms_sum', Math.round(r.sum), 'add'], ['api_ms_max', Math.round(r.max), 'max'], ['api_slow', r.slow, 'add'], ['api_4xx', r.e4, 'add'], ['api_5xx', r.e5, 'add']]) {
      if (!value) continue;
      await (mode === 'max'
        ? prisma.$executeRaw`INSERT INTO "AnalyticsDaily" ("day","metric","dim1","dim2","value") VALUES (${day}::date, ${metric}, ${key}, '', ${value}) ON CONFLICT ("day","metric","dim1","dim2") DO UPDATE SET "value" = GREATEST("AnalyticsDaily"."value", EXCLUDED."value")`
        : prisma.$executeRaw`INSERT INTO "AnalyticsDaily" ("day","metric","dim1","dim2","value") VALUES (${day}::date, ${metric}, ${key}, '', ${value}) ON CONFLICT ("day","metric","dim1","dim2") DO UPDATE SET "value" = "AnalyticsDaily"."value" + EXCLUDED."value"`);
      rows += 1;
    }
  }
  return rows;
};

export const startApiTiming = () => {
  if (timer || process.env.TEST_AUTH_STUB === '1') return;
  timer = setInterval(() => flushApiTiming().catch((error) => console.warn('Latencia por endpoint:', error?.message)), FLUSH_MS);
  timer.unref?.();
};
