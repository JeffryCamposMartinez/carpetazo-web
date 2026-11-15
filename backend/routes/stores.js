// Herramientas del plan Tienda. Bloque 1: ficha del local (dirección, horarios, pagos, juegos, fotos, política).
import express from 'express';
import { authenticateToken, optionalAuth } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { PlanFeatureError, assertFeature, getEffectivePlan, sendPlanError } from '../core/entitlements.js';
import { routeLimiter } from '../core/limits.js';
import { badRequest, isSmallObject, isUuid, normalizeUsername } from '../core/validation.js';
import { parseStoreProfile, toPublicStore } from '../core/storeProfile.js';
import { MAX_UPCOMING_EVENTS, parseStoreEvent, promotableCount, signupStatusFor, toPublicEvent } from '../core/storeEvents.js';
import { eventWhen, notifyFollowers, notifyUsers } from '../core/storeNotices.js';

const router = express.Router();

const ownUserId = async (req) => (await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } }))?.id || null;

// Ficha completa del dueño (aunque ya no tenga el plan, para que no pierda lo escrito)
router.get('/api/stores/me', authenticateToken, async (req, res) => {
  try {
    const userId = await ownUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const [{ plan }, profile, owner] = await Promise.all([getEffectivePlan(prisma, userId), prisma.storeProfile.findUnique({ where: { userId } }), prisma.user.findUnique({ where: { id: userId }, select: { identityVerifiedAt: true } })]);
    const store = profile ? { ...toPublicStore({ ...profile, enabled: true }), enabled: profile.enabled } : null;
    res.json({ success: true, allowed: Boolean(plan.storeTools), identityVerified: Boolean(owner?.identityVerifiedAt), store });
  } catch (error) {
    console.error('Error cargando la ficha de la tienda:', error.message);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.put('/api/stores/me', authenticateToken, routeLimiter(60 * 1000, 30), async (req, res) => {
  try {
    if (!isSmallObject(req.body, 24000)) return badRequest(res, 'Datos de la tienda demasiado grandes.');
    const userId = await ownUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const { plan } = await getEffectivePlan(prisma, userId);
    assertFeature(plan, 'storeTools');
    const parsed = parseStoreProfile(req.body);
    if (!parsed.ok) return badRequest(res, parsed.error);
    // Mostrar el local en público exige la identidad verificada (se puede seguir editando mientras tanto)
    if (parsed.data.enabled && !(await prisma.user.findUnique({ where: { id: userId }, select: { identityVerifiedAt: true } }))?.identityVerifiedAt) {
      return res.status(403).json({ success: false, code: 'identity_required', message: 'Para mostrar tu local en público primero verifica tu cuenta.' });
    }
    const data = { ...parsed.data, hours: parsed.data.hours ?? undefined };
    const profile = await prisma.storeProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    res.json({ success: true, store: { ...toPublicStore({ ...profile, enabled: true }), enabled: profile.enabled } });
  } catch (error) {
    if (error instanceof PlanFeatureError) return sendPlanError(res, error);
    console.error('Error guardando la ficha de la tienda:', error.message);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// ---------- Bloque 2: eventos y torneos ----------
const notFound = (res) => res.status(404).json({ success: false, message: 'Evento no encontrado' });
const serverError = (res, label, error) => {
  console.error(label, error.message);
  res.status(500).json({ success: false, message: 'Error interno' });
};

// Cuenta inscritos y lista de espera de varios eventos
const signupCounts = async (db, eventIds) => {
  const rows = eventIds.length ? await db.storeEventSignup.groupBy({ by: ['eventId', 'status'], where: { eventId: { in: eventIds }, status: { in: ['registered', 'waitlist'] } }, _count: { _all: true } }) : [];
  const map = new Map();
  for (const row of rows) map.set(row.eventId, { ...(map.get(row.eventId) || {}), [row.status]: row._count._all });
  return map;
};

// Dueño con plan Tienda vigente (las escrituras de eventos lo exigen)
const ownerWithPlan = async (req) => {
  const userId = await ownUserId(req);
  if (!userId) return { userId: null };
  const { plan } = await getEffectivePlan(prisma, userId);
  assertFeature(plan, 'storeTools');
  return { userId };
};

// Sube a la lista de espera los cupos liberados (dentro de la transacción) y devuelve a quiénes subió
const promoteWaitlist = async (tx, event) => {
  const registered = await tx.storeEventSignup.count({ where: { eventId: event.id, status: 'registered' } });
  const waiting = await tx.storeEventSignup.findMany({ where: { eventId: event.id, status: 'waitlist' }, orderBy: { createdAt: 'asc' }, select: { id: true, userId: true } });
  const promoted = waiting.slice(0, promotableCount(event.capacity, registered, waiting.length));
  if (promoted.length) await tx.storeEventSignup.updateMany({ where: { id: { in: promoted.map((p) => p.id) } }, data: { status: 'registered' } });
  return promoted.map((p) => p.userId);
};

const lockEvent = (tx, id) => tx.$queryRaw`SELECT "id" FROM "StoreEvent" WHERE "id" = ${id} FOR UPDATE`;

const notifyPromoted = async (userIds, event, username) => {
  if (!userIds.length) return;
  await notifyUsers(userIds, { subject: `Tienes cupo en ${event.title}`, title: 'Se liberó un cupo', intro: `Pasaste de la lista de espera a inscrito en «${event.title}» (${eventWhen(event.startsAt)}).`, url: `/${username}`, tag: `store-event-${event.id}` });
};

// Eventos del dueño, con la lista de inscritos (solo nombre y usuario)
router.get('/api/stores/me/events', authenticateToken, async (req, res) => {
  try {
    const userId = await ownUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const events = await prisma.storeEvent.findMany({
      where: { storeId: userId, startsAt: { gt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) } },
      orderBy: { startsAt: 'asc' },
      take: 120,
      include: { signups: { where: { status: { in: ['registered', 'waitlist'] } }, orderBy: { createdAt: 'asc' }, select: { status: true, createdAt: true, user: { select: { name: true, username: true } } } } }
    });
    res.json({ success: true, events: events.map(({ signups, ...event }) => ({
      ...toPublicEvent(event, { registered: signups.filter((s) => s.status === 'registered').length, waitlist: signups.filter((s) => s.status === 'waitlist').length }),
      resultNote: event.resultNote,
      signups: signups.map((s) => ({ status: s.status, createdAt: s.createdAt, name: s.user.name, username: s.user.username }))
    })) });
  } catch (error) { serverError(res, 'Error cargando los eventos de la tienda:', error); }
});

router.post('/api/stores/me/events', authenticateToken, routeLimiter(60 * 60 * 1000, 40), async (req, res) => {
  try {
    if (!isSmallObject(req.body, 8000)) return badRequest(res, 'Datos del evento demasiado grandes.');
    const { userId } = await ownerWithPlan(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const parsed = parseStoreEvent(req.body, { creating: true });
    if (!parsed.ok) return badRequest(res, parsed.error);
    const upcoming = await prisma.storeEvent.count({ where: { storeId: userId, status: 'scheduled', startsAt: { gt: new Date() } } });
    if (upcoming >= MAX_UPCOMING_EVENTS) return badRequest(res, `Puedes tener hasta ${MAX_UPCOMING_EVENTS} eventos programados.`);
    const event = await prisma.storeEvent.create({ data: { storeId: userId, ...parsed.data } });
    notifyFollowers(userId, { kind: 'event', event }).catch((error) => console.error('Error avisando a seguidores:', error.message)); // sin esperar
    res.json({ success: true, event: toPublicEvent(event) });
  } catch (error) {
    if (error instanceof PlanFeatureError) return sendPlanError(res, error);
    serverError(res, 'Error creando el evento:', error);
  }
});

router.put('/api/stores/me/events/:id', authenticateToken, routeLimiter(60 * 1000, 30), async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res);
    if (!isSmallObject(req.body, 8000)) return badRequest(res, 'Datos del evento demasiado grandes.');
    const { userId } = await ownerWithPlan(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const parsed = parseStoreEvent(req.body, { creating: false });
    if (!parsed.ok) return badRequest(res, parsed.error);
    const result = await prisma.$transaction(async (tx) => {
      await lockEvent(tx, req.params.id);
      const current = await tx.storeEvent.findFirst({ where: { id: req.params.id, storeId: userId } });
      if (!current) return null;
      if (current.status === 'cancelled' && parsed.data.status !== 'cancelled') return { error: 'Un evento cancelado no se puede reabrir: crea uno nuevo.' };
      if (parsed.data.capacity !== null && parsed.data.capacity < await tx.storeEventSignup.count({ where: { eventId: current.id, status: 'registered' } })) return { error: 'No puedes dejar menos cupos que personas inscritas.' };
      const event = await tx.storeEvent.update({ where: { id: current.id }, data: { ...parsed.data, ...(parsed.data.startsAt.getTime() !== current.startsAt.getTime() ? { reminderSentAt: null } : {}) } });
      const promoted = event.status === 'scheduled' ? await promoteWaitlist(tx, event) : [];
      return { event, promoted, wasCancelled: current.status !== 'cancelled' && event.status === 'cancelled' };
    });
    if (!result) return notFound(res);
    if (result.error) return badRequest(res, result.error);
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, name: true } });
    await notifyPromoted(result.promoted, result.event, me.username);
    if (result.wasCancelled) {
      const people = await prisma.storeEventSignup.findMany({ where: { eventId: result.event.id, status: { in: ['registered', 'waitlist'] } }, select: { userId: true } });
      await notifyUsers(people.map((p) => p.userId), { subject: `Cancelado: ${result.event.title}`, title: 'Evento cancelado', intro: `${me.name || me.username} canceló «${result.event.title}» (${eventWhen(result.event.startsAt)}).`, url: `/${me.username}`, tag: `store-event-${result.event.id}` });
    }
    const counts = (await signupCounts(prisma, [result.event.id])).get(result.event.id);
    res.json({ success: true, event: { ...toPublicEvent(result.event, counts), resultNote: result.event.resultNote } });
  } catch (error) {
    if (error instanceof PlanFeatureError) return sendPlanError(res, error);
    serverError(res, 'Error editando el evento:', error);
  }
});

// Próximos eventos públicos de una tienda (y los terminados de los últimos 30 días, con resultados)
router.get('/api/stores/:username/events', optionalAuth, async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);
    if (!username || username.length > 40) return notFound(res);
    const store = await prisma.user.findFirst({ where: { username, NOT: { role: 'deleted' } }, select: { id: true } });
    if (!store) return res.json({ success: true, events: [] });
    const { plan } = await getEffectivePlan(prisma, store.id);
    if (!plan.storeTools) return res.json({ success: true, events: [] });
    const now = Date.now();
    const events = await prisma.storeEvent.findMany({
      where: { storeId: store.id, OR: [{ status: 'scheduled', startsAt: { gt: new Date(now - 12 * 60 * 60 * 1000) } }, { status: 'finished', startsAt: { gt: new Date(now - 30 * 24 * 60 * 60 * 1000) } }] },
      orderBy: { startsAt: 'asc' },
      take: 30
    });
    const counts = await signupCounts(prisma, events.map((e) => e.id));
    const viewer = req.user?.sub ? await ownUserId(req) : null;
    const mine = viewer ? new Map((await prisma.storeEventSignup.findMany({ where: { userId: viewer, eventId: { in: events.map((e) => e.id) }, status: { in: ['registered', 'waitlist'] } }, select: { eventId: true, status: true } })).map((s) => [s.eventId, s.status])) : new Map();
    res.json({ success: true, isOwner: viewer === store.id, events: events.map((e) => toPublicEvent(e, counts.get(e.id), mine.get(e.id) || null)) });
  } catch (error) { serverError(res, 'Error cargando los eventos públicos:', error); }
});

