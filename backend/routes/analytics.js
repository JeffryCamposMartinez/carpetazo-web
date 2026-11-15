// Recolección de analítica (pública, anónima y limitada). Las lecturas de informes están en routes/intelligence.js, solo para administradores.
import express from 'express';
import { optionalAuth } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { routeLimiter } from '../core/limits.js';
import { MAX_EVENTS_PER_BATCH, buildContext, buildEvent, enqueueEvents, getAnalyticsSettings } from '../core/analytics.js';

const router = express.Router();
const MAX_BODY = 32 * 1024;
const userIds = new Map(); // firebaseUid -> { id, at }: evita una consulta por lote
const userIdOf = async (req) => {
  const uid = req.user?.sub;
  if (!uid) return null;
  const hit = userIds.get(uid);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.id;
  const id = (await prisma.user.findUnique({ where: { firebaseUid: uid }, select: { id: true } }))?.id || null;
  if (userIds.size > 5000) userIds.clear();
  userIds.set(uid, { id, at: Date.now() });
  return id;
};
const optedOut = (req) => req.headers.dnt === '1' || req.headers['sec-gpc'] === '1'; // «No rastrear» / Global Privacy Control

// La web pregunta si debe medir (la recolección nace apagada y la enciende un administrador)
router.get('/api/analytics/config', routeLimiter(60 * 1000, 120), async (req, res) => {
  const { enabled } = await getAnalyticsSettings();
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ success: true, enabled: enabled && !optedOut(req) });
});

// sendBeacon envía text/plain para no provocar una consulta previa (CORS): se lee como texto y se interpreta aquí
router.post('/api/analytics/collect', routeLimiter(60 * 1000, 90), express.text({ type: ['text/plain', 'application/json'], limit: MAX_BODY }), optionalAuth, async (req, res) => {
  try {
    if (Number(req.headers['content-length']) > MAX_BODY) return res.status(413).json({ success: false });
    if (optedOut(req)) return res.status(204).end();
    const { enabled, sampleRate } = await getAnalyticsSettings();
    if (!enabled) return res.status(204).end();
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_error) { return res.status(400).json({ success: false }); } }
    if (!body || typeof body !== 'object' || !Array.isArray(body.events) || body.events.length === 0 || body.events.length > MAX_EVENTS_PER_BATCH) return res.status(400).json({ success: false });
    const ctx = buildContext({ ctx: body.ctx, userAgent: req.headers['user-agent'], userId: await userIdOf(req) });
    if (!ctx) return res.status(204).end(); // sin identificadores válidos o robot: se ignora
    if (sampleRate < 1 && Math.random() > sampleRate) return res.status(204).end();
    const events = body.events.map((raw) => buildEvent(raw, ctx)).filter(Boolean);
    if (events.length) enqueueEvents(events);
    res.status(204).end();
  } catch (error) {
    console.warn('Analítica:', error?.message || error);
    res.status(204).end(); // la analítica nunca debe producir errores visibles
  }
});

export default router;
