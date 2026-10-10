// Notificaciones del navegador (Web Push). Se activan solo si el servidor tiene las claves VAPID (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT).
import webpush from 'web-push';
import { prisma } from './db.js';

export const PUSH_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
export const pushConfigured = Boolean(PUSH_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (pushConfigured) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contacto@carpetazo.cl', PUSH_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

// El servidor hace la petición al "endpoint" del dispositivo: solo se aceptan los servicios de notificaciones de los navegadores (nunca direcciones internas)
const PUSH_HOST = /(^|\.)(googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/i;
export const isAllowedPushEndpoint = (value) => {
  if (typeof value !== 'string' || value.length > 600) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && PUSH_HOST.test(url.hostname);
  } catch (_error) {
    return false;
  }
};
export const isBase64Url = (value, max) => typeof value === 'string' && value.length >= 8 && value.length <= max && /^[A-Za-z0-9_-]+=*$/.test(value);

// Envía un aviso a todos los dispositivos de una persona; los que ya no existen (404/410) se borran. Devuelve cuántos recibieron el aviso.
export const sendPushToUser = async (userId, payload) => {
  if (!pushConfigured) return 0;
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId }, select: { id: true, endpoint: true, p256dh: true, auth: true } });
  const body = JSON.stringify(payload);
  let delivered = 0;
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, body, { TTL: 24 * 60 * 60, timeout: 8000 });
      delivered += 1;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => {});
      else console.error('Error enviando notificación push:', error.statusCode || error.message);
    }
  }
  return delivered;
};
