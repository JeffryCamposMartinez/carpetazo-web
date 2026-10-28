// Verificación de identidad. La persona envía su RUT, teléfono, el carnet por ambos lados y una foto de su rostro; Moderación revisa y aprueba o rechaza.
// Quien queda aprobado se muestra como verificado en toda la web. Las fotos van cifradas (core/identityVerification.js) y solo las ve el equipo.
import express from 'express';
import multer from 'multer';
import { authenticateToken, requireStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { routeLimiter } from '../core/limits.js';
import { badRequest, isShortText, isValidPhone, isValidRut } from '../core/validation.js';
import { IDENTITY_KINDS, IDENTITY_KIND_FIELD, MAX_ATTEMPTS_PER_DAY, identityConfigured, normalizeRut, prepareDocument, readDecrypted, storeEncrypted } from '../core/identityVerification.js';
import { cleanNotice, notifyUser } from '../core/staffNotice.js';

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PAGE = 30;
const submitLimit = routeLimiter(60 * 60 * 1000, 10);
const readLimit = routeLimiter(60 * 1000, 120);
const decisionLimit = routeLimiter(60 * 1000, 60);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 3, fields: 6, fieldSize: 200 },
  fileFilter: (_req, file, cb) => (file.mimetype?.startsWith('image/') ? cb(null, true) : cb(new Error('Sube imágenes válidas.'))),
}).fields(IDENTITY_KINDS.map((name) => ({ name, maxCount: 1 })));

const ownView = (row) => (row ? { id: row.id, status: row.status, reason: row.status === 'rejected' ? row.reason : null, createdAt: row.createdAt, reviewedAt: row.reviewedAt } : null);

// --- La persona: estado de su verificación
router.get('/api/verification/me', authenticateToken, readLimit, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true, identityVerifiedAt: true, rut: true, phone: true } });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const last = await prisma.identityVerification.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, available: identityConfigured(), verified: Boolean(user.identityVerifiedAt), verifiedAt: user.identityVerifiedAt, request: ownView(last) });
  } catch (error) {
    console.error('Error cargando la verificación:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// --- La persona: envía su solicitud
router.post('/api/verification/request', authenticateToken, submitLimit, (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) return next();
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Cada foto puede pesar hasta 8 MB.' : error.message === 'Sube imágenes válidas.' ? error.message : 'No se pudieron leer las fotos.';
    res.status(400).json({ success: false, message });
  });
}, async (req, res) => {
  try {
    if (!identityConfigured()) return res.status(503).json({ success: false, message: 'La verificación no está disponible por ahora. Intenta más tarde.' });
    const files = req.files || {};
    if (!IDENTITY_KINDS.every((kind) => files[kind]?.[0]?.buffer?.length)) return badRequest(res, 'Faltan fotos: necesitamos el carnet por delante, por detrás y una foto de tu rostro.');
    const rut = typeof req.body?.rut === 'string' ? req.body.rut.trim() : '';
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    if (!isShortText(rut, 20) || !isValidRut(rut)) return badRequest(res, 'El RUT no es válido. Revisa el número y el dígito verificador.');
    if (!isShortText(phone, 30) || !isValidPhone(phone)) return badRequest(res, 'El teléfono no es válido.');

    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true, identityVerifiedAt: true, role: true } });
    if (!user || user.role === 'deleted') return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (user.identityVerifiedAt) return res.status(409).json({ success: false, message: 'Tu identidad ya está verificada.' });
    if (await prisma.identityVerification.findFirst({ where: { userId: user.id, status: 'pending' }, select: { id: true } })) {
      return res.status(409).json({ success: false, message: 'Ya tienes una solicitud en revisión.' });
    }
    if (await prisma.identityVerification.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } } }) >= MAX_ATTEMPTS_PER_DAY) {
      return res.status(429).json({ success: false, message: 'Ya enviaste varias solicitudes hoy. Intenta de nuevo mañana.' });
    }

    // Se procesan y cifran las tres fotos antes de guardar nada en la base
    const keys = {};
    for (const kind of IDENTITY_KINDS) keys[IDENTITY_KIND_FIELD[kind]] = await storeEncrypted(user.id, await prepareDocument(files[kind][0].buffer));
    try {
      const created = await prisma.identityVerification.create({ data: { userId: user.id, rut: normalizeRut(rut), phone, ...keys } });
      res.json({ success: true, request: ownView(created) });
    } catch (error) {
      if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Ya tienes una solicitud en revisión.' }); // índice único: una pendiente por persona
      throw error;
    }
  } catch (error) {
    if (error.status === 400) return badRequest(res, error.message);
    console.error('Error enviando la verificación:', error.message);
    res.status(500).json({ success: false, message: 'No se pudo enviar la solicitud. Intenta de nuevo.' });
  }
});

