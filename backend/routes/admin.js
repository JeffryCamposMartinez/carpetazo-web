// Rutas de administración que no son de moderación.
import express from 'express';
import { authenticateToken, currentUserId, isCoAdmin, requireAdmin, requireStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { getPlanState, lockPlanUser } from '../core/entitlements.js';
import { PLANS, validPlanKey } from '../core/plans.js';
import { cancelSubscriptionRecord } from '../core/mercadopago.js';
import { NOTICE_MAX, cleanNotice, notifyUser } from '../core/staffNotice.js';
import { hashEmail, hashIp } from '../core/hashing.js';
import { LEGAL_CURRENT } from '../core/legal.js';
import { escapeHtml, sendUserEmail } from '../core/mail.js';
import { badRequest, isOptionalText, isShortText, isUuid, validUsername } from '../core/validation.js';
import { FooterValidationError, getFooterSettings, saveFooterSettings } from '../core/footerSettings.js';

const router = express.Router();

router.get('/api/admin/me', authenticateToken, requireStaff(1), async (req, res) => {
  res.json({ success: true, isAdmin: req.staffLevel >= 3, isStaff: true, level: req.staffLevel, role: req.staffLevel >= 3 ? 'admin' : req.dbUser?.role, user: req.dbUser ? { username: req.dbUser.username } : null });
});

// Prueba del envío (solo administradores). Sin "username" se envía a sí mismo; con "username", a esa cuenta,
// que igual debe tener los términos aceptados. El contenido es fijo: no se puede usar para escribir mensajes libres.
router.post('/api/admin/test-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const username = req.body?.username;
    if (username !== undefined && (typeof username !== 'string' || !validUsername(username))) return badRequest(res, 'Usuario inválido');
    const target = username
      ? await prisma.user.findUnique({ where: { username: validUsername(username) }, select: { id: true, name: true } })
      : await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true, name: true } });
    if (!target) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const name = target.name || 'Hola';
    const result = await sendUserEmail(target.id, {
      subject: 'Correo de prueba de Carpetazo',
      text: `${name}:\n\nEste es un correo de prueba de Carpetazo.cl. Si lo recibiste, el envío de avisos funciona.\n\nEquipo Carpetazo\nhttps://carpetazo.cl`,
      html: `<p>${escapeHtml(name)}:</p><p>Este es un correo de prueba de <b>Carpetazo.cl</b>. Si lo recibiste, el envío de avisos funciona.</p><p>Equipo Carpetazo<br><a href="https://carpetazo.cl">carpetazo.cl</a></p>`
    });
    res.json({ success: true, sent: result.sent, reason: result.reason || null });
  } catch (error) {
    console.error('Error in test email:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Evidencia de aceptación de Términos y Política para una defensa legal: historial completo (incluidas las anuladas y las de
// cuentas borradas), buscable por usuario o por correo; con una IP indica qué aceptaciones se hicieron desde ella.
router.post('/api/admin/terms/evidence', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    const { username, email, ip } = req.body || {};
    const cleanUsername = typeof username === 'string' ? username.trim().toLowerCase().replace(/^@/, '') : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanIp = typeof ip === 'string' ? ip.trim() : '';
    if ((cleanUsername && !/^[a-z0-9_]{3,60}$/.test(cleanUsername)) || (cleanEmail && (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(cleanEmail))) || (cleanIp && !/^[0-9a-fA-F:.]{3,45}$/.test(cleanIp))) {
      return badRequest(res, 'Datos de búsqueda inválidos');
    }
    if (!cleanUsername && !cleanEmail) return badRequest(res, 'Indica un usuario o un correo');
    const owner = cleanUsername ? await prisma.user.findUnique({ where: { username: cleanUsername }, select: { id: true } }) : null;
    const where = { OR: [...(owner ? [{ userId: owner.id }] : []), ...(cleanEmail ? [{ emailHash: hashEmail(cleanEmail) }] : [])] };
    const rows = where.OR.length
      ? await prisma.termsAcceptance.findMany({ where, orderBy: { acceptedAt: 'desc' }, take: 200, include: { user: { select: { username: true, role: true } } } })
      : [];
    const ipHashes = cleanIp ? [hashIp(cleanIp), hashIp('::ffff:' + cleanIp)] : [];
    const emailHashValue = cleanEmail ? hashEmail(cleanEmail) : null;
    await prisma.moderationAudit.create({ data: { actorId: await currentUserId(req), action: 'terms.evidence_viewed', targetType: 'user', targetId: owner?.id || null, note: 'Consultó la evidencia de aceptación de Términos (' + rows.length + ' registros)' } });
    res.json({
      success: true,
      current: LEGAL_CURRENT,
      acceptances: rows.map((row) => ({
        id: row.id,
        acceptedAt: row.acceptedAt,
        termsVersion: row.termsVersion,
        privacyVersion: row.privacyVersion,
        isAdult: row.isAdult,
        method: row.method,
        userAgent: row.userAgent,
        voidedAt: row.voidedAt,
        username: row.user?.username || null,
        accountDeleted: row.user?.role === 'deleted',
        emailMatches: emailHashValue ? row.emailHash === emailHashValue : null,
        ipMatches: cleanIp ? ipHashes.includes(row.connectionHash) : null
      }))
    });
  } catch (error) {
    console.error('Error loading terms evidence:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Plan de una persona (solo administradores): una concesión manual manda sobre la suscripción hasta que se quite.
const planTarget = async (raw) => {
  const username = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!validUsername(username)) return null;
  return prisma.user.findUnique({ where: { username }, select: { id: true, username: true, role: true, isOwner: true } });
};
// Un co-administrador no modifica cuentas de administradores, de otros co-administradores ni la propietaria
const COADMIN_LIMIT = 'Un co-administrador no puede cambiar la cuenta de un administrador ni de la propietaria.';
const blockedForCoAdmin = (req, user) => Boolean(user) && isCoAdmin(req) && (user.isOwner || ['admin', 'coadmin'].includes(user.role));

router.get('/api/admin/users/:username/plan', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    const target = await planTarget(req.params.username);
    if (!target) return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    const [state, grants] = await Promise.all([
      getPlanState(prisma, target.id),
      prisma.planGrant.findMany({ where: { userId: target.id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, planKey: true, reason: true, startsAt: true, endsAt: true, revokedAt: true, createdAt: true } })
    ]);
    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, ...state, grants });
  } catch (error) {
    console.error('Error loading user plan:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// planKey 'auto' quita las concesiones y la persona vuelve a su suscripción (o a Free).
router.post('/api/admin/users/:username/plan', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    const { planKey, reason } = req.body || {};
    const message = cleanNotice(req.body?.message);
    if (message === null) return badRequest(res, `El mensaje para la persona admite hasta ${NOTICE_MAX} caracteres`);
    const startsAt = req.body?.startsAt ? new Date(req.body.startsAt) : null;
    if (startsAt && (Number.isNaN(startsAt.getTime()) || startsAt.getTime() > Date.now() + 366 * 86400000)) return badRequest(res, 'La fecha de inicio no es válida (máximo un año hacia adelante)');
    const days = req.body?.days === undefined || req.body?.days === null || req.body?.days === '' ? null : Number(req.body.days);
    if (planKey !== 'auto' && !validPlanKey(planKey)) return badRequest(res, 'Plan inválido');
    if (planKey === 'free') return badRequest(res, 'Para volver al plan automático usa «Quitar plan asignado»');
    if (!isShortText(reason, 300) || reason.trim().length < 5) return badRequest(res, 'Escribe el motivo (mínimo 5 caracteres)');
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) return badRequest(res, 'Los días deben ser un número entre 1 y 3650');
    const target = await planTarget(req.params.username);
    if (!target) return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    if (blockedForCoAdmin(req, target)) return res.status(403).json({ success: false, message: COADMIN_LIMIT });
    const actorId = await currentUserId(req);
    const clean = reason.trim();
    await prisma.$transaction(async (tx) => {
      await lockPlanUser(tx, target.id);
      await tx.planGrant.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
      if (planKey !== 'auto') {
        await tx.planGrant.create({ data: { userId: target.id, planKey, reason: clean, grantedById: actorId, ...(startsAt ? { startsAt } : {}), endsAt: days ? new Date((startsAt ? startsAt.getTime() : Date.now()) + days * 86400000) : null } });
      }
      await tx.moderationAudit.create({
        data: {
          actorId,
          action: planKey === 'auto' ? 'plan.revoked' : 'plan.granted',
          targetType: 'user',
          targetId: target.id,
          note: planKey === 'auto' ? `Plan manual de @${target.username} quitado: ${clean}` : `Plan ${PLANS[planKey].name} para @${target.username}${days ? ` por ${days} días` : ' sin fecha de término'}: ${clean}`,
          meta: { planKey, days }
        }
      });
    });
    const notified = req.body?.notify === false ? null : await notifyUser({ actorId, targetId: target.id, title: planKey === 'auto' ? 'Quitamos tu plan asignado' : `Tu plan ahora es ${PLANS[planKey].name}`, summary: planKey === 'auto' ? 'El equipo de Carpetazo quitó el plan que te había asignado: vuelves a tu plan automático. No se borró nada de lo que ya tenías.' : `El equipo de Carpetazo te asignó el plan ${PLANS[planKey].name}${days ? ` por ${days} días` : ' sin fecha de término'}.`, message });
    res.json({ success: true, notified, ...(await getPlanState(prisma, target.id)) });
  } catch (error) {
    console.error('Error changing user plan:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// ============ Ficha completa de una cuenta (solo administradores) ============
const fullTarget = (raw) => {
  const username = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!validUsername(username)) return null;
  return prisma.user.findUnique({ where: { username } });
};
const dayText = (date) => date ? new Date(date).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const asDate = (value) => (value === null || value === '' ? null : new Date(value));
const validDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

router.get('/api/admin/users/:username/details', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    const user = await fullTarget(req.params.username);
    if (!user) return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    const [state, grants, subscriptions, sanctions, audit, folders, cards, salesDone, salesAll, purchases, reviews, reportsOpen, pushDevices] = await Promise.all([
      getPlanState(prisma, user.id),
      prisma.planGrant.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, planKey: true, reason: true, startsAt: true, endsAt: true, revokedAt: true, createdAt: true, grantedBy: { select: { username: true, name: true } } } }),
      prisma.subscription.findMany({ where: { userId: user.id, status: { not: 'scheduled' } }, orderBy: { createdAt: 'desc' }, take: 20, include: { payments: { orderBy: { createdAt: 'desc' }, take: 12, select: { id: true, status: true, amountClp: true, paidAt: true, createdAt: true } } } }),
      prisma.sanction.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, type: true, status: true, reason: true, expiresAt: true, createdAt: true } }),
      prisma.moderationAudit.findMany({ where: { targetType: 'user', targetId: user.id }, orderBy: { createdAt: 'desc' }, take: 40, select: { id: true, action: true, note: true, createdAt: true, actorId: true } }),
      prisma.folder.count({ where: { userId: user.id } }),
      prisma.card.count({ where: { folder: { userId: user.id } } }),
      prisma.order.count({ where: { sellerId: user.id, status: 'completed' } }),
      prisma.order.count({ where: { sellerId: user.id } }),
      prisma.order.count({ where: { buyerId: user.id } }),
      prisma.sellerReview.count({ where: { sellerId: user.id } }),
      prisma.report.count({ where: { targetOwnerId: user.id, status: 'open' } }),
      prisma.pushSubscription.count({ where: { userId: user.id } })
    ]);
    const actors = await prisma.user.findMany({ where: { id: { in: [...new Set(audit.map((row) => row.actorId).filter(Boolean))] } }, select: { id: true, username: true, name: true } });
    const actorName = new Map(actors.map((row) => [row.id, row.name || row.username]));
    const planLabel = (key) => PLANS[key]?.name || key;
    const now = new Date();
    res.set('Cache-Control', 'private, no-store');
    res.json({
      success: true,
      account: {
        username: user.username, name: user.name, email: user.email, role: user.role, isOwner: user.isOwner, emailVerified: user.emailVerified, bio: user.bio,
        region: user.publicRegion, comuna: user.publicComuna, createdAt: user.createdAt, updatedAt: user.updatedAt, lastSeenAt: user.lastSeenAt, pushDevices, moderationHidden: user.moderationHidden
      },
      activity: { folders, cards, completedSales: salesDone, totalSales: salesAll, purchases, reviewsReceived: reviews, openReportsAgainstThem: reportsOpen },
      plan: { ...state.plan, source: state.source, grant: state.grant, subscription: state.subscription },
      grants: grants.map((row) => ({ ...row, planName: planLabel(row.planKey), active: !row.revokedAt && row.startsAt <= now && (!row.endsAt || row.endsAt > now), grantedBy: row.grantedBy ? (row.grantedBy.name || row.grantedBy.username) : null })),
      subscriptions: subscriptions.map((row) => ({
        id: row.id, planKey: row.planKey, planName: planLabel(row.planKey), status: row.status, priceClp: row.priceClp, provider: row.provider, cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        currentPeriodStart: row.currentPeriodStart, currentPeriodEnd: row.currentPeriodEnd, nextPaymentAt: row.nextPaymentAt, canceledAt: row.canceledAt, createdAt: row.createdAt,
        providerReference: row.providerSubscriptionId ? `${row.providerSubscriptionId.slice(0, 6)}…${row.providerSubscriptionId.slice(-4)}` : null,
        payments: row.payments
      })),
      sanctions,
      history: audit.map((row) => ({ id: row.id, action: row.action, note: row.note, createdAt: row.createdAt, by: row.actorId ? actorName.get(row.actorId) || null : null }))
    });
  } catch (error) {
    console.error('Error loading user details:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Datos de la cuenta que el equipo puede corregir: nombre, usuario y presentación
router.put('/api/admin/users/:username/profile', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    const { name, username, bio, reason } = req.body || {};
    const message = cleanNotice(req.body?.message);
    if (message === null) return badRequest(res, `El mensaje para la persona admite hasta ${NOTICE_MAX} caracteres`);
    if (!isShortText(reason, 300) || reason.trim().length < 5) return badRequest(res, 'Escribe el motivo (mínimo 5 caracteres)');
    const user = await fullTarget(req.params.username);
    if (!user) return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    if (blockedForCoAdmin(req, user)) return res.status(403).json({ success: false, message: COADMIN_LIMIT });
    const data = {};
    const changes = [];
    if (name !== undefined && name !== user.name) {
      if (!isShortText(name, 60)) return badRequest(res, 'Nombre inválido (hasta 60 caracteres)');
      data.name = name.trim();
      changes.push(`nombre «${user.name || '—'}» → «${data.name}»`);
    }
    if (username !== undefined && username !== user.username) {
      const clean = validUsername(username);
      if (!clean) return badRequest(res, 'Usuario inválido o reservado');
      if (await prisma.user.findUnique({ where: { username: clean }, select: { id: true } })) return res.status(409).json({ success: false, message: 'Ese usuario ya está en uso' });
      data.username = clean;
      changes.push(`usuario @${user.username} → @${clean}`);
    }
    if (bio !== undefined && bio !== user.bio) {
      if (!isOptionalText(bio, 500)) return badRequest(res, 'Presentación inválida (hasta 500 caracteres)');
      data.bio = bio ? bio.trim() : null;
      changes.push('presentación');
    }
    if (!changes.length) return badRequest(res, 'No hay cambios que guardar');
    const actorId = await currentUserId(req);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data }),
      prisma.moderationAudit.create({ data: { actorId, action: 'user.profile_edited', targetType: 'user', targetId: user.id, note: `@${user.username}: ${changes.join(', ')}. ${reason.trim()}`, meta: { fields: Object.keys(data) } } })
    ]);
    const notified = req.body?.notify === false ? null : await notifyUser({ actorId, targetId: user.id, title: 'Actualizamos los datos de tu cuenta', summary: `El equipo de Carpetazo cambió: ${changes.join(', ')}.`, message });
    res.json({ success: true, notified, username: data.username || user.username });
  } catch (error) {
    console.error('Error editing user profile:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Editar una concesión de plan: plan, fecha de inicio y de término
router.put('/api/admin/users/:username/grants/:id', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    const { planKey, reason } = req.body || {};
    const message = cleanNotice(req.body?.message);
    if (message === null) return badRequest(res, `El mensaje para la persona admite hasta ${NOTICE_MAX} caracteres`);
    if (!isShortText(reason, 300) || reason.trim().length < 5) return badRequest(res, 'Escribe el motivo (mínimo 5 caracteres)');
    if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Concesión no encontrada' });
    const user = await fullTarget(req.params.username);
    const grant = user && await prisma.planGrant.findFirst({ where: { id: req.params.id, userId: user.id } });
    if (!grant) return res.status(404).json({ success: false, message: 'Concesión no encontrada' });
    if (blockedForCoAdmin(req, user)) return res.status(403).json({ success: false, message: COADMIN_LIMIT });
    if (grant.revokedAt) return res.status(409).json({ success: false, message: 'Esa concesión ya fue quitada' });
    const data = {};
    if (planKey !== undefined) {
      if (!validPlanKey(planKey) || planKey === 'free') return badRequest(res, 'Plan inválido');
      data.planKey = planKey;
    }
    if (req.body?.startsAt !== undefined) {
      const startsAt = asDate(req.body.startsAt);
      if (!startsAt || !validDate(startsAt)) return badRequest(res, 'La fecha de inicio no es válida');
      data.startsAt = startsAt;
    }
    if (req.body?.endsAt !== undefined) {
      const endsAt = asDate(req.body.endsAt);
      if (endsAt !== null && !validDate(endsAt)) return badRequest(res, 'La fecha de término no es válida');
      data.endsAt = endsAt;
    }
    const startsAt = data.startsAt || grant.startsAt;
    const endsAt = data.endsAt === undefined ? grant.endsAt : data.endsAt;
    if (endsAt && endsAt <= startsAt) return badRequest(res, 'La fecha de término debe ser posterior a la de inicio');
    if (endsAt && endsAt.getFullYear() > new Date().getFullYear() + 10) return badRequest(res, 'La fecha de término está demasiado lejos');
    if (!Object.keys(data).length) return badRequest(res, 'No hay cambios que guardar');
    const actorId = await currentUserId(req);
    const finalPlan = data.planKey || grant.planKey;
    await prisma.$transaction(async (tx) => {
      await lockPlanUser(tx, user.id);
      await tx.planGrant.update({ where: { id: grant.id }, data });
      await tx.moderationAudit.create({ data: { actorId, action: 'plan.grant_edited', targetType: 'user', targetId: user.id, note: `Plan asignado a @${user.username}: ${PLANS[finalPlan].name}, ${dayText(startsAt)} → ${endsAt ? dayText(endsAt) : 'sin fecha de término'}. ${reason.trim()}`, meta: { grantId: grant.id, fields: Object.keys(data) } } });
    });
    const notified = req.body?.notify === false ? null : await notifyUser({ actorId, targetId: user.id, title: 'Actualizamos tu plan asignado', summary: `Tu plan ${PLANS[finalPlan].name} ahora ${endsAt ? `termina el ${dayText(endsAt)}` : 'no tiene fecha de término'}.`, message });
    res.json({ success: true, notified, ...(await getPlanState(prisma, user.id)) });
  } catch (error) {
    console.error('Error editing plan grant:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Cancelar la suscripción pagada de una persona (corta los cobros; conserva lo ya pagado)
router.post('/api/admin/users/:username/subscription/cancel', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    const { reason } = req.body || {};
    const message = cleanNotice(req.body?.message);
    if (message === null) return badRequest(res, `El mensaje para la persona admite hasta ${NOTICE_MAX} caracteres`);
    if (!isShortText(reason, 300) || reason.trim().length < 5) return badRequest(res, 'Escribe el motivo (mínimo 5 caracteres)');
    const user = await fullTarget(req.params.username);
    if (!user) return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    if (blockedForCoAdmin(req, user)) return res.status(403).json({ success: false, message: COADMIN_LIMIT });
    const subscription = await prisma.subscription.findFirst({ where: { userId: user.id, status: { in: ['active', 'past_due', 'paused', 'pending'] }, cancelAtPeriodEnd: false }, orderBy: { createdAt: 'desc' } });
    if (!subscription) return res.status(404).json({ success: false, message: 'Esa persona no tiene una suscripción activa' });
    const actorId = await currentUserId(req);
    const { endsAt } = await cancelSubscriptionRecord(subscription);
    await prisma.moderationAudit.create({ data: { actorId, action: 'subscription.canceled_by_staff', targetType: 'user', targetId: user.id, note: `Suscripción ${PLANS[subscription.planKey]?.name || subscription.planKey} de @${user.username} cancelada por el equipo. ${reason.trim()}`, meta: { subscriptionId: subscription.id } } });
    const notified = req.body?.notify === false ? null : await notifyUser({ actorId, targetId: user.id, title: 'Cancelamos tu suscripción', summary: `El equipo de Carpetazo canceló tu suscripción: no se te volverá a cobrar.${endsAt ? ` Conservas tu plan hasta el ${dayText(endsAt)}.` : ''}`, message });
    res.json({ success: true, endsAt, notified });
  } catch (error) {
    console.error('Error canceling subscription by staff:', error.code || error.message, error.providerStatus || '');
    const own = ['billing_not_configured', 'mercadopago_error'].includes(error.code);
    res.status(own ? error.status || 500 : 500).json({ success: false, message: own ? error.message : 'Error interno' });
  }
});

// Un aviso suelto, sin cambiar nada en la cuenta
router.post('/api/admin/users/:username/notify', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    const message = cleanNotice(req.body?.message);
    if (!message || message.length < 5) return badRequest(res, `Escribe el mensaje para la persona (entre 5 y ${NOTICE_MAX} caracteres)`);
    const user = await fullTarget(req.params.username);
    if (!user || user.role === 'deleted') return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    const actorId = await currentUserId(req);
    await prisma.moderationAudit.create({ data: { actorId, action: 'user.notice_sent', targetType: 'user', targetId: user.id, note: `Aviso a @${user.username}: ${message.slice(0, 200)}` } });
    const notified = await notifyUser({ actorId, targetId: user.id, title: 'Un mensaje del equipo de Carpetazo', summary: message, message: '' });
    res.json({ success: true, notified });
  } catch (error) {
    console.error('Error sending staff notice:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Configuración del pie de página (público para la web)
router.get('/api/site/footer', async (_req, res) => {
  try {
    const settings = await getFooterSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error loading footer settings:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Actualizar configuración del pie de página (solo administradores y moderadores nivel 2+)
router.put('/api/admin/site/footer', authenticateToken, requireStaff(2), async (req, res) => {
  try {
    const updated = await saveFooterSettings(req.body || {});
    const actorId = await currentUserId(req);
    await prisma.moderationAudit.create({
      data: {
        actorId,
        action: 'site.footer_updated',
        targetType: 'system',
        note: 'Actualizó la configuración del pie de página'
      }
    }).catch(() => {});
    res.json({ success: true, settings: updated });
  } catch (error) {
    if (error instanceof FooterValidationError) return badRequest(res, error.message);
    console.error('Error saving footer settings:', error);
    res.status(500).json({ success: false, message: 'Error interno al guardar la configuración' });
  }
});

export default router;
