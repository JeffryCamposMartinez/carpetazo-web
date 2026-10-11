// Equipo y administradores: jerarquía, búsqueda de personas (con foto), cambios de rol y medidas sobre integrantes del equipo.
//
// Jerarquía (de mayor a menor): Propietario > Administrador > Moderador > Soporte > Persona sin rol.
//  - La cuenta PROPIETARIA es la cuenta original de Carpetazo: nadie puede cambiar su rol, suspenderla, cerrarla ni ocultar su contenido.
//  - Los administradores pueden hacer de todo sobre los demás integrantes del equipo (incluidos otros administradores), salvo sobre la propietaria.
//  - Nadie actúa sobre su propia cuenta desde aquí, y siempre queda al menos un administrador.
//  - Cada acción exige escribir el usuario exacto de la persona (segunda confirmación en el servidor), queda en la auditoría y se avisa por correo.
import express from 'express';
import { authenticateToken, currentUserId, isAdminEmail, requireStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { badRequest, isUuid } from '../core/validation.js';
import { escapeHtml, sendUserEmail } from '../core/mail.js';
import { moderationHooks } from '../moderation/services.js';

const router = express.Router();
const MIN_QUERY = 2;
const MAX_RESULTS = 8;
const CHANGES_PER_HOUR = 30;
const DAY = 24 * 60 * 60 * 1000;
const changeLog = new Map(); // quien hace el cambio -> momentos de los últimos intentos

const RANK = { owner: 4, admin: 3, moderator: 2, support: 1, user: 0 };
const ROLE_LABEL = { admin: 'Administrador', moderator: 'Moderador', support: 'Soporte', user: 'Sin rol de equipo' };
const ASSIGNABLE = ['admin', 'moderator', 'support', 'user'];
const rankOf = (user) => (user.isOwner ? RANK.owner : RANK[user.role] ?? 0);

const PERSON = { id: true, username: true, name: true, photoURL: true, role: true, isOwner: true, createdAt: true, publicComuna: true };
const blockWhere = () => ({ type: { in: ['suspend', 'ban'] }, status: 'active', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] });

const toPerson = (user, extra = {}) => ({
  id: user.id, username: user.username, name: user.name, photoURL: user.photoURL, role: user.role,
  isOwner: Boolean(user.isOwner), rank: rankOf(user), createdAt: user.createdAt, comuna: user.publicComuna, ...extra
});
const toRestriction = (sanction) => (sanction ? { type: sanction.type, reason: sanction.reason, since: sanction.createdAt, until: sanction.expiresAt } : null);

const text = (value, min, max) => typeof value === 'string' && /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/.test(value) && value.trim().length >= min && value.trim().length <= max;
const same = (typed, username) => typeof typed === 'string' && typed.trim().replace(/^@/, '').toLowerCase() === String(username).toLowerCase();

// Tope de cambios por hora de quien los hace
const throttled = (actorId) => {
  const recent = (changeLog.get(actorId) || []).filter((at) => Date.now() - at < 60 * 60 * 1000);
  if (recent.length >= CHANGES_PER_HOUR) return true;
  changeLog.set(actorId, [...recent, Date.now()]);
  return false;
};

// Quién hace el cambio y a quién: reglas de jerarquía comunes a todas las acciones
const loadParties = async (req, targetId) => {
  const actorId = await currentUserId(req);
  if (!actorId) return { error: [404, 'Usuario no encontrado'] };
  if (!isUuid(targetId)) return { error: [400, 'Datos inválidos'] };
  const [actor, target] = await Promise.all([
    prisma.user.findUnique({ where: { id: actorId }, select: { ...PERSON, email: true } }),
    prisma.user.findUnique({ where: { id: targetId }, select: { ...PERSON, email: true } })
  ]);
  if (!actor) return { error: [404, 'Usuario no encontrado'] };
  if (!target || target.role === 'deleted' || !target.username) return { error: [404, 'Usuario no encontrado'] };
  if (target.isOwner) return { error: [403, 'Esta es la cuenta original de Carpetazo. Está protegida: nadie puede cambiar su rol, suspenderla ni cerrarla.'] };
  if (target.id === actor.id) return { error: [403, 'No puedes hacer esto sobre tu propia cuenta.'] };
  // Quien es administrador por la configuración o por una credencial de Firebase cuenta como administrador aunque su fila diga otra cosa
  const actorRank = Math.max(rankOf(actor), req.staffLevel >= 3 ? RANK.admin : 0);
  if (actorRank < rankOf(target)) return { error: [403, 'No puedes actuar sobre alguien de un nivel superior al tuyo.'] };
  if (throttled(actor.id)) return { error: [429, 'Hiciste varios cambios seguidos. Inténtalo más tarde.'] };
  return { actor, target };
};
const fail = (res, [status, message]) => res.status(status).json({ success: false, message });

