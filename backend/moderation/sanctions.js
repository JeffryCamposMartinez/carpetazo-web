// Moderación, Fase B (documento 20): sanciones, apelaciones, casos de estafa con descargo, bloqueo entre usuarios,
// roles de equipo y evidencias privadas. Se apoya en reports.js (reportes) y en las utilidades de core/.
import crypto from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';

const DAY = 24 * 60 * 60 * 1000;
const APPEAL_WINDOW_MS = 14 * DAY;
const FRAUD_WINDOW_MS = 30 * DAY;
const SUPPORT_EMAIL = 'carpetazo.soporte@gmail.com';
const MODERATOR_MAX_DAYS = 30;
const MAX_DAYS = 365;
const EVIDENCE_MAX = 3;
const EVIDENCE_BYTES = 5 * 1024 * 1024;
const RESPONSE_HOURS = 72;
const RESPONSE_HOURS_HIGH = 48;
const BLOCKS_MAX = 200;
const PAGE_SIZE = 30;
const SHORT_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export const SANCTION_LABELS = {
  warning: 'Advertencia',
  restrict_messages: 'Restricción de mensajes',
  suspend_selling: 'Ventas suspendidas',
  suspend: 'Cuenta suspendida',
  ban: 'Cierre de la cuenta por moderación'
};
const SANCTION_TYPES = Object.keys(SANCTION_LABELS);
const SELLING_EFFECT = ['suspend_selling', 'suspend', 'ban'];
const STAFF_ROLES = ['support', 'moderator'];
const CASE_RESOLUTIONS = { dismissed: null, warned: 'warning', restricted: 'suspend_selling', suspended: 'suspend', escalated: null };

const caseCode = () => `CS-${Array.from(crypto.randomBytes(5), (byte) => SHORT_CODE_ALPHABET[byte % SHORT_CODE_ALPHABET.length]).join('')}`;
const activeWhere = () => ({ status: 'active', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] });

// --- Restricciones vigentes por cuenta: se consultan en cada escritura, con una caché corta ---
export const createRestrictions = ({ prisma, getAuth }) => {
  const byUser = new Map(); // userId -> { until, types }
  const uidToId = new Map(); // firebase uid -> { until, id }
  const TTL = 20 * 1000;
  const UID_TTL = 5 * 60 * 1000;

  const invalidate = (userId) => { if (userId) byUser.delete(userId); };
  const restrictionsFor = async (userId) => {
    const hit = byUser.get(userId);
    if (hit && hit.until > Date.now()) return hit.types;
    const rows = await prisma.sanction.findMany({ where: { userId, ...activeWhere() }, select: { type: true } });
    const types = new Set(rows.map((row) => row.type));
    byUser.set(userId, { until: Date.now() + TTL, types });
    if (byUser.size > 5000) byUser.clear();
    return types;
  };

  const EXEMPT = [['POST', /^\/api\/appeals$/], ['DELETE', /^\/api\/users\/me$/], ['POST', /^\/api\/users\/sync$/], ['POST', /^\/api\/users\/me\/accept-terms$/], ['DELETE', /^\/api\/users\/me\/unaccepted$/], ['POST', /^\/api\/me\/cases\/[^/]+\/response$/]];

  // Una cuenta suspendida no escribe nada (salvo apelar o pedir su baja); con restricciones parciales solo se corta lo que corresponde
  const gate = async (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
    const token = String(req.headers['authorization'] || '').split(' ')[1];
    if (!token) return next();
    try {
      const decoded = await getAuth().verifyIdToken(token);
      let known = uidToId.get(decoded.uid);
      if (!known || known.until < Date.now()) {
        const user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid }, select: { id: true } });
        if (!user) return next();
        known = { id: user.id, until: Date.now() + UID_TTL };
        uidToId.set(decoded.uid, known);
        if (uidToId.size > 5000) uidToId.clear();
      }
      const types = await restrictionsFor(known.id);
      if (types.size === 0) return next();
      if (types.has('suspend') || types.has('ban')) {
        if (EXEMPT.some(([method, pattern]) => method === req.method && pattern.test(path))) return next();
        return res.status(403).json({ success: false, code: 'account_suspended', message: 'Tu cuenta está suspendida. Puedes apelar desde Mi perfil → Moderación o escribir a ' + SUPPORT_EMAIL });
      }
      if (types.has('restrict_messages') && /^\/api\/messages(\/|$)/.test(path)) {
        return res.status(403).json({ success: false, code: 'messages_restricted', message: 'Tus mensajes están restringidos por moderación.' });
      }
      if (types.has('suspend_selling') && /^\/api\/(folders|cards)(\/|$)/.test(path) && ['POST', 'PUT'].includes(req.method)) {
        return res.status(403).json({ success: false, code: 'selling_suspended', message: 'Tus ventas están suspendidas por moderación.' });
      }
      return next();
    } catch (_error) {
      return next();
    }
  };

  return { restrictionsFor, invalidate, gate };
};

