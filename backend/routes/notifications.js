// Avisos: preferencias de correo, dispositivos con notificaciones del navegador y baja desde el correo.
import express from 'express';
import { authenticateToken, currentUserId } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { badRequest, isUuid } from '../core/validation.js';
import { PUSH_PUBLIC_KEY, isAllowedPushEndpoint, isBase64Url, pushConfigured, sendPushToUser } from '../core/push.js';
import { buildAlertMessage, isValidUnsubscribeToken } from '../core/wishlistAlerts.js';
import { sendUserEmail } from '../core/mail.js';

const router = express.Router();
const MAX_DEVICES = 10;

const settingsFor = async (userId) => {
  const [user, devices] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { notifyWishlistEmail: true } }),
    prisma.pushSubscription.count({ where: { userId } })
  ]);
  return { wishlistEmail: Boolean(user?.notifyWishlistEmail), pushAvailable: pushConfigured, pushPublicKey: pushConfigured ? PUSH_PUBLIC_KEY : null, pushDevices: devices };
};

router.get('/api/notifications/settings', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    res.json({ success: true, settings: await settingsFor(userId) });
  } catch (error) {
    console.error('Error loading notification settings:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.put('/api/notifications/settings', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (typeof req.body?.wishlistEmail !== 'boolean') return badRequest(res, 'Dato inválido');
    await prisma.user.update({ where: { id: userId }, data: { notifyWishlistEmail: req.body.wishlistEmail } });
    res.json({ success: true, settings: await settingsFor(userId) });
  } catch (error) {
    console.error('Error saving notification settings:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Activa las notificaciones en este dispositivo
router.post('/api/notifications/push/subscribe', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const { endpoint, keys } = req.body || {};
    if (!isAllowedPushEndpoint(endpoint) || !isBase64Url(keys?.p256dh, 200) || !isBase64Url(keys?.auth, 100)) return badRequest(res, 'Dispositivo inválido');
    if (!pushConfigured) return res.status(503).json({ success: false, message: 'Las notificaciones no están disponibles' });
    const existing = await prisma.pushSubscription.findUnique({ where: { endpoint }, select: { userId: true } });
    if (!existing && await prisma.pushSubscription.count({ where: { userId } }) >= MAX_DEVICES) return badRequest(res, 'Llegaste al máximo de dispositivos');
    const userAgent = String(req.get('user-agent') || '').slice(0, 200);
    // Si el mismo dispositivo cambia de cuenta, queda con la última que lo activó
    await prisma.pushSubscription.upsert({ where: { endpoint }, create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent }, update: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent } });
    res.json({ success: true, settings: await settingsFor(userId) });
  } catch (error) {
    console.error('Error subscribing device:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.post('/api/notifications/push/unsubscribe', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const { endpoint } = req.body || {};
    if (typeof endpoint !== 'string' || endpoint.length > 600) return badRequest(res, 'Dispositivo inválido');
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
    res.json({ success: true, settings: await settingsFor(userId) });
  } catch (error) {
    console.error('Error unsubscribing device:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Aviso de prueba a los dispositivos de quien lo pide
router.post('/api/notifications/push/test', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (!pushConfigured) return res.status(503).json({ success: false, message: 'Las notificaciones no están disponibles' });
    const delivered = await sendPushToUser(userId, { title: 'Carpetazo', body: 'Las notificaciones funcionan. Te avisaremos cuando aparezcan tus cartas deseadas.', url: '/dashboard?tab=deseadas', tag: 'wishlist-test' });
    res.json({ success: true, delivered });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Correo de prueba con el mismo diseño que los avisos reales, a la cuenta de quien lo pide (máximo 3 por hora)
const testEmailLog = new Map();
router.post('/api/notifications/email/test', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const recent = (testEmailLog.get(userId) || []).filter((at) => Date.now() - at < 60 * 60 * 1000);
    if (recent.length >= 3) return res.status(429).json({ success: false, message: 'Ya enviaste varias pruebas. Inténtalo más tarde.' });
    testEmailLog.set(userId, [...recent, Date.now()]);
    const card = await prisma.card.findFirst({ where: { stock: { gt: 0 }, price: { gt: 0 }, moderationState: 'visible', folder: { isPublic: true, moderationState: 'visible' } }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, price: true, imageUrl: true, folder: { select: { user: { select: { name: true, username: true } } } } } });
    const price = card?.price || 1500;
    const message = buildAlertMessage(userId, [{ kind: 'drop', previous: Math.round(price * 1.5), item: { name: card?.name || 'Carta de ejemplo' }, best: { cardId: card?.id || '00000000-0000-4000-8000-000000000000', price, imageUrl: card?.imageUrl || null, seller: card?.folder.user?.name || card?.folder.user?.username || 'un vendedor' } }]);
    const result = await sendUserEmail(userId, { subject: `Prueba: ${message.subject}`, text: message.text, html: message.html, headers: message.headers });
    if (!result.sent) return res.status(result.reason === 'terms_not_accepted' ? 403 : 502).json({ success: false, message: 'No se pudo enviar el correo de prueba', reason: result.reason });
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Baja de los avisos por correo desde el enlace del correo. Primero se muestra un botón (los programas que abren los enlaces no la hacen sin querer).
const unsubscribePage = (message, form = '') => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Avisos de Carpetazo</title></head><body style="font-family:Arial,Helvetica,sans-serif;background:#dbeafe;margin:0;padding:24px"><main style="max-width:440px;margin:40px auto;background:#fff;border-radius:20px;padding:28px;color:#12315f;text-align:center"><h1 style="font-size:22px;margin:0 0 12px">Carpetazo</h1><p style="margin:0 0 20px;line-height:1.5">${message}</p>${form}<p style="margin:20px 0 0"><a href="https://carpetazo.cl/dashboard?tab=deseadas" style="color:#1e40af">Ir a mi lista de deseos</a></p></main></body></html>`;
const validLink = (u, t) => typeof u === 'string' && typeof t === 'string' && isUuid(u) && isValidUnsubscribeToken(u, t);

router.get('/api/notifications/unsubscribe', (req, res) => {
  res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  const { u, t } = req.query;
  if (!validLink(u, t)) return res.status(400).send(unsubscribePage('Este enlace no es válido o venció.'));
  res.send(unsubscribePage('¿Dejar de recibir por correo los avisos de tus cartas deseadas?', `<form method="post" action="/api/notifications/unsubscribe?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}"><button type="submit" style="background:#facc15;color:#12315f;font-weight:800;border:0;border-radius:999px;padding:12px 24px;font-size:16px;cursor:pointer">Dejar de recibir avisos</button></form>`));
});

router.post('/api/notifications/unsubscribe', async (req, res) => {
  try {
    const { u, t } = req.query;
    if (!validLink(u, t)) return res.status(400).send(unsubscribePage('Este enlace no es válido o venció.'));
    await prisma.user.updateMany({ where: { id: u }, data: { notifyWishlistEmail: false } });
    res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }).send(unsubscribePage('Listo. Ya no recibirás avisos por correo. Puedes volver a activarlos cuando quieras desde tu lista de deseos.'));
  } catch (error) {
    console.error('Error unsubscribing from emails:', error);
    res.status(500).send(unsubscribePage('No pudimos procesar la baja. Inténtalo más tarde.'));
  }
});

export default router;