// --- Moderación: cola de solicitudes
router.get('/api/admin/verifications', authenticateToken, requireStaff(2), readLimit, async (req, res) => {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
    const [rows, total] = await Promise.all([
      prisma.identityVerification.findMany({ where: { status }, orderBy: { createdAt: status === 'pending' ? 'asc' : 'desc' }, take: PAGE }),
      prisma.identityVerification.count({ where: { status } }),
    ]);
    const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.userId))] } }, select: { id: true, username: true, name: true, fullName: true, email: true, createdAt: true } });
    const byId = new Map(users.map((user) => [user.id, user]));
    // El mismo RUT en otra cuenta ya verificada, o repetido en otras solicitudes, se avisa al revisar (no se bloquea solo)
    const ruts = [...new Set(rows.map((row) => row.rut))];
    const [verifiedRut, otherRequests] = await Promise.all([
      prisma.user.findMany({ where: { identityVerifiedAt: { not: null }, rut: { in: ruts } }, select: { id: true, rut: true } }),
      prisma.identityVerification.findMany({ where: { rut: { in: ruts } }, select: { id: true, userId: true, rut: true } }),
    ]);
    res.json({
      success: true, total,
      requests: rows.map((row) => {
        const user = byId.get(row.userId);
        return {
          id: row.id, status: row.status, createdAt: row.createdAt, reviewedAt: row.reviewedAt, reason: row.reason, rut: row.rut, phone: row.phone,
          user: user ? { id: user.id, username: user.username, name: user.name, fullName: user.fullName, email: user.email, createdAt: user.createdAt } : null,
          sameRutVerified: verifiedRut.some((other) => other.rut && normalizeRut(other.rut) === row.rut && other.id !== row.userId),
          sameRutOtherAccounts: new Set(otherRequests.filter((other) => other.rut === row.rut && other.userId !== row.userId).map((other) => other.userId)).size,
        };
      }),
    });
  } catch (error) {
    console.error('Error cargando las verificaciones:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// --- Moderación: una foto, descifrada solo para quien revisa y con registro de quién la vio
router.get('/api/admin/verifications/:id/photo/:kind', authenticateToken, requireStaff(2), readLimit, async (req, res) => {
  const { id, kind } = req.params;
  if (!UUID.test(id) || !IDENTITY_KINDS.includes(kind)) return badRequest(res, 'Consulta inválida');
  try {
    const row = await prisma.identityVerification.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    const image = await readDecrypted(row[IDENTITY_KIND_FIELD[kind]]);
    await prisma.moderationAudit.create({ data: { actorId: req.dbUser.id, action: 'identity.view', targetType: 'user', targetId: row.userId, note: `Vio la foto «${kind}» de una solicitud de verificación`, meta: { verificationId: row.id } } });
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.send(image);
  } catch (error) {
    console.error('Error mostrando una foto de verificación:', error.message);
    res.status(500).json({ success: false, message: 'No se pudo mostrar la foto.' });
  }
});

const decide = (approve) => async (req, res) => {
  const { id } = req.params;
  if (!UUID.test(id)) return badRequest(res, 'Solicitud inválida');
  const reason = cleanNotice(req.body?.reason);
  if (reason === null) return badRequest(res, 'El motivo no es válido');
  if (!approve && !reason) return badRequest(res, 'Escribe el motivo del rechazo: la persona lo verá para poder corregirlo.');
  try {
    const row = await prisma.$transaction(async (tx) => {
      const current = await tx.identityVerification.findUnique({ where: { id } });
      if (!current || current.status !== 'pending') throw Object.assign(new Error('La solicitud ya fue decidida.'), { status: 409 });
      await tx.identityVerification.update({ where: { id }, data: { status: approve ? 'approved' : 'rejected', reason: reason || null, reviewedById: req.dbUser.id, reviewedAt: new Date() } });
      if (approve) await tx.user.update({ where: { id: current.userId }, data: { identityVerifiedAt: new Date(), rut: current.rut, phone: current.phone } });
      await tx.moderationAudit.create({ data: { actorId: req.dbUser.id, action: approve ? 'identity.approve' : 'identity.reject', targetType: 'user', targetId: current.userId, note: approve ? 'Verificación de identidad aprobada' : `Verificación de identidad rechazada: ${reason}`, meta: { verificationId: id } } });
      return current;
    });
    await notifyUser(approve
      ? { actorId: req.dbUser.id, targetId: row.userId, title: 'Tu identidad fue verificada', summary: 'Revisamos tus documentos y ya apareces como usuario verificado en Carpetazo.', message: reason }
      : { actorId: req.dbUser.id, targetId: row.userId, title: 'No pudimos verificar tu identidad', summary: 'Revisa el motivo en tu perfil, sección Verificación, y envía la solicitud de nuevo.', message: reason });
    res.json({ success: true });
  } catch (error) {
    if (error.status === 409) return res.status(409).json({ success: false, message: error.message });
    console.error('Error decidiendo una verificación:', error);
    res.status(500).json({ success: false, message: 'No se pudo completar la acción.' });
  }
};
router.post('/api/admin/verifications/:id/approve', authenticateToken, requireStaff(2), decisionLimit, decide(true));
router.post('/api/admin/verifications/:id/reject', authenticateToken, requireStaff(2), decisionLimit, decide(false));

export default router;
