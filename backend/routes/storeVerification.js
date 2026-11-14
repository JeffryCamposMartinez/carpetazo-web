// «Tienda verificada» (plan Tienda, bloque 7): la tienda envía la foto de su fachada con el nombre visible y, si quiere, un documento de la empresa.
// Las fotos se cifran igual que las de identidad (core/identityVerification.js) y solo las ve Moderación, que aprueba o rechaza.
import express from 'express';
import multer from 'multer';
import { authenticateToken, requireStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { PlanFeatureError, assertFeature, getEffectivePlan, sendPlanError } from '../core/entitlements.js';
import { routeLimiter } from '../core/limits.js';
import { badRequest, hasDeceptiveChars, isUuid } from '../core/validation.js';
import { identityConfigured, prepareDocument, readDecrypted, storeEncrypted } from '../core/identityVerification.js';
import { cleanNotice, notifyUser } from '../core/staffNotice.js';

const router = express.Router();
const KINDS = { facade: 'facadeKey', document: 'documentKey' };
const readLimit = routeLimiter(60 * 1000, 120);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 2, fields: 4, fieldSize: 600 },
  fileFilter: (_req, file, cb) => (file.mimetype?.startsWith('image/') ? cb(null, true) : cb(new Error('Sube imágenes válidas.'))),
}).fields([{ name: 'facade', maxCount: 1 }, { name: 'document', maxCount: 1 }]);
const ownView = (row) => (row ? { id: row.id, status: row.status, reason: row.status === 'rejected' ? row.reason : null, createdAt: row.createdAt, reviewedAt: row.reviewedAt, hasDocument: Boolean(row.documentKey) } : null);

router.get('/api/stores/me/verification', authenticateToken, readLimit, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const [profile, last] = await Promise.all([prisma.storeProfile.findUnique({ where: { userId: user.id }, select: { verifiedAt: true } }), prisma.storeVerification.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })]);
    res.json({ success: true, available: identityConfigured(), verified: Boolean(profile?.verifiedAt), request: ownView(last) });
  } catch (error) {
    console.error('Error cargando la verificación de tienda:', error.message);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.post('/api/stores/me/verification', authenticateToken, routeLimiter(60 * 60 * 1000, 6), (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) return next();
    res.status(400).json({ success: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'Cada foto puede pesar hasta 8 MB.' : 'No se pudieron leer las fotos.' });
  });
}, async (req, res) => {
  try {
    if (!identityConfigured()) return res.status(503).json({ success: false, message: 'La verificación no está disponible por ahora. Intenta más tarde.' });
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    assertFeature((await getEffectivePlan(prisma, user.id)).plan, 'storeTools');
    const facade = req.files?.facade?.[0]?.buffer;
    if (!facade?.length) return badRequest(res, 'Falta la foto de la fachada con el nombre de la tienda.');
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (note.length > 300 || /[\u0000-\u001f\u007f]/.test(note) || hasDeceptiveChars(note)) return badRequest(res, 'La nota no es válida (máximo 300 caracteres).');
    const profile = await prisma.storeProfile.findUnique({ where: { userId: user.id }, select: { verifiedAt: true } });
    if (profile?.verifiedAt) return res.status(409).json({ success: false, message: 'Tu tienda ya está verificada.' });
    if (await prisma.storeVerification.findFirst({ where: { userId: user.id, status: 'pending' }, select: { id: true } })) return res.status(409).json({ success: false, message: 'Ya tienes una solicitud en revisión.' });
    if (await prisma.storeVerification.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }) >= 3) return res.status(429).json({ success: false, message: 'Ya enviaste varias solicitudes hoy. Intenta mañana.' });
    const facadeKey = await storeEncrypted(user.id, await prepareDocument(facade));
    const doc = req.files?.document?.[0]?.buffer;
    const documentKey = doc?.length ? await storeEncrypted(user.id, await prepareDocument(doc)) : null;
    const created = await prisma.storeVerification.create({ data: { userId: user.id, facadeKey, documentKey, note } });
    res.json({ success: true, request: ownView(created) });
  } catch (error) {
    if (error instanceof PlanFeatureError) return sendPlanError(res, error);
    if (error.status === 400) return badRequest(res, error.message);
    console.error('Error enviando la verificación de tienda:', error.message);
    res.status(500).json({ success: false, message: 'No se pudo enviar la solicitud. Intenta de nuevo.' });
  }
});

