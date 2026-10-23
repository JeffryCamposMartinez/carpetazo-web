// Reclamos y sugerencias: cada envío queda visible para quien lo creó y para moderación.
import express from 'express';
import { authenticateToken, currentUserId, requireStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { getEffectivePlan, lockPlanUser } from '../core/entitlements.js';
import { notifyUser } from '../core/staffNotice.js';
import { badRequest, isUuid } from '../core/validation.js';
import { getR2KeyFromPublicUrl, userR2Prefix } from '../core/r2.js';

const router = express.Router();
const KINDS = ['complaint', 'suggestion', 'support'];
const STATUSES = ['open', 'corrected', 'all'];
const TITLE_MAX = 120;
const MESSAGE_MAX = 3000;
const NOTE_MAX = 1000;
const ATTACHMENT_MAX = 3;
const PAGE_SIZE = 30;

const clean = (value, max) => (typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, max) : '');
// En mensajes se aceptan saltos de línea y tabulaciones; se bloquean los demás controles no imprimibles.
const hasDisallowedControls = (value) => /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
const textOk = (value, max, min = 1) => typeof value === 'string' && !hasDisallowedControls(value) && clean(value, max + 1).length >= min && clean(value, max + 1).length <= max;
const publicFeedback = (row) => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  message: row.message,
  attachments: Array.isArray(row.attachments) ? row.attachments : [],
  status: row.status,
  priority: Boolean(row.priority),
  moderatorNote: row.moderatorNote || null,
  correctedAt: row.correctedAt,
  createdAt: row.createdAt
});

const adminFeedback = (row) => ({
  ...publicFeedback(row),
  user: row.user ? { username: row.user.username, name: row.user.name } : null
});

