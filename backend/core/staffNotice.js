// Aviso a una persona cuando el equipo hace algo en su cuenta: mensaje en su bandeja (campana), correo y notificación del navegador.
// Lleva siempre una línea con lo que se hizo y, si el equipo la escribió, su nota personal.
import { prisma } from './db.js';
import { createMessage, encodeContent } from './chat.js';
import { sendUserEmail } from './mail.js';
import { noticeEmailHtml } from './noticeEmail.js';
import { sendPushToUser } from './push.js';
import { hasControlChars, hasDeceptiveChars } from './validation.js';

const SITE = 'https://carpetazo.cl';
export const NOTICE_MAX = 600;

// Vacío → ''; texto válido → recortado; inválido → null
export const cleanNotice = (value) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.length > NOTICE_MAX || hasDeceptiveChars(value) || hasControlChars(value.replace(/[\n\r\t]/g, ''))) return null;
  return value.trim();
};

// Devuelve cuáles canales llegaron: { chat, email, push }. Nunca lanza: un aviso que falla no deshace lo que ya se hizo.
export const notifyUser = async ({ actorId, targetId, title, summary, message = '' }) => {
  const out = { chat: false, email: false, push: 0 };
  try {
    const [actor, target] = await Promise.all([
      actorId ? prisma.user.findUnique({ where: { id: actorId }, select: { id: true, role: true } }) : null,
      prisma.user.findUnique({ where: { id: targetId }, select: { id: true, role: true } })
    ]);
    if (!target || target.role === 'deleted') return out;
    const personal = message ? `\n\nMensaje del equipo: ${message}` : '';
    const text = `${title}\n\n${summary}${personal}\n\nEquipo Carpetazo`;
    if (actor && actor.id !== target.id) {
      const result = await createMessage({ sender: actor, receiver: target, content: encodeContent({ text: `📢 ${title}\n\n${summary}${personal}` }) }).catch(() => null);
      out.chat = Boolean(result?.message);
    }
    const intro = `${summary}${message ? ` Mensaje del equipo: ${message}` : ''}`;
    const html = noticeEmailHtml({ subject: title, title, intro, cta: 'Ir a Carpetazo', ctaUrl: SITE, footer: 'Recibes este correo porque el equipo de Carpetazo hizo un cambio en tu cuenta de' });
    out.email = Boolean((await sendUserEmail(target.id, { subject: title, text, html })).sent);
    out.push = await sendPushToUser(target.id, { title, body: message || summary, url: '/mensajes', tag: 'staff-notice' }).catch(() => 0);
  } catch (error) {
    console.error('Error avisando a la persona:', error.message);
  }
  return out;
};
