// Cuenta y perfil: sincronizar sesión, perfil propio, nombre de usuario y perfil público.
import { Prisma } from '@prisma/client';
import express from 'express';
import { authenticateToken, isAdminEmail, optionalAuth } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { acceptedCache, getLegalStatus } from '../core/legal.js';
import { PUBLIC_SELLER_SELECT, getReviewSummary, toPublicSeller } from '../core/publicSeller.js';
import { deleteR2ObjectByPublicUrl } from '../core/r2.js';
import { SOCIAL_DOMAINS, badRequest, checkImageField, checkSocialField, hasControlChars, isAllowedStoredImageUrl, isOptionalText, isShortText, normalizeUsername, sanitizePublicTheme, validUsername } from '../core/validation.js';
import { moderationHooks, restrictions } from '../moderation/services.js';

const router = express.Router();

// Sincronizar o crear usuario en la BD al iniciar sesión
router.post('/api/users/sync', authenticateToken, async (req, res) => {
  try {
    const firebaseUid = req.user.sub;
    const email = req.user.email || '';
    if (!isOptionalText(req.body?.displayName, 100) || !isOptionalText(req.body?.username, 60)) return badRequest(res, 'Datos de usuario inválidos');
    
    let user = await prisma.user.findUnique({
      where: { firebaseUid }
    });
    
    // La misma persona con otro identificador de Firebase (cambió de método de ingreso o se recreó su cuenta de acceso):
    // si su correo está verificado y ya existe una cuenta con él, se reenlaza en vez de crear otra o fallar por correo repetido.
    if (!user && email && req.user.email_verified === true) {
      const sameEmail = await prisma.user.findUnique({ where: { email } });
      if (sameEmail && sameEmail.role !== 'deleted') {
        user = await prisma.user.update({ where: { id: sameEmail.id }, data: { firebaseUid } });
        acceptedCache.delete(sameEmail.firebaseUid);
        console.warn('Cuenta reenlazada por correo verificado: se cambió el identificador de Firebase de ' + sameEmail.id);
      }
    }

    if (!user) {
      // Si el usuario derivado del nombre ya está tomado, se agrega un número: un choque de nombres no debe dejar a nadie sin cuenta
      const chosen = validUsername(req.body.username);
      const derived = validUsername(normalizeUsername(req.body.displayName).slice(0, 20)) || `user_${firebaseUid.slice(0, 12).toLowerCase()}`;
      let username = chosen || derived;
      if (!chosen) {
        for (let attempt = 0; attempt < 8 && (await prisma.user.findUnique({ where: { username }, select: { id: true } })); attempt += 1) {
          const suffix = String(Math.floor(10 + Math.random() * 9990));
          username = derived.slice(0, 20 - suffix.length) + suffix;
        }
      }
      user = await prisma.user.create({
        data: { 
          firebaseUid, 
          email,
          name: req.body.displayName || '',
          username,
          photoURL: isAllowedStoredImageUrl(req.body.photoURL) ? req.body.photoURL : null,
          role: req.user.email_verified === true && isAdminEmail(email) ? 'admin' : 'user'
        }
      });
    } else {
      // Cuenta borrada que vuelve: debe aceptar de nuevo, pero sus aceptaciones anteriores se conservan como evidencia (anuladas, no borradas)
      if (user.role === 'deleted') await prisma.termsAcceptance.updateMany({ where: { userId: user.id, voidedAt: null }, data: { voidedAt: new Date() } });
      user = await prisma.user.update({
        where: { firebaseUid },
        data: {
          name: req.body.displayName || user.name,
          username: validUsername(req.body.username) || user.username || validUsername(normalizeUsername(user.name).slice(0, 20)) || `user_${firebaseUid.slice(0, 12).toLowerCase()}`,
          photoURL: user.photoURL || (isAllowedStoredImageUrl(req.body.photoURL) ? req.body.photoURL : null),
          ...(user.role === 'deleted' ? { role: 'user', email: email || user.email } : {}),
          ...(req.user.email_verified === true && isAdminEmail(email) && user.role !== 'admin' ? { role: 'admin' } : {})
        }
      });
    }
    
    res.json({ success: true, user, legal: await getLegalStatus(user) });
  } catch (error) {
    if (error.code === 'P2002') {
      // El correo ya existe y no se pudo comprobar que sea de la misma persona (correo sin verificar): mensaje distinto al del usuario repetido
      if (JSON.stringify(error.meta?.target || '').includes('email')) return res.status(409).json({ success: false, error: 'Ya existe una cuenta con este correo. Verifica tu correo o entra con el método con el que te registraste.' });
      return res.status(409).json({ success: false, error: 'Ese nombre de usuario ya está en uso' });
    }
    console.error('Error syncing user:', error);
    res.status(500).json({ success: false, error: 'Failed to sync user' });
  }
});

