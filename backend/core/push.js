// Notificaciones del navegador (Web Push). Se activan solo si el servidor tiene las claves VAPID (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT).
import webpush from 'web-push';
import { prisma } from './db.js';

// Las claves pueden llegar con espacios, saltos de línea o comillas al pegarlas en el panel: se limpian. Si siguen mal, las notificaciones quedan
// apagadas (y se avisa en el registro); una clave inválida nunca debe impedir que el servidor arranque.
const clean = (value) => String(value || '').trim().replace(/^["']|["']$/g, '').trim().replace(/^VAPID_[A-Z_]+\s*=\s*/, '').replace(/^["']|["']$/g, '').trim();
let configured = false;
let publicKey = '';
try {
  const candidatePublic = clean(process.env.VAPID_PUBLIC_KEY);
  const candidatePrivate = clean(process.env.VAPID_PRIVATE_KEY);
  if (candidatePublic && candidatePrivate) {
    const subject = clean(process.env.VAPID_SUBJECT) || 'mailto:contacto@carpetazo.cl';
    webpush.setVapidDetails(/^(mailto:|https:)/i.test(subject) ? subject : `mailto:${subject}`, candidatePublic, candidatePrivate);
    configured = true;
    publicKey = candidatePublic;
  }
} catch (error) {
  console.error('Notificaciones del navegador desactivadas: claves VAPID inválidas.', error.message);
}
export const PUSH_PUBLIC_KEY = publicKey;
export const pushConfigured = configured;

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
