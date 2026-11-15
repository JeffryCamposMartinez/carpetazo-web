// Carpetazo Intelligence — paneles de analítica dentro de Moderación (solo administradores, nivel 3).
// Solo lectura sobre datos propios. Consultas con rango acotado, caché corta y límite de concurrencia para no saturar la base.
import express from 'express';
import { authenticateToken, currentUserId, requireStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { routeLimiter } from '../core/limits.js';
import { badRequest } from '../core/validation.js';
import { getAnalyticsSettings } from '../core/analytics.js';
import * as q from '../core/intelligenceQueries.js';

const router = express.Router();
const guard = [routeLimiter(60 * 1000, 90), authenticateToken, requireStaff(3)];

const CACHE_MS = 60 * 1000;
const cache = new Map();
let running = 0;
const MAX_RUNNING = 3;

// Valida el rango (por defecto, últimos 30 días) y lo limita
const rangeOf = (req) => {
  const today = q.chileToday();
  const to = req.query.to ?? today;
  const from = req.query.from ?? new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0, 10);
  if (!q.isDay(from) || !q.isDay(to) || from > to || q.spanDays(from, to) > q.MAX_RANGE_DAYS) return null;
  return { from, to };
};

const cached = async (key, compute) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  if (running >= MAX_RUNNING) { const error = new Error('busy'); error.busy = true; throw error; }
  running += 1;
  try {
    const value = await compute();
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return value;
  } finally { running -= 1; }
};

const reply = (name, compute) => async (req, res) => {
  try {
    const range = rangeOf(req);
    if (!range) return badRequest(res, 'Rango de fechas inválido');
    const value = await cached(`${name}:${JSON.stringify(req.query)}`, () => compute(range, req));
    if (value === null) return badRequest(res, 'Consulta no permitida');
    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, data: value });
  } catch (error) {
    if (error.busy) return res.status(503).json({ success: false, message: 'Hay otras consultas en curso. Intenta de nuevo en unos segundos.' });
    console.error('intelligence', name, error);
    res.status(500).json({ success: false, message: 'No se pudo calcular' });
  }
};

router.get('/api/admin/intelligence/overview', ...guard, reply('overview', ({ from, to }) => q.overview(from, to)));
router.get('/api/admin/intelligence/traffic', ...guard, reply('traffic', ({ from, to }) => q.traffic(from, to)));
router.get('/api/admin/intelligence/pages', ...guard, reply('pages', ({ from, to }) => q.pages(from, to)));
router.get('/api/admin/intelligence/product', ...guard, reply('product', ({ from, to }) => q.product(from, to)));
router.get('/api/admin/intelligence/revenue', ...guard, reply('revenue', ({ from, to }) => q.revenue(from, to)));
router.get('/api/admin/intelligence/health', ...guard, reply('health', ({ from, to }) => q.health(from, to)));
router.get('/api/admin/intelligence/funnels', ...guard, reply('funnels', async ({ from, to }) => ({ funnels: await Promise.all(Object.keys(q.FUNNELS).map((key) => q.funnel(key, from, to))), coverage: await q.coverage() })));
router.get('/api/admin/intelligence/retention', ...guard, async (req, res) => {
  try {
    const days = Number(req.query.days ?? 30);
    if (!Number.isInteger(days) || days < 7 || days > 90) return badRequest(res, 'Periodo inválido');
    const value = await cached(`retention:${days}`, async () => ({ ...(await q.retention(days)), coverage: await q.coverage() }));
    res.json({ success: true, data: value });
  } catch (error) {
    if (error.busy) return res.status(503).json({ success: false, message: 'Hay otras consultas en curso. Intenta de nuevo en unos segundos.' });
    console.error('intelligence retention', error);
    res.status(500).json({ success: false, message: 'No se pudo calcular' });
  }
});

// Explorador: solo combinaciones de la lista blanca (evento del catálogo × agrupación × medida). No existe SQL libre.
const exploreParams = (req) => ({ event: String(req.query.event ?? ''), groupBy: String(req.query.groupBy ?? 'day'), measure: String(req.query.measure ?? 'events') });
router.get('/api/admin/intelligence/explore', ...guard, reply('explore', ({ from, to }, req) => q.explore({ ...exploreParams(req), from, to })));
router.get('/api/admin/intelligence/explore/options', ...guard, (_req, res) => res.json({ success: true, data: { events: [...q.EXPLORE_EVENTS], groupBy: Object.keys(q.EXPLORE_GROUPS), measures: Object.keys(q.EXPLORE_MEASURES) } }));

// Exportación CSV (queda en el registro de auditoría). Se neutralizan las celdas que Excel leería como fórmula.
const csvCell = (value) => { const text = String(value ?? ''); const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text; return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; };
router.get('/api/admin/intelligence/explore.csv', ...guard, async (req, res) => {
  try {
    const range = rangeOf(req);
    if (!range) return badRequest(res, 'Rango de fechas inválido');
    const params = exploreParams(req);
    const result = await cached(`explore:${range.from}:${range.to}:${JSON.stringify(params)}`, () => q.explore({ ...params, ...range, limit: 5000 }));
    if (!result) return badRequest(res, 'Consulta no permitida');
    await prisma.moderationAudit.create({ data: { actorId: await currentUserId(req), action: 'intelligence.export', targetType: 'system', targetId: null, note: `Exportó ${params.event} por ${params.groupBy} (${params.measure}) del ${range.from} al ${range.to}: ${result.rows.length} filas` } });
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="intelligence-${params.event}-${range.from}_${range.to}.csv"`, 'Cache-Control': 'private, no-store' });
    res.send('﻿' + [`${params.groupBy},${params.measure}`, ...result.rows.map((r) => `${csvCell(r.key)},${r.value}`)].join('\n'));
  } catch (error) {
    if (error.busy) return res.status(503).json({ success: false, message: 'Hay otras consultas en curso. Intenta de nuevo en unos segundos.' });
    console.error('intelligence export', error);
    res.status(500).json({ success: false, message: 'No se pudo exportar' });
  }
});

// Estado y encendido de la recolección
router.get('/api/admin/intelligence/settings', ...guard, async (_req, res) => {
  try { res.json({ success: true, data: await q.coverage() }); } catch (error) { console.error('intelligence settings', error); res.status(500).json({ success: false, message: 'No se pudo leer' }); }
});
router.put('/api/admin/intelligence/settings', ...guard, async (req, res) => {
  try {
    const { enabled } = req.body || {};
    if (typeof enabled !== 'boolean') return badRequest(res, 'Dato inválido');
    const actorId = await currentUserId(req);
    await prisma.$transaction([
      prisma.analyticsSettings.update({ where: { id: 1 }, data: { enabled, updatedBy: actorId } }),
      prisma.moderationAudit.create({ data: { actorId, action: enabled ? 'intelligence.enabled' : 'intelligence.disabled', targetType: 'system', targetId: null, note: enabled ? 'Encendió la recolección de analítica propia' : 'Apagó la recolección de analítica propia' } })
    ]);
    await getAnalyticsSettings(true);
    cache.clear();
    res.json({ success: true, data: await q.coverage() });
  } catch (error) { console.error('intelligence settings', error); res.status(500).json({ success: false, message: 'No se pudo guardar' }); }
});

export default router;
