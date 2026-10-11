// Estado de un mensaje propio, como en WhatsApp: reloj (enviando), ✓ enviado, ✓✓ entregado y ✓✓ amarillo leído. Falla: aviso rojo.
export function messageStatus(message) {
  if (message.failed) return 'failed';
  if (message.pending) return 'pending';
  if (message.isRead) return 'read';
  if (message.deliveredAt) return 'delivered';
  return 'sent';
}

const LABEL = { failed: 'No se pudo enviar', pending: 'Enviando', sent: 'Enviado', delivered: 'Entregado', read: 'Leído' };

export default function Ticks({ status, className = '' }) {
  const icon = status === 'failed' ? 'error' : status === 'pending' ? 'schedule' : status === 'sent' ? 'check' : 'done_all';
  const color = status === 'read' ? 'text-[#facc15]' : status === 'failed' ? 'text-red-300' : 'text-white/70';
  return (
    <span title={LABEL[status]} className={`inline-flex ${color} ${className}`}>
      <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[16px] leading-none" style={{ fontVariationSettings: "'wght' 600" }}>{icon}</span>
      <span className="sr-only">{LABEL[status]}</span>
    </span>
  );
}