router.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid: req.user.sub }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user, legal: await getLegalStatus(user) });
  } catch (error) {
    console.error('Error fetching my profile:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

const sanitizeProfileAddresses = (addresses = []) => {
  if (!Array.isArray(addresses)) return [];

  const cleaned = addresses
    .slice(0, 10)
    .map((address = {}, index) => ({
      id: String(address.id || `address-${Date.now()}-${index}`).slice(0, 80),
      name: String(address.name || '').trim().slice(0, 80),
      region: String(address.region || '').trim().slice(0, 80),
      comuna: String(address.comuna || '').trim().slice(0, 80),
      street: String(address.street || '').trim().slice(0, 120),
      number: String(address.number || '').trim().slice(0, 30),
      floor: String(address.floor || '').trim().slice(0, 30),
      depto: String(address.depto || '').trim().slice(0, 30),
      reference: String(address.reference || '').trim().slice(0, 180),
      isDefault: Boolean(address.isDefault)
    }))
    .filter(address => address.region && address.comuna && address.street && address.number);

  const defaultIndex = cleaned.findIndex(address => address.isDefault);
  const effectiveDefaultIndex = defaultIndex >= 0 ? defaultIndex : 0;

  return cleaned.map((address, index) => ({
    ...address,
    isDefault: index === effectiveDefaultIndex
  }));
};

router.put('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const firebaseUid = req.user.sub;
    const allowedFields = [
      'name',
      'fullName',
      'username',
      'photoURL',
      'bannerBase64',
      'bannerDominantColor',
      'bannerComplementaryColor',
      'wallpaperBase64',
      'bio',
      'phone',
      'rut',
      'facebookUrl',
      'instagramUrl',
      'youtubeUrl',
      'publicTheme',
      'addresses',
      'bankDetails'
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field) && req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // Textos libres del perfil: tipo y largo acotados (el nombre no puede quedar vacío)
    const PROFILE_TEXT_LIMITS = { name: 100, fullName: 150, bio: 600, phone: 30, rut: 20, bannerDominantColor: 40, bannerComplementaryColor: 40 };
    for (const [field, max] of Object.entries(PROFILE_TEXT_LIMITS)) {
      if (updateData[field] === undefined) continue;
      const valid = field === 'name' ? isShortText(updateData[field], max) : isOptionalText(updateData[field], max);
      if (!valid || (typeof updateData[field] === 'string' && hasControlChars(updateData[field].replace(/[\r\n]/g, ' ')))) {
        return res.status(400).json({ success: false, error: 'Datos de perfil inválidos' });
      }
    }
    if (updateData.username !== undefined) {
      const username = validUsername(updateData.username);
      // Nombres antiguos que no cumplen la política se conservan mientras no se cambien
      const current = username ? null : await prisma.user.findUnique({ where: { firebaseUid }, select: { username: true } });
      if (!username && current?.username !== normalizeUsername(updateData.username)) {
        return res.status(400).json({ success: false, error: 'El usuario debe tener entre 3 y 20 caracteres: letras, números o _.' });
      }
      updateData.username = username || current.username;
    }

    // Una imagen nueva debe ser de un host permitido; la que ya estaba guardada se acepta tal cual (datos anteriores a la regla)
    const storedImages = await prisma.user.findUnique({ where: { firebaseUid }, select: { id: true, photoURL: true, bannerBase64: true, wallpaperBase64: true, moderationHidden: true } });
    for (const field of ['photoURL', 'bannerBase64', 'wallpaperBase64']) {
      if (updateData[field] !== undefined && updateData[field] !== storedImages?.[field] && !checkImageField(updateData[field])) {
        return res.status(400).json({ success: false, error: 'URL de imagen no permitida' });
      }
    }
    // Contenido retirado por moderación: no se puede volver a subir el mismo; una imagen o texto nuevo limpia el aviso
    const hiddenParts = storedImages?.moderationHidden || [];
    if (hiddenParts.length) {
      const moderated = { photo: ['profile_image', ['photoURL'], ['photoURL']], banner: ['profile_banner', ['bannerBase64'], ['bannerBase64']], wallpaper: ['profile_wallpaper', ['wallpaperBase64'], ['wallpaperBase64']], text: ['profile_text', ['name', 'bio', 'facebookUrl', 'instagramUrl', 'youtubeUrl'], ['bio', 'facebookUrl', 'instagramUrl', 'youtubeUrl']] };
      let remaining = [...hiddenParts];
      for (const part of hiddenParts) {
        const [reportType, guarded, clearing] = moderated[part] || [];
        if (!reportType) continue;
        const retired = await prisma.report.findMany({ where: { targetOwnerId: storedImages.id, targetType: reportType, status: { in: ['open', 'actioned'] } }, select: { snapshot: true } });
        for (const field of guarded) {
          const incoming = updateData[field];
          if (!incoming) continue;
          if (retired.some((row) => (row.snapshot?.value ?? row.snapshot?.[field]) === incoming)) {
            return res.status(403).json({ success: false, error: 'Este contenido fue retirado por moderación y no se puede volver a publicar' });
          }
        }
        if (clearing.some((field) => updateData[field])) remaining = remaining.filter((item) => item !== part);
      }
      if (remaining.length !== hiddenParts.length) updateData.moderationHidden = remaining;
    }
    for (const field of Object.keys(SOCIAL_DOMAINS)) {
      if (updateData[field] !== undefined && !checkSocialField(field, updateData[field])) {
        return res.status(400).json({ success: false, error: 'Enlace de red social no válido' });
      }
    }

    if (updateData.publicTheme !== undefined) {
      if (!updateData.publicTheme || typeof updateData.publicTheme !== 'object' || Array.isArray(updateData.publicTheme)) {
        return res.status(400).json({ success: false, error: 'Invalid public theme' });
      }

      updateData.publicTheme = sanitizePublicTheme(updateData.publicTheme);
    }

    if (updateData.addresses !== undefined) {
      updateData.addresses = sanitizeProfileAddresses(updateData.addresses);
    }

    if (updateData.bankDetails !== undefined) {
      updateData.bankDetails = updateData.bankDetails && typeof updateData.bankDetails === 'object' && !Array.isArray(updateData.bankDetails)
        ? {
            bank: String(updateData.bankDetails.bank || '').trim().slice(0, 80),
            accountType: String(updateData.bankDetails.accountType || '').trim().slice(0, 80),
            accountNumber: String(updateData.bankDetails.accountNumber || '').trim().slice(0, 80)
          }
        : {};
    }

    const user = await prisma.user.update({
      where: { firebaseUid },
      data: updateData
    });

    if (updateData.bio) moderationHooks.flagText?.('profile_text', user.id, updateData.bio, 'bio', null);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating profile:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'Username already in use' });
    }
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

