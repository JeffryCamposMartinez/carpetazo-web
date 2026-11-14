// Avisos de las herramientas de tienda (eventos, retiros, seguidores, resumen semanal) y la tarea periódica que los manda.
// Cada aviso se reclama en la base antes de enviarse, así un reinicio o dos instancias no lo mandan dos veces.
import { prisma } from './db.js';
import { sendUserEmail } from './mail.js';
import { noticeEmailHtml } from './noticeEmail.js';
import { sendPushToUser } from './push.js';

const SITE = 'https://carpetazo.cl';
const RUN_EVERY_MS = 10 * 60 * 1000;
const tasks = [];

// Push + correo a varias personas; nunca lanza
export const notifyUsers = async (userIds, { subject, title, intro, url, tag, cta = 'Ver en Carpetazo' }) => {
  let sent = 0;
  for (const userId of [...new Set(userIds)]) {
    try {
      await sendUserEmail(userId, {
        subject,
        text: `${intro}\n\n${SITE}${url}`,
        html: noticeEmailHtml({ subject, title, intro, cta, ctaUrl: SITE + url, footer: 'Recibes este correo por tu actividad con una tienda (puedes dejar de seguirla desde su perfil) en' })
      });
      await sendPushToUser(userId, { title, body: intro, url, tag }).catch(() => 0);
      sent += 1;
    } catch (error) {
      console.error('Error enviando aviso de tienda:', error.message);
    }
  }
  return sent;
};

const fmtWhen = (date) => new Date(date).toLocaleString('es-CL', { timeZone: 'America/Santiago', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
export const eventWhen = fmtWhen;

// Recordatorio 24 h antes, una vez por evento, a las personas inscritas
export const runEventReminders = async (now = new Date()) => {
  const due = await prisma.storeEvent.findMany({
    where: { status: 'scheduled', reminderSentAt: null, startsAt: { gt: now, lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) } },
    select: { id: true, title: true, startsAt: true, store: { select: { name: true, username: true } } },
    take: 100
  });
  let notified = 0;
  for (const event of due) {
    const claimed = await prisma.storeEvent.updateMany({ where: { id: event.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (!claimed.count) continue;
    const signups = await prisma.storeEventSignup.findMany({ where: { eventId: event.id, status: 'registered' }, select: { userId: true } });
    const storeName = event.store.name || event.store.username;
    notified += await notifyUsers(signups.map((s) => s.userId), {
      subject: `Mañana: ${event.title} en ${storeName}`,
      title: `Recordatorio: ${event.title}`,
      intro: `Tu evento en ${storeName} es ${fmtWhen(event.startsAt)}. La inscripción se paga en el local.`,
      url: `/${event.store.username}`,
      tag: `store-event-${event.id}`
    });
  }
  return { events: due.length, notified };
};
tasks.push(runEventReminders);

export const addStoreTask = (fn) => tasks.push(fn);

// Aviso a los seguidores de una tienda: cada seguidor recibe como máximo un aviso de esa tienda cada 24 h (se reclama antes de enviar)
export const notifyFollowers = async (storeId, { kind, message = '', event = null }, now = new Date()) => {
  const store = await prisma.user.findUnique({ where: { id: storeId }, select: { name: true, username: true } });
  if (!store?.username) return 0;
  const name = store.name || store.username;
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const followers = await prisma.storeFollow.findMany({ where: { storeId, OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lt: since } }] }, select: { id: true, userId: true }, take: 5000 });
  const ready = [];
  for (const f of followers) {
    const claimed = await prisma.storeFollow.updateMany({ where: { id: f.id, OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lt: since } }] }, data: { lastNotifiedAt: now } });
    if (claimed.count) ready.push(f.userId);
  }
  const text = kind === 'event'
    ? { subject: `${name} publicó un evento: ${event.title}`, title: `Nuevo evento en ${name}`, intro: `«${event.title}» (${event.game}) el ${fmtWhen(event.startsAt)}. Inscríbete desde su perfil.` }
    : { subject: `${name}: ${message.slice(0, 60)}`, title: `Aviso de ${name}`, intro: message };
  return notifyUsers(ready, { ...text, url: `/${store.username}`, tag: `store-${storeId}`, cta: 'Ver la tienda' });
};


let running = false;
export const startStoreJobs = () => {
  if (process.env.TEST_AUTH_STUB) return; // las pruebas lo ejecutan a mano
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      for (const task of tasks) await task(new Date()).catch((error) => console.error('Error en tarea de tiendas:', error.message));
    } finally { running = false; }
  };
  setTimeout(tick, 90 * 1000).unref();
  setInterval(tick, RUN_EVERY_MS).unref();
};
