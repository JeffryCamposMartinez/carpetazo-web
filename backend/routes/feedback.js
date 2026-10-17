// Quejas y sugerencias: cada envío queda visible para quien lo creó y para moderación.
import express from 'express';
import { authenticateToken, currentUserId, requireStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { badRequest, hasControlChars, isUuid } from '../core/validation.js';

const router = express.Router();
const KINDS = ['complaint', 'suggestion'];
const STATUSES = ['open', 'corrected', 'all'];
const TITLE_MAX = 120;
const MESSAGE_MAX = 3000;
const NOTE_MAX = 1000;
const PAGE_SIZE = 30;

const clean = (value, max) => (typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, max) : '');
const textOk = (value, max, min = 1) => typeof value === 'string' && !hasControlChars(value) && clean(value, max + 1).length >= min && clean(value, max + 1).length <= max;
const publicFeedback = (row) => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  message: row.message,
  status: row.status,
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
    if (!KINDS.includes(kind)) return badRequest(res, 'Selecciona si es una queja o una sugerencia');
    if (!textOk(req.body?.title, TITLE_MAX, 3) || !textOk(req.body?.message, MESSAGE_MAX, 10)) return badRequest(res, 'Completa un asunto y un mensaje válido');
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const row = await prisma.feedback.create({ data: { userId, kind, title, message } });
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
    const [rows, total, counts] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: status === 'open' ? { createdAt: 'asc' } : { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { user: { select: { username: true, name: true } } }
      }),
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
      const claimed = await tx.feedback.updateMany({ where: { id: req.params.id, status: 'open' }, data: { status: 'corrected', moderatorNote: note, correctedById: actorId, correctedAt: new Date() } });
      if (claimed.count !== 1) return null;
      const row = await tx.feedback.findUnique({ where: { id: req.params.id } });
      await tx.moderationAudit.create({ data: { actorId, action: 'feedback.corrected', targetType: 'feedback', targetId: req.params.id, note } });
      return row;
    });
    if (!updated) return res.status(409).json({ success: false, message: 'Esta entrada ya estaba corregida' });
    res.json({ success: true, feedback: publicFeedback(updated) });
  } catch (error) {
    console.error('Error correcting feedback:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
