// Versiones legales vigentes y aceptación de los Términos.
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { hashConnection, hashEmail } from '../core/hashing.js';
import { ACCEPTED_CACHE_MS, LEGAL_CURRENT, NEW_ACCOUNT_WINDOW_MS, acceptedCache, getLegalStatus } from '../core/legal.js';
import { badRequest, validUsername } from '../core/validation.js';

const router = express.Router();

router.get('/api/legal/versions', (_req, res) => {
  res.json({ success: true, ...LEGAL_CURRENT });
});

// Aceptar los textos vigentes: exige declarar 18 años o más y la versión exacta que se mostró
router.post('/api/users/me/accept-terms', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true, username: true, createdAt: true, role: true } });
    if (!user || user.role === 'deleted') return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const body = req.body || {};
    if (body.adult !== true) return badRequest(res, 'Debes confirmar que tienes 18 años o más');
    if (body.termsVersion !== LEGAL_CURRENT.termsVersion || body.privacyVersion !== LEGAL_CURRENT.privacyVersion) {
      return res.status(409).json({ success: false, code: 'terms_version_changed', message: 'Los textos se actualizaron. Recarga la página para verlos.' });
    }
    let newUsername = null;
    if (body.username !== undefined && body.username !== null) {
      const status = await getLegalStatus(user);
      if (!status.canChooseUsername) return badRequest(res, 'No puedes cambiar el usuario en este paso');
      newUsername = validUsername(body.username);
      if (!newUsername) return badRequest(res, 'El usuario debe tener entre 3 y 20 caracteres: letras, números o _.');
    }
    // Usuario nuevo y aceptación juntos: no puede quedar uno sin el otro
    await prisma.$transaction([
      ...(newUsername && newUsername !== user.username ? [prisma.user.update({ where: { id: user.id }, data: { username: newUsername } })] : []),
      prisma.termsAcceptance.create({ data: { userId: user.id, termsVersion: LEGAL_CURRENT.termsVersion, privacyVersion: LEGAL_CURRENT.privacyVersion, isAdult: true, connectionHash: hashConnection(req), method: typeof req.user.firebase?.sign_in_provider === 'string' ? req.user.firebase.sign_in_provider.slice(0, 40) : null, userAgent: String(req.headers['user-agent'] || '').slice(0, 300) || null, emailHash: req.user.email ? hashEmail(req.user.email) : null } })
    ]);
    acceptedCache.set(req.user.sub, Date.now() + ACCEPTED_CACHE_MS);
    res.json({ success: true, legal: await getLegalStatus(user) });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Ese usuario ya está en uso' });
    console.error('Error accepting terms:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// "Salir" en la pantalla de aceptación: una cuenta recién creada, sin aceptar y sin actividad, se borra por completo.
// Cualquier otra cuenta se deja intacta (solo cierra sesión en el cliente).
router.delete('/api/users/me/unaccepted', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true, createdAt: true, role: true } });
    if (!user || user.role === 'deleted') return res.json({ success: true, deleted: false });
    const [acceptances, folders, wishlist, messages, orders] = await Promise.all([
      prisma.termsAcceptance.count({ where: { userId: user.id } }),
      prisma.folder.count({ where: { userId: user.id } }),
      prisma.wishlistItem.count({ where: { userId: user.id } }),
      prisma.message.count({ where: { OR: [{ senderId: user.id }, { receiverId: user.id }] } }),
      prisma.order.count({ where: { OR: [{ sellerId: user.id }, { buyerId: user.id }] } })
    ]);
    const brandNew = Date.now() - new Date(user.createdAt).getTime() < NEW_ACCOUNT_WINDOW_MS;
    if (acceptances > 0 || !brandNew || folders + wishlist + messages + orders > 0) return res.json({ success: true, deleted: false });
    await prisma.user.delete({ where: { id: user.id } });
    acceptedCache.delete(req.user.sub);
    res.json({ success: true, deleted: true });
  } catch (error) {
    console.error('Error declining terms:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
