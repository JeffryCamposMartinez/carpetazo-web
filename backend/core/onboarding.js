// Primeros pasos de un vendedor nuevo: perfil, primera carpeta, primeras cartas y compartir el enlace.
// El avance se calcula siempre con lo que hay guardado (nunca con lo que informe el navegador).
import { prisma } from './db.js';
import { sendUserEmail } from './mail.js';
import { noticeEmailHtml } from './noticeEmail.js';
import { sendPushToUser } from './push.js';

export const MIN_CARDS = 5;
const SITE = 'https://carpetazo.cl';

export const getOnboarding = async (userId) => {
  const [user, folders, cardTotals] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { photoURL: true, publicComuna: true, onboardingSharedAt: true } }),
    prisma.folder.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true, isPublic: true, _count: { select: { cards: { where: { stock: { gt: 0 } } } } } } }),
    prisma.card.count({ where: { folder: { userId }, stock: { gt: 0 } } })
  ]);
  if (!user) return null;
  const shareFolder = folders.find((folder) => folder.isPublic && folder._count.cards > 0) || folders.find((folder) => folder.isPublic) || folders[0] || null;
  const steps = [
    { key: 'profile', done: Boolean(user.photoURL && user.publicComuna), missing: [!user.photoURL && 'foto', !user.publicComuna && 'comuna'].filter(Boolean) },
    { key: 'folder', done: folders.length > 0 },
    { key: 'cards', done: cardTotals >= MIN_CARDS, count: cardTotals, goal: MIN_CARDS },
    { key: 'share', done: Boolean(user.onboardingSharedAt) }
  ];
  const doneCount = steps.filter((step) => step.done).length;
  return {
    steps, done: doneCount, total: steps.length, complete: doneCount === steps.length,
    folderId: folders[0]?.id || null, // dónde agregar cartas
    shareFolderId: shareFolder?.id || null // la carpeta cuyo enlace se comparte
  };
};

export const markShared = (userId) => prisma.user.updateMany({ where: { id: userId, onboardingSharedAt: null }, data: { onboardingSharedAt: new Date() } });

// --- Recordatorio único: una cuenta que se registró ayer y aún no publicó ninguna carta ---
const NUDGE_MIN_AGE_MS = 20 * 60 * 60 * 1000;
const NUDGE_MAX_AGE_MS = 72 * 60 * 60 * 1000; // quien se registró hace más de 3 días no recibe nada (así no se escribe a cuentas antiguas)
const NUDGE_BATCH = 20;
const NUDGE_EVERY_MS = 30 * 60 * 1000;
const FINAL_REASONS = new Set(['terms_not_accepted', 'no_recipient']); // no se va a poder enviar nunca: se deja de intentar

export const buildNudge = (name) => {
  const subject = 'Publica tus primeras cartas en Carpetazo';
  const intro = `${name ? `Hola ${name}, ya` : 'Ya'} tienes tu cuenta. En menos de 5 minutos puedes tener tus cartas a la venta y compartirlas con quien quieras.`;
  const steps = [
    { title: 'Crea una carpeta', text: 'Elige el juego y ponle un nombre, por ejemplo «Pokémon en venta».' },
    { title: `Agrega al menos ${MIN_CARDS} cartas`, text: 'Búscalas por nombre: ya traen su imagen y su edición.' },
    { title: 'Comparte el enlace', text: 'Mándalo por WhatsApp o Instagram. Se ve con una vista previa de tus cartas.' }
  ];
  const text = `${intro}\n\n${steps.map((step, index) => `${index + 1}. ${step.title}: ${step.text}`).join('\n')}\n\nEmpieza aquí: ${SITE}/dashboard\n\nEs el único recordatorio de este tipo que te enviaremos.`;
  const html = noticeEmailHtml({ subject, title: 'Tu primera carpeta está a 3 pasos', intro, steps, cta: 'Crear mi primera carpeta', ctaUrl: `${SITE}/dashboard`, footer: 'Es el único recordatorio de este tipo que te enviaremos. Lo recibes porque creaste tu cuenta en' });
  return { subject, text, html, push: { title: 'Publica tus primeras cartas', body: 'Crea una carpeta y comparte el enlace: toma menos de 5 minutos.', url: '/dashboard', tag: 'onboarding-nudge' } };
};

// Una pasada. `send` y `now` se pueden cambiar en las pruebas.
export const runOnboardingNudges = async ({ send = sendUserEmail, now = new Date() } = {}) => {
  const candidates = await prisma.user.findMany({
    where: {
      role: { notIn: ['deleted'] }, onboardingNudgeAt: null,
      createdAt: { gte: new Date(now - NUDGE_MAX_AGE_MS), lte: new Date(now - NUDGE_MIN_AGE_MS) },
      folders: { none: { cards: { some: {} } } } // aún no tiene ninguna carta publicada
    },
    orderBy: { createdAt: 'asc' }, take: NUDGE_BATCH, select: { id: true, name: true }
  });
  let sent = 0;
  for (const user of candidates) {
    const message = buildNudge((user.name || '').split(' ')[0]);
    const result = await send(user.id, { subject: message.subject, text: message.text, html: message.html });
    const push = await sendPushToUser(user.id, message.push).catch(() => 0);
    if (result.sent || push > 0 || FINAL_REASONS.has(result.reason)) {
      await prisma.user.update({ where: { id: user.id }, data: { onboardingNudgeAt: now } }).catch(() => {});
      if (result.sent || push > 0) sent += 1;
    }
  }
  return { candidates: candidates.length, sent };
};

let running = false;
export const startOnboardingNudges = () => {
  if (process.env.TEST_AUTH_STUB) return; // las pruebas lo ejecutan a mano
  const tick = async () => {
    if (running) return;
    running = true;
    try { const result = await runOnboardingNudges(); if (result.candidates) console.log(`Recordatorio de primeros pasos: ${result.sent} de ${result.candidates} enviados`); } catch (error) { console.error('Error en el recordatorio de primeros pasos:', error.message); } finally { running = false; }
  };
  setTimeout(tick, 90 * 1000).unref();
  setInterval(tick, NUDGE_EVERY_MS).unref();
};
