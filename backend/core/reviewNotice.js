// Cuando un vendedor confirma una venta, el comprador (si tiene cuenta) recibe el aviso de que ya puede calificarlo: por correo y por notificación del navegador.
// Es un aviso de su propia compra (no un envío masivo) y sale una sola vez por pedido, porque confirmar el pedido solo se puede hacer una vez.
import { prisma } from './db.js';
import { sendUserEmail } from './mail.js';
import { noticeEmailHtml } from './noticeEmail.js';
import { sendPushToUser } from './push.js';

const SITE = 'https://carpetazo.cl';

export const buildReviewNotice = ({ sellerName, folderName, code }) => {
  const subject = `¿Cómo te fue con ${sellerName}? Califica tu compra`;
  const intro = `${sellerName} confirmó tu pedido${code ? ` ${code}` : ''} de «${folderName}». Tu reseña ayuda a otros compradores a elegir con confianza.`;
  const text = `${intro}\n\nCalifícalo aquí: ${SITE}\nAl entrar a Carpetazo verás el aviso en la campana.`;
  const html = noticeEmailHtml({
    subject, title: '¿Cómo te fue con tu compra?', intro, cta: 'Calificar al vendedor', ctaUrl: SITE,
    footer: 'Recibes este correo porque un vendedor confirmó una compra tuya en'
  });
  return { subject, text, html, push: { title: `¿Cómo te fue con ${sellerName}?`, body: 'Tu compra fue confirmada. Cuéntanos cómo te fue.', url: '/', tag: 'review-request' } };
};

export const notifyReviewRequest = async (order) => {
  try {
    if (!order.buyerId || order.buyerId === order.sellerId) return { email: false, push: 0 };
    const alreadyReviewed = await prisma.sellerReview.findFirst({ where: { reviewerId: order.buyerId, sellerId: order.sellerId }, select: { id: true } });
    if (alreadyReviewed) return { email: false, push: 0 }; // solo se puede calificar una vez a cada vendedor
    const seller = await prisma.user.findUnique({ where: { id: order.sellerId }, select: { name: true, username: true } });
    const message = buildReviewNotice({ sellerName: seller?.name || seller?.username || 'el vendedor', folderName: order.folderName, code: order.code });
    const emailResult = await sendUserEmail(order.buyerId, { subject: message.subject, text: message.text, html: message.html });
    const push = await sendPushToUser(order.buyerId, message.push);
    return { email: emailResult.sent, push };
  } catch (error) {
    console.error('Error avisando que ya puede calificar:', error.message);
    return { email: false, push: 0 };
  }
};