// Avisos: a la persona afectada y al resto de administradores
const notify = async ({ actor, target, subject, line, toTarget }) => {
  try {
    const by = `@${actor.username}`;
    if (toTarget) sendUserEmail(target.id, { subject: toTarget.subject, text: `Hola:\n\n${toTarget.text}\n\nEquipo Carpetazo`, html: `<p>Hola:</p><p>${escapeHtml(toTarget.text).replace(/\n/g, '<br>')}</p><p>Equipo Carpetazo</p>` }).catch(() => {});
    const admins = await prisma.user.findMany({ where: { role: 'admin', id: { notIn: [target.id, actor.id] } }, select: { id: true } });
    for (const admin of admins) {
      sendUserEmail(admin.id, { subject, text: `${by} ${line}\n\nRevísalo en la Auditoría: https://carpetazo.cl/moderacion`, html: `<p>${escapeHtml(by)} ${escapeHtml(line)}</p><p><a href="https://carpetazo.cl/moderacion">Ver en Moderación</a></p>` }).catch(() => {});
    }
  } catch (_error) { /* los avisos nunca rompen la acción */ }
};

const audit = (actorId, action, target, note, meta = {}) => prisma.moderationAudit.create({ data: { actorId, action, targetType: 'user', targetId: target.id, note, meta } });

