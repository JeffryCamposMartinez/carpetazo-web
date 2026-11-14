// Pedido por WhatsApp: el texto que se le manda al vendedor y la dirección que lo abre.
export const formatCLP = (price) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);

// items: [{ quantity, name, set, price }]; payment (opcional): datos de transferencia del vendedor
export const buildOrderMessage = ({ folderName, items, total, code, payment }) => {
  let message = `¡Hola! Vengo de Carpetazo. Me interesa comprar estas cartas de la carpeta "${folderName || 'Catálogo'}":\n\n`;
  items.forEach((item) => {
    message += `• ${item.quantity}x ${item.name} (${item.set}) - ${formatCLP(Number(item.price || 0) * item.quantity)}\n`;
  });
  message += `\nTotal: ${formatCLP(total)}`;
  if (code) message += `\nCódigo de pedido: ${code}`;
  if (payment) {
    message += `\n\nDatos para transferir:\n${[payment.holderName, payment.rut, payment.bank, payment.accountType, payment.accountNumber].filter(Boolean).join('\n')}`;
  }
  message += payment ? '\n\n¿Tienes disponibilidad?' : '\n\n¿Tienes disponibilidad? ¿Me compartes los datos para transferir?';
  return message;
};

// Número chileno (con o sin +56, espacios o guiones) → dirección de WhatsApp con el texto ya escrito
export const whatsappOrderUrl = (phone, message) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return `https://api.whatsapp.com/send?phone=${digits.startsWith('56') ? digits : `56${digits}`}&text=${encodeURIComponent(message)}`;
};
