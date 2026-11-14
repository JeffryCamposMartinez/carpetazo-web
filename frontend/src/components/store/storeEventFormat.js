// Formato de fechas y precios de los eventos de tiendas (hora de Chile)
import { formatCLP } from '../../utils/orderMessage';

export const eventDate = (iso) => new Date(iso).toLocaleString('es-CL', { timeZone: 'America/Santiago', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const eventFee = (fee) => (fee ? formatCLP(fee) : 'Gratis');
export const spotsText = (e) => (e.capacity === null ? `${e.registered} inscritos` : e.spotsLeft > 0 ? `${e.spotsLeft} de ${e.capacity} cupos libres` : `Cupos llenos${e.waitlist ? ` · ${e.waitlist} en espera` : ''}`);

// <input type="datetime-local"> trabaja en la hora del navegador
export const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (value) => (value ? new Date(value).toISOString() : '');