// ============ Lectura ============
// Jerarquía actual: cada integrante con su nivel, estado, actividad de los últimos 30 días y si su rol viene de la configuración del servidor
router.get('/api/admin/team', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    const meId = await currentUserId(req);
    const members = await prisma.user.findMany({ where: { OR: [{ role: { in: ['admin', 'moderator', 'support'] } }, { isOwner: true }] }, select: { ...PERSON, email: true }, orderBy: { createdAt: 'asc' }, take: 200 });
    const ids = members.map((member) => member.id);
    const [blocks, activity] = await Promise.all([
      prisma.sanction.findMany({ where: { userId: { in: ids }, ...blockWhere() }, select: { userId: true, type: true, reason: true, createdAt: true, expiresAt: true } }),
      prisma.moderationAudit.groupBy({ by: ['actorId'], where: { actorId: { in: ids }, createdAt: { gte: new Date(Date.now() - 30 * DAY) } }, _count: { _all: true }, _max: { createdAt: true } })
    ]);
    const blockBy = new Map(blocks.map((block) => [block.userId, block]));
    const activityBy = new Map(activity.map((row) => [row.actorId, row]));
    const team = members
      .map((member) => toPerson(member, {
        restriction: toRestriction(blockBy.get(member.id)),
        fixedByConfig: member.role === 'admin' && isAdminEmail(member.email),
        actions30d: activityBy.get(member.id)?._count._all || 0,
        lastActionAt: activityBy.get(member.id)?._max.createdAt || null
      }))
      .sort((a, b) => b.rank - a.rank || new Date(a.createdAt) - new Date(b.createdAt));
    const me = team.find((member) => member.id === meId) || (await prisma.user.findUnique({ where: { id: meId }, select: PERSON }).then((user) => (user ? toPerson(user) : null)));
    res.json({ success: true, team, me: me ? { id: me.id, rank: me.rank, isOwner: me.isOwner, role: me.role } : null });
  } catch (error) {
    console.error('Error loading team:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Buscar personas por usuario o nombre: foto, nombre, usuario, rol y estado (nunca correo ni datos privados)
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
    const top = people.sort((a, b) => rank(a) - rank(b)).slice(0, MAX_RESULTS);
    const blocks = await prisma.sanction.findMany({ where: { userId: { in: top.map((person) => person.id) }, ...blockWhere() }, select: { userId: true, type: true, reason: true, createdAt: true, expiresAt: true } });
    const blockBy = new Map(blocks.map((block) => [block.userId, block]));
    res.json({ success: true, people: top.map((person) => toPerson(person, { restriction: toRestriction(blockBy.get(person.id)) })) });
  } catch (error) {
    console.error('Error searching people:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Historial del equipo: cambios de rol y medidas sobre integrantes, con quién los hizo
router.get('/api/admin/team/history', authenticateToken, requireStaff(3), async (_req, res) => {
  try {
    const rows = await prisma.moderationAudit.findMany({ where: { OR: [{ action: { startsWith: 'role.' } }, { action: { startsWith: 'team.' } }] }, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, actorId: true, action: true, targetId: true, note: true, createdAt: true } });
    const ids = [...new Set(rows.flatMap((row) => [row.actorId, row.targetId]).filter(Boolean))];
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true, name: true, photoURL: true } });
    const byId = new Map(users.map((user) => [user.id, user]));
    const who = (id) => { const user = byId.get(id); return user ? { username: user.username, name: user.name, photoURL: user.photoURL } : null; };
    res.json({ success: true, events: rows.map((row) => ({ id: row.id, action: row.action, note: row.note, at: row.createdAt, actor: who(row.actorId), target: who(row.targetId) })) });
  } catch (error) {
    console.error('Error loading team history:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// ============ Cambios de rol ============
// Dar o quitar un rol (incluido el de administrador). Quitar el rol a otro administrador es posible, salvo a la propietaria.
router.post('/api/admin/team/:id/role', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    const { role, confirmUsername } = req.body || {};
    if (!ASSIGNABLE.includes(role) || typeof confirmUsername !== 'string') return badRequest(res, 'Datos inválidos');
    const parties = await loadParties(req, req.params.id);
    if (parties.error) return fail(res, parties.error);
    const { actor, target } = parties;
    if (!same(confirmUsername, target.username)) return badRequest(res, 'El usuario escrito no coincide con la persona elegida');
    if (target.role === role) return res.status(409).json({ success: false, message: `Esta persona ya tiene el rol de ${ROLE_LABEL[role].toLowerCase()}` });
    if (target.role === 'admin' && isAdminEmail(target.email)) return res.status(409).json({ success: false, message: 'Esta cuenta es administradora por la configuración del servidor (ADMIN_EMAILS). Para quitarle el rol hay que sacar su correo de esa variable.' });
    if (target.role === 'admin') {
      const others = await prisma.user.count({ where: { role: 'admin', id: { not: target.id } } });
      if (others === 0) return res.status(409).json({ success: false, message: 'Debe quedar al menos un administrador.' });
    }
    const promoted = rankOf({ role }) > rankOf(target);
    const changed = await prisma.$transaction(async (tx) => {
      const claimed = await tx.user.updateMany({ where: { id: target.id, role: target.role, isOwner: false }, data: { role } });
      if (claimed.count === 0) return false;
      const action = role === 'admin' ? 'role.admin_granted' : target.role === 'admin' ? 'role.admin_revoked' : 'role.changed';
      await tx.moderationAudit.create({ data: { actorId: actor.id, action, targetType: 'user', targetId: target.id, note: `Rol de @${target.username}: ${ROLE_LABEL[target.role]} → ${ROLE_LABEL[role]}`, meta: { previousRole: target.role, newRole: role } } });
      return true;
    });
    if (!changed) return res.status(409).json({ success: false, message: 'El rol de esta persona cambió mientras tanto. Revisa y vuelve a intentar.' });
    notify({
      actor, target,
      subject: `Cambio de rol en Carpetazo: @${target.username}`,
      line: `cambió el rol de @${target.username}: ${ROLE_LABEL[target.role]} → ${ROLE_LABEL[role]}.`,
      toTarget: { subject: promoted ? `Tu rol en Carpetazo ahora es: ${ROLE_LABEL[role]}` : 'Cambió tu rol en Carpetazo', text: `@${actor.username} cambió tu rol en Carpetazo: ahora eres ${ROLE_LABEL[role].toLowerCase()}.${role === 'user' ? ' Ya no tienes acceso a Moderación.' : ' Puedes entrar a Moderación en https://carpetazo.cl/moderacion.'}` }
    });
    res.json({ success: true, person: toPerson({ ...target, role }) });
  } catch (error) {
    console.error('Error changing team role:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// ============ Medidas sobre integrantes del equipo ============
// Suspender: la persona pierde el acceso a Moderación y a escribir en la plataforma hasta que venza o se levante
router.post('/api/admin/team/:id/suspend', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    const { reason, days, confirmUsername } = req.body || {};
    if (!text(reason, 5, 300) || typeof confirmUsername !== 'string') return badRequest(res, 'Escribe el motivo (entre 5 y 300 caracteres) y confirma el usuario');
    if (days !== undefined && days !== null && (!Number.isInteger(days) || days < 1 || days > 365)) return badRequest(res, 'Duración inválida');
    const parties = await loadParties(req, req.params.id);
    if (parties.error) return fail(res, parties.error);
    const { actor, target } = parties;
    if (!same(confirmUsername, target.username)) return badRequest(res, 'El usuario escrito no coincide con la persona elegida');
    if (await prisma.sanction.findFirst({ where: { userId: target.id, ...blockWhere() }, select: { id: true } })) return res.status(409).json({ success: false, message: 'Esta cuenta ya tiene una medida vigente' });
    const clean = reason.trim();
    await moderationHooks.sanctionStaff({ userId: target.id, type: 'suspend', reason: clean, durationDays: days || null, actorId: actor.id });
    await audit(actor.id, 'team.suspended', target, `Cuenta de @${target.username} suspendida${days ? ` por ${days} días` : ' hasta nuevo aviso'}: ${clean}`, { days: days || null });
    notify({ actor, target, subject: `Cuenta del equipo suspendida: @${target.username}`, line: `suspendió la cuenta de @${target.username}${days ? ` por ${days} días` : ' hasta nuevo aviso'}. Motivo: ${clean}` });
    res.json({ success: true });
  } catch (error) {
    console.error('Error suspending team member:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Cerrar la cuenta: queda sin acceso y sin rol de equipo (si se restaura, el rol hay que darlo de nuevo a propósito)
router.post('/api/admin/team/:id/close', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    const { reason, confirmUsername } = req.body || {};
    if (!text(reason, 5, 300) || typeof confirmUsername !== 'string') return badRequest(res, 'Escribe el motivo (entre 5 y 300 caracteres) y confirma el usuario');
    const parties = await loadParties(req, req.params.id);
    if (parties.error) return fail(res, parties.error);
    const { actor, target } = parties;
    if (!same(confirmUsername, target.username)) return badRequest(res, 'El usuario escrito no coincide con la persona elegida');
    if (target.role === 'admin' && isAdminEmail(target.email)) return res.status(409).json({ success: false, message: 'Esta cuenta es administradora por la configuración del servidor (ADMIN_EMAILS). Para cerrarla hay que sacar su correo de esa variable.' });
    if (target.role === 'admin') {
      const others = await prisma.user.count({ where: { role: 'admin', id: { not: target.id } } });
      if (others === 0) return res.status(409).json({ success: false, message: 'Debe quedar al menos un administrador.' });
    }
    const clean = reason.trim();
    // Antes de cerrar se quitan las medidas anteriores vigentes, para que quede una sola: el cierre
    await moderationHooks.restoreStaff({ userId: target.id, note: 'Se reemplaza por el cierre de la cuenta', actorId: actor.id });
    await moderationHooks.sanctionStaff({ userId: target.id, type: 'ban', reason: clean, actorId: actor.id });
    await prisma.user.updateMany({ where: { id: target.id, isOwner: false }, data: { role: 'user' } });
    await audit(actor.id, 'team.closed', target, `Cuenta de @${target.username} cerrada (antes: ${ROLE_LABEL[target.role]}): ${clean}`, { previousRole: target.role });
    notify({ actor, target, subject: `Cuenta del equipo cerrada: @${target.username}`, line: `cerró la cuenta de @${target.username} (antes: ${ROLE_LABEL[target.role]}). Motivo: ${clean}` });
    res.json({ success: true });
  } catch (error) {
    console.error('Error closing team member account:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Restaurar: levanta la suspensión o el cierre. El rol de equipo no vuelve solo.
router.post('/api/admin/team/:id/restore', authenticateToken, requireStaff(3), async (req, res) => {
  try {
    const { note, confirmUsername } = req.body || {};
    if (!text(note, 5, 500) || typeof confirmUsername !== 'string') return badRequest(res, 'Escribe el motivo (entre 5 y 500 caracteres) y confirma el usuario');
    const parties = await loadParties(req, req.params.id);
    if (parties.error) return fail(res, parties.error);
    const { actor, target } = parties;
    if (!same(confirmUsername, target.username)) return badRequest(res, 'El usuario escrito no coincide con la persona elegida');
    const revoked = await moderationHooks.restoreStaff({ userId: target.id, note: note.trim(), actorId: actor.id });
    if (revoked === 0) return res.status(409).json({ success: false, message: 'Esta cuenta no tiene una suspensión ni un cierre vigente' });
    await audit(actor.id, 'team.restored', target, `Cuenta de @${target.username} restaurada: ${note.trim()}`);
    notify({ actor, target, subject: `Cuenta restaurada: @${target.username}`, line: `restauró la cuenta de @${target.username}. Motivo: ${note.trim()}`, toTarget: { subject: 'Restauramos tu cuenta en Carpetazo', text: 'Levantamos la medida sobre tu cuenta de Carpetazo. Ya puedes usarla con normalidad.' } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error restoring team member:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