router.post('/api/feedback', authenticateToken, async (req, res) => {
  try {
    const kind = req.body?.kind;
    const title = clean(req.body?.title, TITLE_MAX);
    const message = clean(req.body?.message, MESSAGE_MAX);
    if (!KINDS.includes(kind)) return badRequest(res, 'Selecciona si es un reclamo, una sugerencia o una consulta de soporte');
    if (!textOk(req.body?.title, TITLE_MAX, 3) || !textOk(req.body?.message, MESSAGE_MAX, 10)) return badRequest(res, 'Completa un asunto y un mensaje válido');
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const rawAttachments = req.body?.attachments ?? [];
    if (!Array.isArray(rawAttachments) || rawAttachments.length > ATTACHMENT_MAX || rawAttachments.some((url) => typeof url !== 'string')) return badRequest(res, `Puedes adjuntar hasta ${ATTACHMENT_MAX} imágenes`);
    const attachmentUrls = [...new Set(rawAttachments)];
    if (attachmentUrls.length !== rawAttachments.length) return badRequest(res, 'Hay imágenes repetidas');
    const ownerPrefix = userR2Prefix(req.user.sub) + 'feedback/';
    const attachments = [];
    for (const url of attachmentUrls) {
      const key = getR2KeyFromPublicUrl(url);
      if (!key || !key.startsWith(ownerPrefix) || !/^[a-f0-9]{32}\.webp$/.test(key.slice(ownerPrefix.length))) return badRequest(res, 'Una de las imágenes adjuntas no es válida');
      const scanned = await prisma.imageHash.findUnique({ where: { url }, select: { userId: true, verdict: true } });
      if (!scanned || scanned.userId !== userId || !['clear', 'review'].includes(scanned.verdict)) return badRequest(res, 'Vuelve a subir una de las imágenes para aplicar el filtro de seguridad');
      attachments.push({ url, reviewRequired: scanned.verdict === 'review' });
    }
    const row = await prisma.$transaction(async (tx) => {
      await lockPlanUser(tx, userId);
      const { plan } = await getEffectivePlan(tx, userId);
      return tx.feedback.create({ data: { userId, kind, title, message, attachments, priority: kind === 'support' && plan.prioritySupport } });
    });
    res.status(201).json({ success: true, feedback: publicFeedback(row) });
  } catch (error) {
    console.error('Error creating feedback:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.get('/api/feedback/mine', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const rows = await prisma.feedback.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ success: true, feedback: rows.map(publicFeedback) });
  } catch (error) {
    console.error('Error loading own feedback:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.get('/api/admin/feedback', authenticateToken, requireStaff(1), async (req, res) => {
  try {
    const status = STATUSES.includes(req.query.status) ? req.query.status : 'open';
    const kind = KINDS.includes(req.query.kind) ? req.query.kind : null;
    const page = Math.max(1, Math.min(100, Number.parseInt(req.query.page, 10) || 1));
    const where = { ...(status !== 'all' ? { status } : {}), ...(kind ? { kind } : {}) };
    // La prioridad se guarda al crear una consulta de soporte para conservar su lugar aunque después cambie el plan.
    const listOptions = { orderBy: status === 'open' ? { createdAt: 'asc' } : { createdAt: 'desc' }, include: { user: { select: { username: true, name: true } } } };
    const offset = (page - 1) * PAGE_SIZE;
    const listRows = async () => {
      if (status !== 'open') return prisma.feedback.findMany({ where, ...listOptions, skip: offset, take: PAGE_SIZE });
      const first = { ...where, priority: true };
      const rest = { ...where, priority: false };
      const firstCount = await prisma.feedback.count({ where: first });
      if (offset >= firstCount) return prisma.feedback.findMany({ where: rest, ...listOptions, skip: offset - firstCount, take: PAGE_SIZE });
      const head = await prisma.feedback.findMany({ where: first, ...listOptions, skip: offset, take: PAGE_SIZE });
      return head.length < PAGE_SIZE ? [...head, ...await prisma.feedback.findMany({ where: rest, ...listOptions, take: PAGE_SIZE - head.length })] : head;
    };
    const [rows, total, counts] = await Promise.all([
      listRows(),
      prisma.feedback.count({ where }),
      prisma.feedback.groupBy({ by: ['status'], where: kind ? { kind } : undefined, _count: { _all: true } })
    ]);
    res.json({
      success: true,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
      counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
      feedback: rows.map(adminFeedback)
    });
  } catch (error) {
    console.error('Error loading admin feedback:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.post('/api/admin/feedback/:id/corrected', authenticateToken, requireStaff(2), async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Entrada no encontrada' });
    const rawNote = req.body?.note;
    if (rawNote !== undefined && rawNote !== null && !textOk(rawNote, NOTE_MAX, 0)) return badRequest(res, 'Nota inválida');
    const note = rawNote === undefined || rawNote === null ? null : clean(rawNote, NOTE_MAX) || null;
    const actorId = await currentUserId(req);
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.feedback.findUnique({ where: { id: req.params.id }, select: { kind: true, status: true } });
      if (existing?.status !== 'open') return null;
      if (existing?.kind === 'support' && !note) return { missingSupportReply: true };
      const claimed = await tx.feedback.updateMany({ where: { id: req.params.id, status: 'open' }, data: { status: 'corrected', moderatorNote: note, correctedById: actorId, correctedAt: new Date() } });
      if (claimed.count !== 1) return null;
      const row = await tx.feedback.findUnique({ where: { id: req.params.id } });
      await tx.moderationAudit.create({ data: { actorId, action: 'feedback.corrected', targetType: 'feedback', targetId: req.params.id, note } });
      return row;
    });
    if (updated?.missingSupportReply) return badRequest(res, 'Escribe una respuesta antes de cerrar esta consulta de soporte');
    if (!updated) return res.status(409).json({ success: false, message: 'Esta entrada ya estaba corregida' });
    if (updated.kind === 'support') {
      await notifyUser({ actorId, targetId: updated.userId, title: 'Respondimos tu consulta de soporte', summary: 'Recibiste una respuesta a tu consulta de soporte.', message: note });
    }
    res.json({ success: true, feedback: publicFeedback(updated) });
  } catch (error) {
    console.error('Error correcting feedback:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