router.delete('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const firebaseUid = req.user.sub;
    const current = await prisma.user.findUnique({ where: { firebaseUid }, select: { id: true, photoURL: true, bannerBase64: true, wallpaperBase64: true } });
    if (!current) return res.status(404).json({ success: false, error: 'User not found' });

    // Se borran los datos personales; quedan las filas anonimizadas (pedidos, reseñas y conversaciones de otras personas las referencian)
    const tag = `${Date.now()}_${firebaseUid.slice(0, 8)}`;
    const deletedMessage = JSON.stringify({ v: 1, text: 'Mensaje eliminado', imageUrl: null, imageBase64: null });
    await prisma.$transaction([
      prisma.user.update({
        where: { id: current.id },
        data: {
          role: 'deleted',
          email: `deleted_${tag}@deleted.invalid`,
          username: `deleted_${tag}`,
          name: 'Usuario Eliminado',
          fullName: null,
          photoURL: null,
          bannerBase64: null,
          wallpaperBase64: null,
          bannerDominantColor: null,
          bannerComplementaryColor: null,
          bio: null,
          phone: null,
          rut: null,
          facebookUrl: null,
          instagramUrl: null,
          youtubeUrl: null,
          publicTheme: Prisma.DbNull,
          addresses: Prisma.DbNull,
          bankDetails: Prisma.DbNull
        }
      }),
      prisma.folder.updateMany({ where: { userId: current.id }, data: { isPublic: false } }),
      prisma.wishlistItem.deleteMany({ where: { userId: current.id } }),
      prisma.message.updateMany({ where: { senderId: current.id }, data: { content: deletedMessage } }),
      prisma.order.updateMany({ where: { buyerId: current.id }, data: { buyerId: null, buyerName: 'Comprador eliminado' } })
    ]);

    // Las imágenes propias se borran de R2 (si falla no detiene la eliminación)
    await Promise.all([current.photoURL, current.bannerBase64, current.wallpaperBase64].filter(Boolean).map((url) => deleteR2ObjectByPublicUrl(url, firebaseUid)));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ success: false, error: 'Failed to delete account' });
  }
});