// --- Moderación
router.get('/api/admin/store-verifications', authenticateToken, requireStaff(2), readLimit, async (req, res) => {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
    const rows = await prisma.storeVerification.findMany({ where: { status }, orderBy: { createdAt: status === 'pending' ? 'asc' : 'desc' }, take: 30, include: { user: { select: { id: true, username: true, name: true, email: true, storeProfile: { select: { address: true, comuna: true } } } } } });
    res.json({ success: true, requests: rows.map((r) => ({ id: r.id, status: r.status, note: r.note, reason: r.reason, createdAt: r.createdAt, reviewedAt: r.reviewedAt, hasDocument: Boolean(r.documentKey), user: { id: r.user.id, username: r.user.username, name: r.user.name, email: r.user.email, address: r.user.storeProfile?.address || '', comuna: r.user.storeProfile?.comuna || '' } })) });
  } catch (error) {
    console.error('Error cargando verificaciones de tienda:', error.message);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.get('/api/admin/store-verifications/:id/photo/:kind', authenticateToken, requireStaff(2), readLimit, async (req, res) => {
  const { id, kind } = req.params;
  if (!isUuid(id) || !KINDS[kind]) return badRequest(res, 'Consulta inválida');
  try {
    const row = await prisma.storeVerification.findUnique({ where: { id } });
    if (!row || !row[KINDS[kind]]) return res.status(404).json({ success: false, message: 'Foto no encontrada' });
    const image = await readDecrypted(row[KINDS[kind]]);
    await prisma.moderationAudit.create({ data: { actorId: req.dbUser.id, action: 'store_verification.view', targetType: 'user', targetId: row.userId, note: `Vio la foto «${kind}» de una verificación de tienda`, meta: { verificationId: row.id } } });
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.send(image);
  } catch (error) {
    console.error('Error mostrando foto de verificación de tienda:', error.message);
    res.status(500).json({ success: false, message: 'No se pudo mostrar la foto.' });
  }
});

const decide = (approve) => async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) return badRequest(res, 'Solicitud inválida');
  const reason = cleanNotice(req.body?.reason);
  if (reason === null) return badRequest(res, 'El motivo no es válido');
  if (!approve && !reason) return badRequest(res, 'Escribe el motivo del rechazo: la tienda lo verá para corregirlo.');
  try {
    const row = await prisma.$transaction(async (tx) => {
      const current = await tx.storeVerification.findUnique({ where: { id } });
      if (!current || current.status !== 'pending') throw Object.assign(new Error('La solicitud ya fue decidida.'), { status: 409 });
      await tx.storeVerification.update({ where: { id }, data: { status: approve ? 'approved' : 'rejected', reason: reason || null, reviewedById: req.dbUser.id, reviewedAt: new Date() } });
      if (approve) await tx.storeProfile.upsert({ where: { userId: current.userId }, create: { userId: current.userId, verifiedAt: new Date() }, update: { verifiedAt: new Date() } });
      await tx.moderationAudit.create({ data: { actorId: req.dbUser.id, action: approve ? 'store_verification.approve' : 'store_verification.reject', targetType: 'user', targetId: current.userId, note: approve ? 'Tienda verificada' : `Verificación de tienda rechazada: ${reason}`, meta: { verificationId: id } } });
      return current;
    });
    await notifyUser(approve
      ? { actorId: req.dbUser.id, targetId: row.userId, title: 'Tu tienda fue verificada', summary: 'Tu perfil ya muestra la insignia «Tienda verificada».', message: reason }
      : { actorId: req.dbUser.id, targetId: row.userId, title: 'No pudimos verificar tu tienda', summary: 'Revisa el motivo en Mi tienda › Verificación y envía la solicitud de nuevo.', message: reason });
    res.json({ success: true });
  } catch (error) {
    if (error.status === 409) return res.status(409).json({ success: false, message: error.message });
    console.error('Error decidiendo verificación de tienda:', error.message);
    res.status(500).json({ success: false, message: 'No se pudo completar la acción.' });
  }
};
const decisionLimit = routeLimiter(60 * 1000, 60);
router.post('/api/admin/store-verifications/:id/approve', authenticateToken, requireStaff(2), decisionLimit, decide(true));
router.post('/api/admin/store-verifications/:id/reject', authenticateToken, requireStaff(2), decisionLimit, decide(false));

export default router;
