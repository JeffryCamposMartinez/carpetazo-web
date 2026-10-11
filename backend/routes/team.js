// Equipo: ver quién es del equipo, buscar personas (con su foto, para no equivocarse) y dar el rol de administrador.
// Dar el rol exige estar en el equipo con nivel 3 y una doble confirmación: la pantalla pide dos pasos y el servidor exige escribir el usuario exacto.
import express from 'express';
import { authenticateToken, currentUserId, requireStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { badRequest, isUuid } from '../core/validation.js';
import { escapeHtml, sendUserEmail } from '../core/mail.js';

const router = express.Router();
const MIN_QUERY = 2;
const MAX_RESULTS = 8;
const GRANTS_PER_HOUR = 5;
const grantLog = new Map(); // quien da el rol -> momentos de los últimos intentos

const PERSON = { id: true, username: true, name: true, photoURL: true, role: true, createdAt: true, publicComuna: true };
const toPerson = (user) => ({ id: user.id, username: user.username, name: user.name, photoURL: user.photoURL, role: user.role, createdAt: user.createdAt, comuna: user.publicComuna });

// Equipo actual: administradores, moderadores y soporte
router.get('/api/admin/team', authenticateToken, requireStaff(3), async (_req, res) => {
  try {
    const people = await prisma.user.findMany({ where: { role: { in: ['admin', 'moderator', 'support'] } }, select: PERSON, orderBy: { createdAt: 'asc' }, take: 100 });
    const order = { admin: 0, moderator: 1, support: 2 };
    res.json({ success: true, team: people.sort((a, b) => order[a.role] - order[b.role]).map(toPerson) });
  } catch (error) {
    console.error('Error loading team:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Buscar personas por usuario o nombre: foto, nombre, usuario, rol y desde cuándo están (nunca correo ni datos privados)
router.get('/api/admin/team/search', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().replace(/^@/, '') : '';
    if (q.length < MIN_QUERY || q.length > 40 || /[\u0000-\u001f]/.test(q)) return badRequest(res, 'Escribe al menos 2 letras del usuario o del nombre');
    const people = await prisma.user.findMany({
      where: { role: { not: 'deleted' }, username: { not: null }, OR: [{ username: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] },
      select: PERSON,
      take: 40
    });
    const lower = q.toLowerCase();
    const rank = (person) => (person.username?.toLowerCase() === lower ? 0 : person.username?.toLowerCase().startsWith(lower) ? 1 : person.name?.toLowerCase().startsWith(lower) ? 2 : 3);
    res.json({ success: true, people: people.sort((a, b) => rank(a) - rank(b)).slice(0, MAX_RESULTS).map(toPerson) });
  } catch (error) {
    console.error('Error searching people:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Dar el rol de administrador. Segunda confirmación en el servidor: hay que escribir el usuario exacto de la persona elegida.
router.post('/api/admin/team/admins', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    const { userId, confirmUsername } = req.body || {};
    if (!isUuid(userId) || typeof confirmUsername !== 'string') return badRequest(res, 'Datos inválidos');
    const actorId = await currentUserId(req);
    if (!actorId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const recent = (grantLog.get(actorId) || []).filter((at) => Date.now() - at < 60 * 60 * 1000);
    if (recent.length >= GRANTS_PER_HOUR) return res.status(429).json({ success: false, message: 'Hiciste varios cambios seguidos. Inténtalo más tarde.' });
    grantLog.set(actorId, [...recent, Date.now()]);

    const target = await prisma.user.findUnique({ where: { id: userId }, select: PERSON });
    if (!target || target.role === 'deleted' || !target.username) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (confirmUsername.trim().replace(/^@/, '').toLowerCase() !== target.username.toLowerCase()) return badRequest(res, 'El usuario escrito no coincide con la persona elegida');
    if (target.role === 'admin') return res.status(409).json({ success: false, message: 'Esta persona ya es administradora' });

    const previous = target.role;
    // Se reclama solo si todavía no es administradora: dos solicitudes simultáneas no dan dos auditorías
    const [changed] = await prisma.$transaction([
      prisma.user.updateMany({ where: { id: target.id, role: { notIn: ['admin', 'deleted'] } }, data: { role: 'admin' } }),
      prisma.moderationAudit.create({ data: { actorId, action: 'role.admin_granted', targetType: 'user', targetId: target.id, note: `Rol de administrador otorgado a @${target.username} (antes: ${previous})`, meta: { previousRole: previous } } })
    ]);
    if (changed.count === 0) return res.status(409).json({ success: false, message: 'Esta persona ya es administradora' });

    // Aviso a la persona y al resto de administradores (nadie queda como administrador sin que el equipo lo sepa)
    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { username: true, name: true } });
    const by = actor?.username ? `@${actor.username}` : 'un administrador';
    sendUserEmail(target.id, {
      subject: 'Ahora eres administrador de Carpetazo',
      text: `Hola:\n\n${by} te dio el rol de administrador de Carpetazo. Puedes entrar a Moderación en https://carpetazo.cl/moderacion.\n\nCon este rol tienes acceso a todas las secciones, incluidos datos de las personas: úsalo solo para el trabajo de la plataforma.\n\nEquipo Carpetazo`,
      html: `<p>Hola:</p><p>${escapeHtml(by)} te dio el rol de <b>administrador</b> de Carpetazo. Puedes entrar a <a href="https://carpetazo.cl/moderacion">Moderación</a>.</p><p>Con este rol tienes acceso a todas las secciones, incluidos datos de las personas: úsalo solo para el trabajo de la plataforma.</p><p>Equipo Carpetazo</p>`
    }).catch(() => {});
    const others = await prisma.user.findMany({ where: { role: 'admin', id: { notIn: [target.id, actorId] } }, select: { id: true } });
    for (const other of others) {
      sendUserEmail(other.id, {
        subject: `Nuevo administrador en Carpetazo: @${target.username}`,
        text: `${by} dio el rol de administrador a @${target.username}. Si no lo esperabas, revisa la Auditoría en https://carpetazo.cl/moderacion.`,
        html: `<p>${escapeHtml(by)} dio el rol de administrador a <b>@${escapeHtml(target.username)}</b>.</p><p>Si no lo esperabas, revisa la <a href="https://carpetazo.cl/moderacion">Auditoría</a>.</p>`
      }).catch(() => {});
    }

    res.json({ success: true, person: toPerson({ ...target, role: 'admin' }) });
  } catch (error) {
    console.error('Error granting admin role:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
