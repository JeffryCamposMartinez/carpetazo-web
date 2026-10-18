// Rutas de administración que no son de moderación.
import express from 'express';
import { authenticateToken, currentUserId, requireAdmin, requireStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { getPlanState, lockPlanUser } from '../core/entitlements.js';
import { PLANS, validPlanKey } from '../core/plans.js';
import { hashEmail, hashIp } from '../core/hashing.js';
import { LEGAL_CURRENT } from '../core/legal.js';
import { escapeHtml, sendUserEmail } from '../core/mail.js';
import { badRequest, isShortText, validUsername } from '../core/validation.js';

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
  return prisma.user.findUnique({ where: { username }, select: { id: true, username: true, role: true } });
};

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
    const days = req.body?.days === undefined || req.body?.days === null || req.body?.days === '' ? null : Number(req.body.days);
    if (planKey !== 'auto' && !validPlanKey(planKey)) return badRequest(res, 'Plan inválido');
    if (!isShortText(reason, 300) || reason.trim().length < 5) return badRequest(res, 'Escribe el motivo (mínimo 5 caracteres)');
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) return badRequest(res, 'Los días deben ser un número entre 1 y 3650');
    const target = await planTarget(req.params.username);
    if (!target) return res.status(404).json({ success: false, message: 'Persona no encontrada' });
    const actorId = await currentUserId(req);
    const clean = reason.trim();
    await prisma.$transaction(async (tx) => {
      await lockPlanUser(tx, target.id);
      await tx.planGrant.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
      if (planKey !== 'auto') {
        await tx.planGrant.create({ data: { userId: target.id, planKey, reason: clean, grantedById: actorId, endsAt: days ? new Date(Date.now() + days * 86400000) : null } });
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
    res.json({ success: true, ...(await getPlanState(prisma, target.id)) });
  } catch (error) {
    console.error('Error changing user plan:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
