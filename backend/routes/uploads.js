// Subida de imágenes de los usuarios (avatar, portada, fondo, cartas, chat, evidencias): tamaño, escaneo y R2.
import { PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { deleteR2ObjectByPublicUrl, hasR2Config, r2Client, r2TestLog, userR2Prefix } from '../core/r2.js';
import { isTrustedUploader, prepareImage } from '../moderation/imageScan.js';
import { hashBank, imageScanner, moderationHooks } from '../moderation/services.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) {
      return cb(new Error('Sube una imagen válida.'));
    }
    cb(null, true);
  }
}); // 10MB

// Solo en pruebas automáticas: qué se subió y qué se borró del R2 simulado (no existe en producción)
if (r2TestLog) router.get('/api/__test/r2-log', (_req, res) => res.json({ log: r2TestLog }));

router.post('/api/users/upload-image', authenticateToken, (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'La imagen debe pesar menos de 10 MB.' });
    }

    return res.status(400).json({ success: false, message: error.message === 'Sube una imagen válida.' ? error.message : 'No se pudo leer la imagen.' });
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se envió ninguna imagen.' });
    }

    const type = req.body.type; // 'avatar', 'banner', 'wallpaper', 'message' or 'card'
    if (!['avatar', 'banner', 'wallpaper', 'message', 'card'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Tipo de imagen inválido.' });
    }

    const isBanner = type === 'banner';
    const isWallpaper = type === 'wallpaper';
    const isMessageImage = type === 'message';
    const isCardImage = type === 'card';
    // Las imágenes del chat son privadas entre dos personas: nunca se envían a servicios externos
    const scanKind = isCardImage ? 'card' : 'profile';
    const shouldScan = !isMessageImage && imageScanner.enabled;
    const blockedMessage = 'Esta imagen no cumple las normas de Carpetazo.';

    if (!hasR2Config()) {
      return res.status(503).json({
        success: false,
        message: 'El servidor no tiene configurado R2 para guardar imágenes permanentes.',
        missingConfig: true
      });
    }

    // 1) Se decodifica una sola vez: de ahí salen la huella visual, el sha256 y la copia reducida que se escanea
    let prepared;
    try {
      prepared = await prepareImage(req.file.buffer);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.scanCode === 'format' ? 'Sube una imagen JPG, PNG, WebP o GIF.' : 'No se pudo leer la imagen.' });
    }

    // 2) Huella visual: una imagen parecida a otra ya prohibida por moderación se rechaza (gratis, sin gastar cuota)
    if (prepared.hash && (await hashBank.closestBanned(prepared.hash)) !== null) {
      prisma.moderationAudit.create({ data: { actorId: null, action: 'phash.blocked', targetType: 'user', targetId: String(req.user.sub || ''), note: 'Subida rechazada: imagen parecida a una prohibida' } }).catch(() => {});
      return res.status(400).json({ success: false, message: blockedMessage });
    }

    const uploader = await prisma.user.findUnique({
      where: { firebaseUid: req.user.sub },
      select: { id: true, createdAt: true, photoURL: true, bannerBase64: true, wallpaperBase64: true }
    });
    if (!uploader && !isMessageImage && !isCardImage) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    // 3) Veredicto ya conocido para este archivo exacto: no se vuelve a pagar un escaneo (ni por un reintento desde el móvil)
    let cachedScan = null;
    if (shouldScan) {
      const cached = await imageScanner.cachedVerdict(prepared.sha256);
      if (cached) {
        imageScanner.logEvent({ provider: 'cache', kind: scanKind, verdict: cached.verdict, fallback: false, ms: 0 });
        if (cached.verdict === 'block') return res.status(400).json({ success: false, message: blockedMessage });
        cachedScan = { verdict: 'clear', provider: cached.provider || null };
      }
    }

    // 4) Se procesa y sube a R2 mientras se escanea: la espera del escaneo queda oculta detrás de la subida.
    //    El nombre es aleatorio y la base no lo referencia hasta tener veredicto; si se rechaza, se borra.
    const objectName = crypto.randomBytes(16).toString('hex');
    const filename = userR2Prefix(req.user.sub) + type + "/" + objectName + ".webp";
    const publicUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, '') + "/" + filename;
    const forcedVerdict = process.env.TEST_AUTH_STUB === '1' ? String(req.headers['x-test-scan'] || '') || null : null;

    const storeProcessed = (async () => {
      // Tamaño máximo según dónde se muestra (sin agrandar las pequeñas) y calidad 82: misma vista, una fracción del peso.
      // rotate() aplica la orientación de la cámara (las fotos del celular ya no quedan giradas) y descarta los metadatos
      const MAX_SIDE = { avatar: 512, banner: 1920, wallpaper: 2560, message: 1600, card: 1200 };
      const processedBuffer = await sharp(req.file.buffer, { limitInputPixels: 80_000_000 }).rotate()
        .resize({ width: MAX_SIDE[type], height: MAX_SIDE[type], fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 }).toBuffer();
      let dominantColor = null;
      let complementaryColor = null;
      if (isBanner) {
        const { dominant } = await sharp(processedBuffer).stats();
        dominantColor = "rgb(" + dominant.r + ", " + dominant.g + ", " + dominant.b + ")";
        complementaryColor = "rgb(" + (255 - dominant.r) + ", " + (255 - dominant.g) + ", " + (255 - dominant.b) + ")";
      }
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filename,
        Body: processedBuffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable'
      }));
      // Copia de la portada para celular (el frontend la usa en pantallas chicas): misma URL con "_m"
      if (isBanner) {
        const phoneBuffer = await sharp(processedBuffer).resize({ width: 828, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        await r2Client.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: filename.replace(/\.webp$/, '_m.webp'),
          Body: phoneBuffer,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable'
        }));
      }
      return { dominantColor, complementaryColor };
    })();
    const scanning = cachedScan
      ? Promise.resolve(cachedScan)
      : shouldScan
        ? imageScanner.scan(prepared.scanJpeg, { kind: scanKind, force: forcedVerdict })
        : Promise.resolve({ verdict: 'unscanned', provider: null });
    const [stored, scanned] = await Promise.allSettled([storeProcessed, scanning]);
    if (stored.status === 'rejected') throw stored.reason;
    const { dominantColor, complementaryColor } = stored.value;
    const scan = scanned.status === 'fulfilled' ? scanned.value : { verdict: 'unavailable', provider: null };

    // Desde aquí el archivo ya está en R2: si no se publica, se borra para no dejarlo huérfano
    let published = false;
    try {
      if (scan.verdict === 'block') {
        // Se recuerda el archivo rechazado: reintentarlo no gasta cuota
        hashBank.remember({ url: 'blocked:' + prepared.sha256, hash: prepared.hash, sha256: prepared.sha256, verdict: 'block', provider: scan.provider }).catch(() => {});
        prisma.moderationAudit.create({ data: { actorId: null, action: 'scan.blocked', targetType: 'user', targetId: String(req.user.sub || ''), note: 'Subida rechazada por el escaneo automático (' + (scan.provider || 'sin proveedor') + ')' } }).catch(() => {});
        await deleteR2ObjectByPublicUrl(publicUrl, req.user.sub);
        return res.status(400).json({ success: false, message: blockedMessage });
      }

      // Sin servicio disponible: una cuenta con buen historial publica; una nueva o con antecedentes queda pendiente de revisión
      let hold = false;
      if (scan.verdict === 'unavailable') {
        if (!(await isTrustedUploader(prisma, uploader))) {
          if (isCardImage) {
            await deleteR2ObjectByPublicUrl(publicUrl, req.user.sub);
            return res.status(503).json({ success: false, message: 'No pudimos revisar tu imagen en este momento. Intenta de nuevo en unos minutos.' });
          }
          hold = true;
        }
      }

      const updateData = isBanner
        ? { bannerBase64: publicUrl, bannerDominantColor: dominantColor, bannerComplementaryColor: complementaryColor }
        : isWallpaper
          ? { wallpaperBase64: publicUrl }
          : { photoURL: publicUrl };

      if (!isMessageImage && !isCardImage) {
        await prisma.user.update({
          where: { firebaseUid: req.user.sub },
          data: updateData
        });
      }
      published = true;

      const storedVerdict = hold ? 'pending' : scan.verdict === 'unavailable' ? 'unscanned' : scan.verdict;
      hashBank.remember({ url: publicUrl, hash: prepared.hash, userId: uploader?.id || null, sha256: prepared.sha256, verdict: storedVerdict, provider: scan.provider }).catch(() => {});

      if (!isMessageImage && !isCardImage) {
        if (hold) await moderationHooks.holdImage({ userId: uploader.id, type, url: publicUrl, reasonCode: 'auto.image_pending', hide: true });
        else if (scan.verdict === 'review') await moderationHooks.holdImage({ userId: uploader.id, type, url: publicUrl, reasonCode: 'auto.image_review', hide: false });
      }

      const previousImageUrl = isBanner
        ? uploader?.bannerBase64
        : isWallpaper
          ? uploader?.wallpaperBase64
          : uploader?.photoURL;

      if (!isMessageImage && !isCardImage && previousImageUrl && previousImageUrl !== publicUrl) {
        await deleteR2ObjectByPublicUrl(previousImageUrl, req.user.sub);
      }

      res.json({ success: true, url: publicUrl, dominantColor, complementaryColor, ...(hold ? { pending: true } : {}) });
    } catch (error) {
      if (!published) await deleteR2ObjectByPublicUrl(publicUrl, req.user.sub);
      throw error;
    }
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, message: 'Error procesando o subiendo la imagen' });
  }
});

export default router;