// Inscribirse: con cupos llenos queda en lista de espera. Una inscripción por persona.
router.post('/api/stores/events/:id/signup', authenticateToken, routeLimiter(60 * 1000, 20), async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res);
    const userId = await ownUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const result = await prisma.$transaction(async (tx) => {
      await lockEvent(tx, req.params.id);
      const event = await tx.storeEvent.findUnique({ where: { id: req.params.id } });
      if (!event) return null;
      if (event.storeId === userId) return { error: 'No puedes inscribirte en tu propio evento.' };
      if (event.status !== 'scheduled' || event.startsAt.getTime() < Date.now()) return { error: 'Las inscripciones de este evento están cerradas.' };
      const { plan } = await getEffectivePlan(tx, event.storeId);
      if (!plan.storeTools) return null;
      const existing = await tx.storeEventSignup.findUnique({ where: { eventId_userId: { eventId: event.id, userId } } });
      if (existing && existing.status !== 'cancelled') return { status: existing.status, event };
      const status = signupStatusFor(event.capacity, await tx.storeEventSignup.count({ where: { eventId: event.id, status: 'registered' } }));
      if (existing) await tx.storeEventSignup.update({ where: { id: existing.id }, data: { status, createdAt: new Date() } });
      else await tx.storeEventSignup.create({ data: { eventId: event.id, userId, status } });
      return { status, event };
    });
    if (!result) return notFound(res);
    if (result.error) return badRequest(res, result.error);
    const counts = (await signupCounts(prisma, [result.event.id])).get(result.event.id);
    res.json({ success: true, event: toPublicEvent(result.event, counts, result.status) });
  } catch (error) { serverError(res, 'Error inscribiendo en el evento:', error); }
});

router.delete('/api/stores/events/:id/signup', authenticateToken, routeLimiter(60 * 1000, 20), async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return notFound(res);
    const userId = await ownUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const result = await prisma.$transaction(async (tx) => {
      await lockEvent(tx, req.params.id);
      const event = await tx.storeEvent.findUnique({ where: { id: req.params.id }, include: { store: { select: { username: true } } } });
      if (!event) return null;
      const updated = await tx.storeEventSignup.updateMany({ where: { eventId: event.id, userId, status: { in: ['registered', 'waitlist'] } }, data: { status: 'cancelled' } });
      const promoted = updated.count && event.status === 'scheduled' ? await promoteWaitlist(tx, event) : [];
      return { event, promoted };
    });
    if (!result) return notFound(res);
    await notifyPromoted(result.promoted, result.event, result.event.store.username);
    const { store: _store, ...event } = result.event;
    const counts = (await signupCounts(prisma, [event.id])).get(event.id);
    res.json({ success: true, event: toPublicEvent(event, counts, null) });
  } catch (error) { serverError(res, 'Error saliendo del evento:', error); }
});

export default router;
