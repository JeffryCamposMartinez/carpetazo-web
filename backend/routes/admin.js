// Rutas de administración que no son de moderación.
import express from 'express';
import { authenticateToken, currentUserId, requireAdmin, requireStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { hashEmail, hashIp } from '../core/hashing.js';
import { LEGAL_CURRENT } from '../core/legal.js';
import { escapeHtml, sendUserEmail } from '../core/mail.js';
import { badRequest, validUsername } from '../core/validation.js';

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

export default router;
