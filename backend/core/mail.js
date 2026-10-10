// Correos a los usuarios.
import nodemailer from 'nodemailer';
import { prisma } from './db.js';
import { isCurrentAcceptance, latestAcceptance } from './legal.js';

// Se envían por SMTP (Gmail con contraseña de aplicación: SMTP_USER y SMTP_PASS en el servidor).
// Regla: SOLO se escribe a cuentas activas que tengan aceptada la versión vigente de los Términos y la Política.
// En las pruebas (MAIL_TEST_OUTBOX=1, sin credenciales) los correos no salen: quedan en memoria.
const mailTransport = process.env.SMTP_USER && process.env.SMTP_PASS
  ? nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  })
  : process.env.MAIL_TEST_OUTBOX === '1' ? nodemailer.createTransport({ jsonTransport: true }) : null;
// MAIL_FROM_ADDRESS: dirección desde la que se envía cuando es distinta del usuario SMTP (por ejemplo, un servicio de envío con dominio propio)
const MAIL_FROM_ADDRESS = (process.env.MAIL_FROM_ADDRESS || '').trim();
const MAIL_FROM = `"Carpetazo" <${MAIL_FROM_ADDRESS || process.env.SMTP_USER || 'pruebas@carpetazo.test'}>`;
const MAIL_REPLY_TO = (process.env.MAIL_REPLY_TO || '').trim();

export const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Devuelve { sent, reason }. Nunca lanza: un correo que no sale no debe romper la acción del usuario.
export const sendUserEmail = async (userId, { subject, text, html, headers }) => {
  try {
    if (!mailTransport) return { sent: false, reason: 'not_configured' };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } });
    if (!user || user.role === 'deleted' || !user.email || user.email.endsWith('@deleted.invalid')) return { sent: false, reason: 'no_recipient' };
    if (!isCurrentAcceptance(await latestAcceptance(user.id))) return { sent: false, reason: 'terms_not_accepted' };
    await mailTransport.sendMail({ from: MAIL_FROM, to: user.email, subject, text, html, ...(MAIL_REPLY_TO ? { replyTo: MAIL_REPLY_TO } : {}), ...(headers ? { headers } : {}) });
    return { sent: true };
  } catch (error) {
    console.error('Error sending email:', error.message);
    return { sent: false, reason: 'send_failed' };
  }
};