router.get('/api/users/username/check', authenticateToken, async (req, res) => {
  try {
    const username = validUsername(req.query.username);

    if (!username) {
      return res.status(400).json({
        success: false,
        available: false,
        message: 'El usuario debe tener entre 3 y 20 caracteres: letras, números o _.'
      });
    }

    const currentUser = await prisma.user.findUnique({
      where: { firebaseUid: req.user.sub },
      select: { id: true, username: true }
    });

    if (!currentUser) {
      return res.status(404).json({ success: false, available: false, message: 'User not found' });
    }

    if (currentUser.username === username) {
      return res.json({ success: true, available: true });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });

    res.json({ success: true, available: !existingUser });
  } catch (error) {
    console.error('Error checking username:', error);
    res.status(500).json({ success: false, available: false, message: 'Error interno' });
  }
});

// Disponibilidad de un usuario antes de registrarse (sin sesión). Solo dice si está libre: los usuarios ya son públicos (/<usuario>)
router.get('/api/users/username/available', async (req, res) => {
  try {
    const username = validUsername(req.query.username);
    if (!username) {
      return res.status(400).json({ success: false, available: false, message: 'El usuario debe tener entre 3 y 20 caracteres: letras, números o _.' });
    }
    const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    res.json({ success: true, available: !existing });
  } catch (error) {
    console.error('Error checking username availability:', error);
    res.status(500).json({ success: false, available: false, message: 'Error interno' });
  }
});

router.get('/api/users/:username', optionalAuth, async (req, res) => {
  try {
    const identifier = String(req.params.username || '').trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
    const publicUserLookup = [
      { username: identifier },
      { firebaseUid: identifier }
    ];

    if (isUuid) {
      publicUserLookup.push({ id: identifier });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: publicUserLookup,
        NOT: { role: 'deleted' }
      },
      select: {
        ...PUBLIC_SELLER_SELECT,
        folders: {
          where: { isPublic: true },
          include: {
            _count: { select: { cards: true } },
            user: { select: { name: true, username: true, photoURL: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    // Una cuenta cerrada por moderación deja de tener perfil público
    if (!user || (await restrictions.restrictionsFor(user.id)).has('ban')) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { folders, ...seller } = user;
    const publicFolders = folders.map(({ moderationState: _state, ...folder }) => folder);
    res.json({ success: true, user: { ...toPublicSeller(seller, req.user?.sub, await getReviewSummary(seller.id)), folders: publicFolders } });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