export const registerSanctions = (app, deps) => {
  const { prisma, authenticateToken, requireStaff, hooks, restrictions, moderation, badRequest, isUuid, currentUserId, sendUserEmail, escapeHtml } = deps;
  const { applyRestore, cleanText, hasBadControlChars, notifyAdminsOfCritical } = moderation;

  const idsOf = async (userIds) => {
    const ids = [...new Set(userIds.filter(Boolean))];
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true, name: true } }) : [];
    return new Map(users.map((user) => [user.id, user]));
  };

  const findUserByUsername = async (raw) => {
    const username = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!USERNAME_RE.test(username)) return null;
    return prisma.user.findUnique({ where: { username }, select: { id: true, username: true, name: true, role: true, createdAt: true } });
  };

  const textOk = (value, min, max) => typeof value === 'string' && !hasBadControlChars(value) && cleanText(value, max + 1).length >= min && cleanText(value, max + 1).length <= max;

  // Avisos al equipo (administradores y moderadores) por correo: apelaciones, descargos
  const notifyStaff = async (subject, line) => {
    try {
      const staff = await prisma.user.findMany({ where: { role: { in: ['admin', 'moderator'] } }, select: { id: true } });
      await Promise.all(staff.map((member) => sendUserEmail(member.id, { subject, text: `${line}\n\nRevísalo en https://carpetazo.cl/moderacion`, html: `<p>${escapeHtml(line)}</p><p><a href="https://carpetazo.cl/moderacion">Revisarlo en Moderación</a></p>` })));
    } catch (error) {
      console.error('Error notifying staff:', error.message);
    }
  };

  const hideSellerFolders = (tx, userId) => tx.folder.updateMany({ where: { userId, moderationState: 'visible', isPublic: true }, data: { moderationState: 'seller_suspended', isPublic: false } });
  const restoreSellerFolders = async (tx, userId) => {
    const stillActive = await tx.sanction.count({ where: { userId, type: { in: SELLING_EFFECT }, ...activeWhere() } });
    if (!stillActive) await tx.folder.updateMany({ where: { userId, moderationState: 'seller_suspended' }, data: { moderationState: 'visible', isPublic: true } });
  };

  const durationLabel = (sanction) => (sanction.expiresAt ? `hasta el ${new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }).format(sanction.expiresAt)}` : 'hasta nuevo aviso');

  const mailSanction = (userId, sanction, publicMessage = '') => {
    const label = SANCTION_LABELS[sanction.type];
    const timing = sanction.type === 'warning' ? '' : ` Rige ${durationLabel(sanction)}.`;
    const extraText = publicMessage ? `\n\nMensaje del equipo: ${publicMessage}` : '';
    const extraHtml = publicMessage ? `<p><b>Mensaje del equipo:</b> ${escapeHtml(publicMessage)}</p>` : '';
    return sendUserEmail(userId, {
      subject: 'Medida sobre tu cuenta en Carpetazo',
      text: `Hola:\n\nAplicamos una medida a tu cuenta: ${label}.${timing}\n\nMotivo: ${sanction.reason}${extraText}\n\nSi crees que fue un error, puedes apelar dentro de los próximos 14 días desde Mi perfil → Moderación o escribiendo a ${SUPPORT_EMAIL}. Una persona del equipo revisará tu apelación.\n\nEquipo Carpetazo`,
      html: `<p>Hola:</p><p>Aplicamos una medida a tu cuenta: <b>${escapeHtml(label)}</b>.${escapeHtml(timing)}</p><p><b>Motivo:</b> ${escapeHtml(sanction.reason)}</p>${extraHtml}<p>Si crees que fue un error, puedes apelar dentro de los próximos 14 días desde <b>Mi perfil → Moderación</b> o escribiendo a <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>. Una persona del equipo revisará tu apelación.</p><p>Equipo Carpetazo</p>`
    });
  };

  // Crea una sanción y aplica sus efectos, todo en la misma transacción. Un baneo manual queda pendiente de segunda aprobación.
  const createSanction = async (tx, { userId, type, reason, note = null, durationDays = null, reportId = null, caseId = null, createdById = null, automatic = false }) => {
    const pending = type === 'ban' && !automatic;
    const sanction = await tx.sanction.create({
      data: {
        userId, type, reason, note, reportId, caseId, createdById, automatic,
        status: pending ? 'pending_approval' : 'active',
        expiresAt: durationDays && type !== 'ban' ? new Date(Date.now() + durationDays * DAY) : null
      }
    });
    if (!pending && SELLING_EFFECT.includes(type)) await hideSellerFolders(tx, userId);
    await tx.moderationAudit.create({ data: { actorId: createdById, action: pending ? 'sanction.requested' : 'sanction.applied', targetType: 'user', targetId: userId, reportId, note: `${SANCTION_LABELS[type]}: ${reason}`, meta: { sanctionId: sanction.id, type, durationDays, automatic } } });
    return sanction;
  };

  // ============ Casos de estafa ============
  hooks.linkFraudCase = async (tx, report) => {
    const subjectId = report.targetOwnerId;
    let fraudCase = await tx.fraudCase.findFirst({ where: { subjectUserId: subjectId, status: { not: 'resolved' } } });
    let opened = false;
    if (!fraudCase) {
      fraudCase = await tx.fraudCase.create({ data: { shortCode: caseCode(), subjectUserId: subjectId } });
      opened = true;
      await tx.moderationAudit.create({ data: { actorId: null, action: 'case.opened', targetType: 'case', targetId: fraudCase.id, reportId: report.id, note: `Caso ${fraudCase.shortCode} abierto por un reporte de estafa` } });
    }
    await tx.report.update({ where: { id: report.id }, data: { caseId: fraudCase.id } });
    const since = new Date(Date.now() - FRAUD_WINDOW_MS);
    const recent = await tx.report.findMany({ where: { caseId: fraudCase.id, createdAt: { gte: since } }, select: { reporterId: true, reporterRole: true, targetType: true } });
    const distinct = new Set(recent.map((row) => row.reporterId)).size;
    const buyersWithOrder = new Set(recent.filter((row) => row.targetType === 'order' && row.reporterRole === 'buyer').map((row) => row.reporterId)).size;
    if (distinct >= 2 && fraudCase.priority !== 'high') await tx.fraudCase.update({ where: { id: fraudCase.id }, data: { priority: 'high' } });
    let autoSanction = null;
    if (buyersWithOrder >= 3) {
      const already = await tx.sanction.count({ where: { userId: subjectId, type: { in: ['suspend_selling', 'suspend', 'ban'] }, ...activeWhere() } });
      if (!already) {
        autoSanction = await createSanction(tx, { userId: subjectId, type: 'suspend_selling', reason: 'Pausamos tus ventas mientras revisamos varios reportes de compradores con pedido. Puedes dar tu versión en tu cuenta.', caseId: fraudCase.id, automatic: true });
        await tx.fraudCase.update({ where: { id: fraudCase.id }, data: { priority: 'high' } });
      }
    }
    return {
      caseId: fraudCase.id,
      after: async () => {
        restrictions.invalidate(subjectId);
        if (autoSanction) await mailSanction(subjectId, autoSanction);
        if (opened) await notifyStaff(`Caso de estafa ${fraudCase.shortCode}`, `Se abrió el caso de estafa ${fraudCase.shortCode}.`);
      }
    };
  };

  const caseSummary = (row, names) => ({
    id: row.id, shortCode: row.shortCode, status: row.status, priority: row.priority,
    subject: names.get(row.subjectUserId) ? { username: names.get(row.subjectUserId).username, name: names.get(row.subjectUserId).name } : null,
    responseDueAt: row.responseDueAt, responded: Boolean(row.sellerRespondedAt), resolution: row.resolution, openedAt: row.openedAt, resolvedAt: row.resolvedAt
  });

  app.get('/api/admin/cases', authenticateToken, requireStaff(1), async (req, res) => {
    try {
      const status = ['open', 'awaiting_response', 'in_review', 'resolved', 'all'].includes(req.query.status) ? req.query.status : 'active';
      const where = status === 'all' ? {} : status === 'active' ? { status: { not: 'resolved' } } : { status };
      const page = Math.max(1, Math.min(100, Number.parseInt(req.query.page, 10) || 1));
      const [rows, total] = await Promise.all([
        prisma.fraudCase.findMany({ where, orderBy: [{ priority: 'asc' }, { openedAt: 'asc' }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
        prisma.fraudCase.count({ where })
      ]);
      const names = await idsOf(rows.map((row) => row.subjectUserId));
      const counts = rows.length ? await prisma.report.groupBy({ by: ['caseId'], where: { caseId: { in: rows.map((row) => row.id) } }, _count: { _all: true } }) : [];
      const countMap = new Map(counts.map((row) => [row.caseId, row._count._all]));
      res.json({ success: true, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), cases: rows.map((row) => ({ ...caseSummary(row, names), reportCount: countMap.get(row.id) || 0 })) });
    } catch (error) {
      console.error('Error loading cases:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  app.get('/api/admin/cases/:id', authenticateToken, requireStaff(1), async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Caso no encontrado' });
      const fraudCase = await prisma.fraudCase.findUnique({ where: { id: req.params.id } });
      if (!fraudCase) return res.status(404).json({ success: false, message: 'Caso no encontrado' });
      const [subject, reports, sanctions, audit, completedOrders, otherCases, reviews] = await Promise.all([
        prisma.user.findUnique({ where: { id: fraudCase.subjectUserId }, select: { id: true, username: true, name: true, createdAt: true } }),
        prisma.report.findMany({ where: { caseId: fraudCase.id }, orderBy: { createdAt: 'asc' }, take: 100, select: { id: true, shortCode: true, targetType: true, reasonCode: true, severity: true, status: true, comment: true, extra: true, reporterRole: true, createdAt: true, reporter: { select: { username: true, createdAt: true } }, _count: { select: { evidence: true } } } }),
        prisma.sanction.findMany({ where: { userId: fraudCase.subjectUserId }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, type: true, reason: true, status: true, automatic: true, expiresAt: true, createdAt: true } }),
        prisma.moderationAudit.findMany({ where: { targetType: 'case', targetId: fraudCase.id }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, actorId: true, action: true, note: true, createdAt: true } }),
        prisma.order.count({ where: { sellerId: fraudCase.subjectUserId, status: 'completed' } }),
        prisma.fraudCase.count({ where: { subjectUserId: fraudCase.subjectUserId, id: { not: fraudCase.id } } }),
        prisma.sellerReview.aggregate({ where: { sellerId: fraudCase.subjectUserId, counts: true }, _count: { _all: true }, _avg: { rating: true } })
      ]);
      const names = await idsOf(audit.map((entry) => entry.actorId).concat(fraudCase.subjectUserId));
      const staff = req.staffLevel >= 2;
      const since = Date.now() - FRAUD_WINDOW_MS;
      const distinct30 = new Set(reports.filter((row) => row.createdAt.getTime() >= since).map((row) => row.reporter?.username || row.id)).size;
      res.json({
        success: true,
        case: {
          ...caseSummary(fraudCase, names), sellerResponse: fraudCase.sellerResponse, sellerRespondedAt: fraudCase.sellerRespondedAt, resolutionNote: fraudCase.resolutionNote,
          allowedActions: staff ? ['request_response', 'resolve'] : []
        },
        subject: subject ? { username: subject.username, name: subject.name, ageDays: Math.floor((Date.now() - subject.createdAt.getTime()) / DAY) } : null,
        indicators: {
          distinctReporters30d: distinct30,
          completedSales: completedOrders,
          reviews: reviews._count._all,
          averageRating: reviews._avg.rating,
          previousCases: otherCases,
          activeSanctions: sanctions.filter((row) => row.status === 'active').length
        },
        reports: reports.map((row) => ({ id: row.id, shortCode: row.shortCode, targetType: row.targetType, reasonCode: row.reasonCode, severity: row.severity, status: row.status, comment: row.comment, extra: row.extra, reporterRole: row.reporterRole, createdAt: row.createdAt, evidenceCount: staff ? row._count.evidence : 0, reporter: staff ? row.reporter?.username || null : null })),
        sanctions,
        timeline: audit.map((entry) => ({ id: entry.id, action: entry.action, note: entry.note, createdAt: entry.createdAt, actor: entry.actorId ? (names.get(entry.actorId)?.username || 'equipo') : 'sistema' }))
      });
    } catch (error) {
      console.error('Error loading case:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // Pide el descargo al vendedor: plazo de 72 horas (48 si hay riesgo de más víctimas)
  app.post('/api/admin/cases/:id/request-response', authenticateToken, requireStaff(2), async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Caso no encontrado' });
      const actorId = await currentUserId(req);
      const claimed = await prisma.$transaction(async (tx) => {
        const fraudCase = await tx.fraudCase.findUnique({ where: { id: req.params.id } });
        if (!fraudCase) return { missing: true };
        if (!['open', 'in_review'].includes(fraudCase.status)) return { conflict: true };
        const hours = fraudCase.priority === 'high' ? RESPONSE_HOURS_HIGH : RESPONSE_HOURS;
        const dueAt = new Date(Date.now() + hours * 60 * 60 * 1000);
        const updated = await tx.fraudCase.updateMany({ where: { id: fraudCase.id, status: fraudCase.status }, data: { status: 'awaiting_response', responseDueAt: dueAt } });
        if (updated.count === 0) return { conflict: true };
        await tx.moderationAudit.create({ data: { actorId, action: 'case.response_requested', targetType: 'case', targetId: fraudCase.id, note: `Descargo solicitado: ${hours} horas` } });
        return { fraudCase, dueAt, hours };
      });
      if (claimed.missing) return res.status(404).json({ success: false, message: 'Caso no encontrado' });
      if (claimed.conflict) return res.status(409).json({ success: false, message: 'El caso no está en un estado que permita pedir descargo' });
      const dueLabel = new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeStyle: 'short' }).format(claimed.dueAt);
      sendUserEmail(claimed.fraudCase.subjectUserId, {
        subject: 'Necesitamos tu versión de los hechos en Carpetazo',
        text: `Hola:\n\nRecibimos reportes sobre tus ventas y queremos conocer tu versión antes de decidir. Tienes hasta el ${dueLabel} para responder en Mi perfil → Moderación.\n\nSi no respondes, evaluaremos el caso con los antecedentes disponibles.\n\nEquipo Carpetazo`,
        html: `<p>Hola:</p><p>Recibimos reportes sobre tus ventas y queremos conocer tu versión antes de decidir. Tienes hasta el <b>${escapeHtml(dueLabel)}</b> para responder en <b>Mi perfil → Moderación</b>.</p><p>Si no respondes, evaluaremos el caso con los antecedentes disponibles.</p><p>Equipo Carpetazo</p>`
      }).catch(() => {});
      res.json({ success: true, responseDueAt: claimed.dueAt });
    } catch (error) {
      console.error('Error requesting response:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // Resolver: descartar, advertir, restringir ventas, suspender o escalar (a autoridades, fuera del sistema)
  app.post('/api/admin/cases/:id/resolve', authenticateToken, requireStaff(2), async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Caso no encontrado' });
      const resolution = req.body?.resolution;
      if (!Object.prototype.hasOwnProperty.call(CASE_RESOLUTIONS, resolution)) return badRequest(res, 'Resolución inválida');
      if (!textOk(req.body?.note, 5, 1000)) return badRequest(res, 'Escribe el motivo de la decisión (mínimo 5 caracteres)');
      const note = cleanText(req.body.note, 1000);
      const publicMessage = req.body?.publicMessage === undefined || req.body?.publicMessage === null ? '' : (textOk(req.body.publicMessage, 0, 500) ? cleanText(req.body.publicMessage, 500) : null);
      if (publicMessage === null) return badRequest(res, 'Mensaje inválido');
      const sanctionType = CASE_RESOLUTIONS[resolution];
      const durationDays = req.body?.durationDays === undefined || req.body?.durationDays === null ? null : Number(req.body.durationDays);
      if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > MAX_DAYS)) return badRequest(res, 'Duración inválida');
      if (sanctionType && sanctionType !== 'warning' && req.staffLevel < 3 && (!durationDays || durationDays > MODERATOR_MAX_DAYS)) return badRequest(res, `Un moderador puede aplicar hasta ${MODERATOR_MAX_DAYS} días; define una duración`);
      const actorId = await currentUserId(req);

      const out = await prisma.$transaction(async (tx) => {
        const fraudCase = await tx.fraudCase.findUnique({ where: { id: req.params.id } });
        if (!fraudCase) return { missing: true };
        const claimed = await tx.fraudCase.updateMany({ where: { id: fraudCase.id, status: { not: 'resolved' } }, data: { status: 'resolved', resolution, resolutionNote: note, resolvedById: actorId, resolvedAt: new Date() } });
        if (claimed.count === 0) return { conflict: true };
        let sanction = null;
        const reportsStatus = resolution === 'dismissed' ? 'dismissed' : 'actioned';
        await tx.report.updateMany({ where: { caseId: fraudCase.id, status: 'open' }, data: { status: reportsStatus, decision: resolution === 'dismissed' ? 'dismiss' : 'sanction', decisionNote: note, decidedById: actorId, decidedAt: new Date() } });
        // Se levanta la pausa cautelar automática si había una; luego se aplica la sanción elegida
        const automatic = await tx.sanction.findMany({ where: { caseId: fraudCase.id, automatic: true, status: 'active' }, select: { id: true } });
        if (automatic.length) {
          await tx.sanction.updateMany({ where: { id: { in: automatic.map((row) => row.id) } }, data: { status: 'revoked', revokedById: actorId, revokedAt: new Date(), revokeNote: 'Reemplazada por la decisión del caso' } });
          await restoreSellerFolders(tx, fraudCase.subjectUserId);
        }
        if (sanctionType) {
          sanction = await createSanction(tx, { userId: fraudCase.subjectUserId, type: sanctionType, reason: publicMessage || `Resolución del caso ${fraudCase.shortCode}`, note, durationDays: sanctionType === 'warning' ? null : durationDays, caseId: fraudCase.id, createdById: actorId });
        }
        await tx.moderationAudit.create({ data: { actorId, action: `case.${resolution}`, targetType: 'case', targetId: fraudCase.id, note, meta: { sanctionId: sanction?.id || null } } });
        return { fraudCase, sanction };
      });
      if (out.missing) return res.status(404).json({ success: false, message: 'Caso no encontrado' });
      if (out.conflict) return res.status(409).json({ success: false, message: 'Este caso ya fue resuelto' });
      restrictions.invalidate(out.fraudCase.subjectUserId);
      if (out.sanction) mailSanction(out.fraudCase.subjectUserId, out.sanction, publicMessage).catch(() => {});
      res.json({ success: true });
    } catch (error) {
      console.error('Error resolving case:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // Descargo del vendedor investigado
  app.post('/api/me/cases/:id/response', authenticateToken, async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Caso no encontrado' });
      const userId = await currentUserId(req);
      if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      if (!textOk(req.body?.text, 20, 2000)) return badRequest(res, 'Cuéntanos tu versión (entre 20 y 2000 caracteres)');
      const text = cleanText(req.body.text, 2000);
      const updated = await prisma.$transaction(async (tx) => {
        const claimed = await tx.fraudCase.updateMany({ where: { id: req.params.id, subjectUserId: userId, status: 'awaiting_response', sellerRespondedAt: null }, data: { sellerResponse: text, sellerRespondedAt: new Date(), status: 'in_review' } });
        if (claimed.count === 0) return false;
        await tx.moderationAudit.create({ data: { actorId: userId, action: 'case.seller_response', targetType: 'case', targetId: req.params.id, note: 'El vendedor envió su descargo' } });
        return true;
      });
      if (!updated) return res.status(404).json({ success: false, message: 'Caso no encontrado o ya respondido' });
      notifyStaff('Descargo recibido en un caso de estafa', 'Un vendedor respondió a un caso de estafa.').catch(() => {});
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving case response:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // ============ Sanciones ============
  const sanctionRow = (row, names) => ({
    id: row.id, type: row.type, typeLabel: SANCTION_LABELS[row.type], reason: row.reason, note: row.note, status: row.status, automatic: row.automatic, expiresAt: row.expiresAt, createdAt: row.createdAt,
    user: names.get(row.userId) ? { username: names.get(row.userId).username, name: names.get(row.userId).name } : null,
    createdBy: names.get(row.createdById)?.username || (row.automatic ? 'sistema' : null),
    approvedBy: names.get(row.approvedById)?.username || null
  });

  app.get('/api/admin/sanctions', authenticateToken, requireStaff(1), async (req, res) => {
    try {
      const status = ['active', 'pending_approval', 'revoked', 'expired'].includes(req.query.status) ? req.query.status : 'active';
      const rows = await prisma.sanction.findMany({ where: { status }, orderBy: { createdAt: 'desc' }, take: 100 });
      const names = await idsOf(rows.flatMap((row) => [row.userId, row.createdById, row.approvedById]));
      res.json({ success: true, sanctions: rows.map((row) => sanctionRow(row, names)) });
    } catch (error) {
      console.error('Error loading sanctions:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  app.get('/api/admin/users/:username/moderation', authenticateToken, requireStaff(1), async (req, res) => {
    try {
      const user = await findUserByUsername(req.params.username);
      if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      const [sanctions, received, made, cases, appeals, sales, purchases] = await Promise.all([
        prisma.sanction.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
        prisma.report.groupBy({ by: ['status'], where: { targetOwnerId: user.id }, _count: { _all: true } }),
        prisma.report.groupBy({ by: ['status'], where: { reporterId: user.id }, _count: { _all: true } }),
        prisma.fraudCase.findMany({ where: { subjectUserId: user.id }, orderBy: { openedAt: 'desc' }, take: 20 }),
        prisma.appeal.count({ where: { userId: user.id } }),
        prisma.order.count({ where: { sellerId: user.id, status: 'completed' } }),
        prisma.order.count({ where: { buyerId: user.id, status: 'completed' } })
      ]);
      const names = await idsOf(sanctions.flatMap((row) => [row.userId, row.createdById, row.approvedById]).concat(user.id));
      const asCounts = (groups) => Object.fromEntries(groups.map((group) => [group.status, group._count._all]));
      res.json({
        success: true,
        user: { username: user.username, name: user.name, role: user.role, ageDays: Math.floor((Date.now() - user.createdAt.getTime()) / DAY) },
        stats: { completedSales: sales, completedPurchases: purchases, appeals },
        reportsReceived: asCounts(received), reportsMade: asCounts(made),
        sanctions: sanctions.map((row) => sanctionRow(row, names)),
        cases: cases.map((row) => ({ id: row.id, shortCode: row.shortCode, status: row.status, resolution: row.resolution, openedAt: row.openedAt }))
      });
    } catch (error) {
      console.error('Error loading user moderation:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  app.post('/api/admin/users/:username/sanctions', authenticateToken, requireStaff(2), async (req, res) => {
    try {
      const target = await findUserByUsername(req.params.username);
      if (!target || target.role === 'deleted') return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      const actorId = await currentUserId(req);
      if (target.id === actorId) return badRequest(res, 'No puedes aplicarte una medida a ti mismo');
      if (['admin', 'moderator', 'support'].includes(target.role)) return res.status(403).json({ success: false, message: 'No se aplican medidas a integrantes del equipo desde aquí' });
      const type = req.body?.type;
      if (!SANCTION_TYPES.includes(type)) return badRequest(res, 'Tipo de medida inválido');
      if (!textOk(req.body?.reason, 5, 300)) return badRequest(res, 'Escribe el motivo que verá la persona (entre 5 y 300 caracteres)');
      const note = req.body?.note === undefined || req.body?.note === null ? null : (textOk(req.body.note, 0, 1000) ? cleanText(req.body.note, 1000) || null : false);
      if (note === false) return badRequest(res, 'Nota inválida');
      const publicMessage = req.body?.publicMessage === undefined || req.body?.publicMessage === null ? '' : (textOk(req.body.publicMessage, 0, 500) ? cleanText(req.body.publicMessage, 500) : null);
      if (publicMessage === null) return badRequest(res, 'Mensaje inválido');
      const durationDays = req.body?.durationDays === undefined || req.body?.durationDays === null ? null : Number(req.body.durationDays);
      if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > MAX_DAYS)) return badRequest(res, 'Duración inválida');
      // Permisos: el baneo es solo de administradores y requiere la aprobación de otro; un moderador llega hasta suspensión por 30 días
      if (type === 'ban' && req.staffLevel < 3) return res.status(403).json({ success: false, message: 'Solo un administrador puede cerrar una cuenta' });
      if (type !== 'warning' && type !== 'ban' && req.staffLevel < 3 && (!durationDays || durationDays > MODERATOR_MAX_DAYS)) return badRequest(res, `Un moderador puede aplicar hasta ${MODERATOR_MAX_DAYS} días; define una duración`);
      const reportId = typeof req.body?.reportId === 'string' && isUuid(req.body.reportId) ? req.body.reportId : null;

      const sanction = await prisma.$transaction(async (tx) => {
        const created = await createSanction(tx, { userId: target.id, type, reason: cleanText(req.body.reason, 300), note, durationDays: type === 'warning' ? null : durationDays, reportId, createdById: actorId });
        if (reportId && created.status === 'active') {
          await tx.report.updateMany({ where: { id: reportId, targetOwnerId: target.id, status: 'open' }, data: { status: 'actioned', decision: 'sanction', decisionNote: note, decidedById: actorId, decidedAt: new Date() } });
        }
        return created;
      });
      restrictions.invalidate(target.id);
      if (sanction.status === 'active') mailSanction(target.id, sanction, publicMessage).catch(() => {});
      res.status(201).json({ success: true, sanctionId: sanction.id, status: sanction.status });
    } catch (error) {
      console.error('Error applying sanction:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // Segunda aprobación del cierre de una cuenta: debe ser otro administrador
  app.post('/api/admin/sanctions/:id/approve', authenticateToken, requireStaff(3), async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Medida no encontrada' });
      const actorId = await currentUserId(req);
      const out = await prisma.$transaction(async (tx) => {
        const sanction = await tx.sanction.findUnique({ where: { id: req.params.id } });
        if (!sanction) return { missing: true };
        if (sanction.status !== 'pending_approval') return { conflict: true };
        if (sanction.createdById === actorId) return { same: true };
        const claimed = await tx.sanction.updateMany({ where: { id: sanction.id, status: 'pending_approval' }, data: { status: 'active', approvedById: actorId } });
        if (claimed.count === 0) return { conflict: true };
        await hideSellerFolders(tx, sanction.userId);
        await tx.moderationAudit.create({ data: { actorId, action: 'sanction.approved', targetType: 'user', targetId: sanction.userId, note: `${SANCTION_LABELS[sanction.type]} aprobada`, meta: { sanctionId: sanction.id } } });
        return { sanction };
      });
      if (out.missing) return res.status(404).json({ success: false, message: 'Medida no encontrada' });
      if (out.conflict) return res.status(409).json({ success: false, message: 'Esta medida ya no está pendiente' });
      if (out.same) return res.status(403).json({ success: false, message: 'La aprobación debe hacerla otro administrador' });
      restrictions.invalidate(out.sanction.userId);
      mailSanction(out.sanction.userId, { ...out.sanction, status: 'active' }).catch(() => {});
      res.json({ success: true });
    } catch (error) {
      console.error('Error approving sanction:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  const revokeSanction = async (tx, sanction, actorId, note) => {
    const claimed = await tx.sanction.updateMany({ where: { id: sanction.id, status: { in: ['active', 'pending_approval'] } }, data: { status: 'revoked', revokedById: actorId, revokedAt: new Date(), revokeNote: note } });
    if (claimed.count === 0) return false;
    if (SELLING_EFFECT.includes(sanction.type)) await restoreSellerFolders(tx, sanction.userId);
    await tx.moderationAudit.create({ data: { actorId, action: 'sanction.revoked', targetType: 'user', targetId: sanction.userId, note: `${SANCTION_LABELS[sanction.type]} levantada: ${note}`, meta: { sanctionId: sanction.id } } });
    return true;
  };

  app.post('/api/admin/sanctions/:id/revoke', authenticateToken, requireStaff(3), async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Medida no encontrada' });
      if (!textOk(req.body?.note, 5, 500)) return badRequest(res, 'Escribe el motivo (mínimo 5 caracteres)');
      const actorId = await currentUserId(req);
      const sanction = await prisma.sanction.findUnique({ where: { id: req.params.id } });
      if (!sanction) return res.status(404).json({ success: false, message: 'Medida no encontrada' });
      const done = await prisma.$transaction((tx) => revokeSanction(tx, sanction, actorId, cleanText(req.body.note, 500)));
      if (!done) return res.status(409).json({ success: false, message: 'Esta medida ya no está vigente' });
      restrictions.invalidate(sanction.userId);
      sendUserEmail(sanction.userId, { subject: 'Levantamos una medida sobre tu cuenta', text: `Hola:\n\nLevantamos la medida "${SANCTION_LABELS[sanction.type]}" de tu cuenta de Carpetazo.\n\nEquipo Carpetazo`, html: `<p>Hola:</p><p>Levantamos la medida <b>${escapeHtml(SANCTION_LABELS[sanction.type])}</b> de tu cuenta de Carpetazo.</p><p>Equipo Carpetazo</p>` }).catch(() => {});
      res.json({ success: true });
    } catch (error) {
      console.error('Error revoking sanction:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // Vencimiento automático de medidas temporales (y vuelta de las carpetas ocultas por una suspensión de ventas)
  const expireSanctions = async () => {
    try {
      const due = await prisma.sanction.findMany({ where: { status: 'active', expiresAt: { lte: new Date() } } });
      for (const sanction of due) {
        await prisma.$transaction(async (tx) => {
          const claimed = await tx.sanction.updateMany({ where: { id: sanction.id, status: 'active' }, data: { status: 'expired' } });
          if (claimed.count === 0) return;
          if (SELLING_EFFECT.includes(sanction.type)) await restoreSellerFolders(tx, sanction.userId);
          await tx.moderationAudit.create({ data: { actorId: null, action: 'sanction.expired', targetType: 'user', targetId: sanction.userId, note: `${SANCTION_LABELS[sanction.type]} venció`, meta: { sanctionId: sanction.id } } });
        });
        restrictions.invalidate(sanction.userId);
      }
    } catch (error) {
      console.error('Error expiring sanctions:', error.message);
    }
  };
  setInterval(expireSanctions, 10 * 60 * 1000).unref();
  setTimeout(expireSanctions, 15 * 1000).unref();

  // ============ Roles del equipo ============
  app.post('/api/admin/users/:username/role', authenticateToken, requireStaff(3), async (req, res) => {
    try {
      const target = await findUserByUsername(req.params.username);
      if (!target || target.role === 'deleted') return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      const role = req.body?.role;
      if (!['moderator', 'support', 'user'].includes(role)) return badRequest(res, 'Rol inválido');
      if (target.role === 'admin') return res.status(403).json({ success: false, message: 'El rol de un administrador no se cambia desde aquí' });
      const actorId = await currentUserId(req);
      await prisma.$transaction([
        prisma.user.update({ where: { id: target.id }, data: { role } }),
        prisma.moderationAudit.create({ data: { actorId, action: 'role.changed', targetType: 'user', targetId: target.id, note: `Rol de @${target.username}: ${target.role} → ${role}` } })
      ]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error changing role:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // ============ Lo que ve la persona sobre sí misma ============
  app.get('/api/me/moderation', authenticateToken, async (req, res) => {
    try {
      const userId = await currentUserId(req);
      if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      const since = new Date(Date.now() - 90 * DAY);
      const [sanctions, actions, cases, appeals] = await Promise.all([
        prisma.sanction.findMany({ where: { userId, status: { in: ['active', 'expired', 'revoked'] }, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 20 }),
        prisma.report.findMany({ where: { targetOwnerId: userId, status: 'actioned', decidedAt: { gte: since }, decision: { in: ['hide', 'remove'] } }, orderBy: { decidedAt: 'desc' }, take: 20, select: { id: true, targetType: true, reasonCode: true, decision: true, decidedAt: true } }),
        prisma.fraudCase.findMany({ where: { subjectUserId: userId, status: { in: ['awaiting_response', 'in_review'] } }, select: { id: true, shortCode: true, status: true, responseDueAt: true, sellerRespondedAt: true } }),
        prisma.appeal.findMany({ where: { userId }, select: { sanctionId: true, reportId: true, status: true } })
      ]);
      const appealBySanction = new Map(appeals.filter((row) => row.sanctionId).map((row) => [row.sanctionId, row.status]));
      const appealByReport = new Map(appeals.filter((row) => row.reportId).map((row) => [row.reportId, row.status]));
      const within = (date) => Date.now() - date.getTime() <= APPEAL_WINDOW_MS;
      res.json({
        success: true,
        restrictions: [...(await restrictions.restrictionsFor(userId))],
        sanctions: sanctions.map((row) => ({ id: row.id, type: row.type, typeLabel: SANCTION_LABELS[row.type], reason: row.reason, status: row.status, expiresAt: row.expiresAt, createdAt: row.createdAt, appealStatus: appealBySanction.get(row.id) || null, canAppeal: row.status === 'active' && row.type !== 'warning' && !appealBySanction.has(row.id) && within(row.createdAt) })),
        actions: actions.map((row) => ({ id: row.id, targetType: row.targetType, object: deps.targetLabel(row.targetType), reasonCode: row.reasonCode, reason: deps.reasonLabel(row.targetType, row.reasonCode), decision: row.decision, decidedAt: row.decidedAt, appealStatus: appealByReport.get(row.id) || null, canAppeal: !appealByReport.has(row.id) && within(row.decidedAt) })),
        cases: cases.map((row) => ({ id: row.id, shortCode: row.shortCode, status: row.status, responseDueAt: row.responseDueAt, canRespond: row.status === 'awaiting_response' && !row.sellerRespondedAt, responded: Boolean(row.sellerRespondedAt) }))
      });
    } catch (error) {
      console.error('Error loading own moderation:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // Para reportar un pedido por su código: solo lo encuentra quien participa (comprador con cuenta o vendedor)
  app.get('/api/me/orders/:code', authenticateToken, async (req, res) => {
    try {
      const userId = await currentUserId(req);
      if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      const code = typeof req.params.code === 'string' ? req.params.code.trim().toUpperCase() : '';
      if (!/^[A-Z0-9-]{3,20}$/.test(code)) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
      const order = await prisma.order.findUnique({ where: { code }, select: { id: true, code: true, folderName: true, buyerId: true, sellerId: true, status: true, createdAt: true } });
      const role = order && order.buyerId === userId ? 'buyer' : order && order.sellerId === userId && order.buyerId ? 'seller' : null;
      if (!role) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
      res.json({ success: true, order: { id: order.id, code: order.code, folderName: order.folderName, status: order.status, createdAt: order.createdAt, role } });
    } catch (error) {
      console.error('Error finding order by code:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // ============ Apelaciones ============
  app.post('/api/appeals', authenticateToken, async (req, res) => {
    try {
      const userId = await currentUserId(req);
      if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      const { sanctionId, reportId } = req.body || {};
      if ((typeof sanctionId === 'string') === (typeof reportId === 'string')) return badRequest(res, 'Indica qué medida quieres apelar');
      if (!textOk(req.body?.text, 20, 1000)) return badRequest(res, 'Cuéntanos por qué crees que fue un error (entre 20 y 1000 caracteres)');
      const text = cleanText(req.body.text, 1000);
      let data;
      if (typeof sanctionId === 'string') {
        if (!isUuid(sanctionId)) return res.status(404).json({ success: false, message: 'Medida no encontrada' });
        const sanction = await prisma.sanction.findFirst({ where: { id: sanctionId, userId, status: 'active', type: { not: 'warning' } } });
        if (!sanction) return res.status(404).json({ success: false, message: 'Medida no encontrada' });
        if (Date.now() - sanction.createdAt.getTime() > APPEAL_WINDOW_MS) return res.status(409).json({ success: false, message: 'Pasaron más de 14 días desde la medida' });
        data = { userId, sanctionId, text };
      } else {
        if (!isUuid(reportId)) return res.status(404).json({ success: false, message: 'Medida no encontrada' });
        const report = await prisma.report.findFirst({ where: { id: reportId, targetOwnerId: userId, status: 'actioned', decision: { in: ['hide', 'remove'] } }, select: { id: true, decidedAt: true } });
        if (!report) return res.status(404).json({ success: false, message: 'Medida no encontrada' });
        if (!report.decidedAt || Date.now() - report.decidedAt.getTime() > APPEAL_WINDOW_MS) return res.status(409).json({ success: false, message: 'Pasaron más de 14 días desde la medida' });
        data = { userId, reportId, text };
      }
      try {
        await prisma.$transaction([
          prisma.appeal.create({ data }),
          prisma.moderationAudit.create({ data: { actorId: userId, action: 'appeal.created', targetType: 'user', targetId: userId, reportId: data.reportId || null, note: 'La persona apeló una medida' } })
        ]);
      } catch (error) {
        if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Ya enviaste una apelación por esta medida' });
        throw error;
      }
      notifyStaff('Nueva apelación en Carpetazo', 'Una persona apeló una medida de moderación.').catch(() => {});
      res.status(201).json({ success: true });
    } catch (error) {
      console.error('Error creating appeal:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  app.get('/api/admin/appeals', authenticateToken, requireStaff(1), async (req, res) => {
    try {
      const status = ['open', 'accepted', 'rejected'].includes(req.query.status) ? req.query.status : 'open';
      const rows = await prisma.appeal.findMany({ where: { status }, orderBy: { createdAt: 'asc' }, take: 100, include: { sanction: { select: { id: true, type: true, reason: true, createdById: true, createdAt: true } } } });
      const names = await idsOf(rows.map((row) => row.userId));
      const reportIds = rows.map((row) => row.reportId).filter(Boolean);
      const reports = reportIds.length ? await prisma.report.findMany({ where: { id: { in: reportIds } }, select: { id: true, shortCode: true, targetType: true, reasonCode: true, decision: true, decisionNote: true, decidedById: true } }) : [];
      const reportMap = new Map(reports.map((row) => [row.id, row]));
      res.json({
        success: true,
        appeals: rows.map((row) => ({
          id: row.id, status: row.status, text: row.text, createdAt: row.createdAt, decisionNote: row.decisionNote, decidedAt: row.decidedAt,
          user: names.get(row.userId) ? { username: names.get(row.userId).username, name: names.get(row.userId).name } : null,
          sanction: row.sanction ? { type: row.sanction.type, typeLabel: SANCTION_LABELS[row.sanction.type], reason: row.sanction.reason } : null,
          report: reportMap.get(row.reportId) ? { shortCode: reportMap.get(row.reportId).shortCode, object: deps.targetLabel(reportMap.get(row.reportId).targetType), reason: deps.reasonLabel(reportMap.get(row.reportId).targetType, reportMap.get(row.reportId).reasonCode), decisionNote: reportMap.get(row.reportId).decisionNote } : null
        }))
      });
    } catch (error) {
      console.error('Error loading appeals:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // Decide un administrador distinto de quien tomó la medida; si no hay otro administrador, se permite y queda anotado
  app.post('/api/admin/appeals/:id/decision', authenticateToken, requireStaff(3), async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Apelación no encontrada' });
      const action = req.body?.action;
      if (!['accept', 'reject'].includes(action)) return badRequest(res, 'Acción inválida');
      if (!textOk(req.body?.note, 5, 1000)) return badRequest(res, 'Escribe el motivo (mínimo 5 caracteres)');
      const note = cleanText(req.body.note, 1000);
      const actorId = await currentUserId(req);
      const appeal = await prisma.appeal.findUnique({ where: { id: req.params.id }, include: { sanction: true } });
      if (!appeal) return res.status(404).json({ success: false, message: 'Apelación no encontrada' });
      if (appeal.status !== 'open') return res.status(409).json({ success: false, message: 'Esta apelación ya fue decidida' });
      const report = appeal.reportId ? await prisma.report.findUnique({ where: { id: appeal.reportId } }) : null;
      const originalDecider = appeal.sanction?.createdById || report?.decidedById || null;
      let selfReview = false;
      if (originalDecider && originalDecider === actorId) {
        const others = await prisma.user.count({ where: { role: 'admin', id: { notIn: [actorId] } } });
        if (others > 0) return res.status(403).json({ success: false, message: 'La apelación debe revisarla otra persona distinta de quien tomó la medida' });
        selfReview = true;
      }
      const out = await prisma.$transaction(async (tx) => {
        const claimed = await tx.appeal.updateMany({ where: { id: appeal.id, status: 'open' }, data: { status: action === 'accept' ? 'accepted' : 'rejected', decidedById: actorId, decisionNote: note, decidedAt: new Date() } });
        if (claimed.count === 0) return { conflict: true };
        if (action === 'accept') {
          if (appeal.sanction) await revokeSanction(tx, appeal.sanction, actorId, `Apelación aceptada: ${note}`);
          if (report) {
            const restored = await applyRestore(tx, report);
            if (!restored.ok) throw Object.assign(new Error(restored.message), { userMessage: restored.message });
            await tx.report.updateMany({ where: { targetType: report.targetType, targetId: report.targetId }, data: { status: 'dismissed', decision: 'restore', decisionNote: `Apelación aceptada: ${note}`, decidedById: actorId, decidedAt: new Date() } });
          }
        }
        await tx.moderationAudit.create({ data: { actorId, action: `appeal.${action === 'accept' ? 'accepted' : 'rejected'}`, targetType: 'user', targetId: appeal.userId, reportId: appeal.reportId, note: selfReview ? `${note} (sin segundo revisor disponible)` : note, meta: { appealId: appeal.id } } });
        return { ok: true };
      });
      if (out.conflict) return res.status(409).json({ success: false, message: 'Esta apelación ya fue decidida' });
      restrictions.invalidate(appeal.userId);
      const accepted = action === 'accept';
      sendUserEmail(appeal.userId, {
        subject: accepted ? 'Aceptamos tu apelación en Carpetazo' : 'Revisamos tu apelación en Carpetazo',
        text: `Hola:\n\n${accepted ? 'Aceptamos tu apelación y revertimos la medida.' : 'Revisamos tu apelación y mantenemos la decisión.'}\n\n${note}\n\nEquipo Carpetazo`,
        html: `<p>Hola:</p><p>${accepted ? 'Aceptamos tu apelación y revertimos la medida.' : 'Revisamos tu apelación y mantenemos la decisión.'}</p><p>${escapeHtml(note)}</p><p>Equipo Carpetazo</p>`
      }).catch(() => {});
      res.json({ success: true, selfReview });
    } catch (error) {
      if (error.userMessage) return res.status(409).json({ success: false, message: error.userMessage });
      console.error('Error deciding appeal:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // ============ Bloqueo entre usuarios ============
  app.get('/api/blocks', authenticateToken, async (req, res) => {
    try {
      const userId = await currentUserId(req);
      if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      const rows = await prisma.userBlock.findMany({ where: { blockerId: userId }, orderBy: { createdAt: 'desc' }, take: BLOCKS_MAX });
      const names = await idsOf(rows.map((row) => row.blockedId));
      res.json({ success: true, blocks: rows.map((row) => ({ userId: row.blockedId, username: names.get(row.blockedId)?.username || null, name: names.get(row.blockedId)?.name || null, createdAt: row.createdAt })) });
    } catch (error) {
      console.error('Error loading blocks:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  app.post('/api/blocks', authenticateToken, async (req, res) => {
    try {
      const userId = await currentUserId(req);
      if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      const blockedId = req.body?.userId;
      if (typeof blockedId !== 'string' || !isUuid(blockedId)) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      if (blockedId === userId) return badRequest(res, 'No puedes bloquearte a ti mismo');
      const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true, role: true } });
      if (!target || target.role === 'deleted') return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      if (await prisma.userBlock.count({ where: { blockerId: userId } }) >= BLOCKS_MAX) return res.status(409).json({ success: false, message: 'Llegaste al máximo de personas bloqueadas' });
      await prisma.userBlock.createMany({ data: [{ blockerId: userId, blockedId }], skipDuplicates: true });
      res.status(201).json({ success: true });
    } catch (error) {
      console.error('Error blocking user:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  app.delete('/api/blocks/:userId', authenticateToken, async (req, res) => {
    try {
      const userId = await currentUserId(req);
      if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      if (!isUuid(req.params.userId)) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      await prisma.userBlock.deleteMany({ where: { blockerId: userId, blockedId: req.params.userId } });
      res.json({ success: true });
    } catch (error) {
      console.error('Error unblocking user:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // ============ Evidencias privadas ============
  const evidenceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: EVIDENCE_BYTES, files: 1 } }).single('image');

  app.post('/api/reports/:id/evidence', authenticateToken, (req, res, next) => {
    evidenceUpload(req, res, (error) => {
      if (error) return res.status(400).json({ success: false, message: 'La imagen es demasiado grande (máximo 5 MB) o no es válida' });
      next();
    });
  }, async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Reporte no encontrado' });
      const userId = await currentUserId(req);
      if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      const report = await prisma.report.findFirst({ where: { id: req.params.id, reporterId: userId, status: 'open', createdAt: { gte: new Date(Date.now() - DAY) } }, select: { id: true } });
      if (!report) return res.status(404).json({ success: false, message: 'Reporte no encontrado' });
      if (!req.file?.buffer?.length) return badRequest(res, 'Falta la imagen');
      let output;
      try {
        const image = sharp(req.file.buffer, { limitInputPixels: 40_000_000 });
        const meta = await image.metadata();
        if (!['jpeg', 'png', 'webp'].includes(meta.format)) return badRequest(res, 'Usa una imagen JPG, PNG o WebP');
        // Se vuelve a codificar: se pierde el EXIF (ubicación, cámara) y no queda nada ejecutable
        output = await image.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      } catch (_error) {
        return badRequest(res, 'Usa una imagen JPG, PNG o WebP');
      }
      const saved = await prisma.$transaction(async (tx) => {
        const count = await tx.evidence.count({ where: { reportId: report.id } });
        if (count >= EVIDENCE_MAX) return false;
        await tx.evidence.create({ data: { reportId: report.id, mime: 'image/jpeg', size: output.length, sha256: crypto.createHash('sha256').update(output).digest('hex'), data: output } });
        return true;
      });
      if (!saved) return res.status(409).json({ success: false, message: `Máximo ${EVIDENCE_MAX} imágenes por reporte` });
      res.status(201).json({ success: true });
    } catch (error) {
      console.error('Error saving evidence:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  app.get('/api/admin/evidence/:id', authenticateToken, requireStaff(2), async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Evidencia no encontrada' });
      const evidence = await prisma.evidence.findUnique({ where: { id: req.params.id } });
      if (!evidence) return res.status(404).json({ success: false, message: 'Evidencia no encontrada' });
      const actorId = await currentUserId(req);
      await prisma.moderationAudit.create({ data: { actorId, action: 'evidence.viewed', targetType: 'report', targetId: evidence.reportId, reportId: evidence.reportId, note: 'Vio una evidencia' } });
      res.set({ 'Content-Type': evidence.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' });
      res.send(Buffer.from(evidence.data));
    } catch (error) {
      console.error('Error serving evidence:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  return { createSanction, expireSanctions, mailSanction };
};
