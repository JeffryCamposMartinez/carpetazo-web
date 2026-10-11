// Formato de los mensajes: contenido, horas, etiquetas de día y enlaces. Funciones puras, sin estado.

// Un mensaje se guarda como texto plano (los antiguos) o como JSON { v: 1, text, imageUrl, imageBase64, card: { id } }
export const decodeMessage = (content = '') => {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.v === 1) {
      return { text: typeof parsed.text === 'string' ? parsed.text : '', imageUrl: parsed.imageUrl || null, imageBase64: parsed.imageBase64 || null, cardId: parsed.card?.id || null, audio: parsed.audio?.url ? parsed.audio : null };
    }
  } catch { /* texto plano */ }
  return { text: String(content || ''), imageUrl: null, imageBase64: null, cardId: null, audio: null };
};

export const encodeMessage = ({ text = '', imageUrl = null, cardId = null, audio = null }) => JSON.stringify({ v: 1, text, imageUrl, imageBase64: null, ...(cardId ? { card: { id: cardId } } : {}), ...(audio ? { audio } : {}) });

// 0:07, 1:32
export const formatDuration = (seconds) => { const total = Math.max(0, Math.round(Number(seconds) || 0)); return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`; };

export const imageOf = (body) => body.imageUrl || body.imageBase64 || null;

// Fotos y cartas de una conversación, en orden, para recorrerlas a pantalla completa
export const mediaOf = (messages) => {
  const items = [];
  for (const message of messages) {
    if (message.hidden) continue;
    const body = decodeMessage(message.content);
    const photo = imageOf(body);
    if (photo) items.push({ id: message.id, imageUrl: photo, name: body.text || 'Foto', photo: true });
    else if (body.cardId && message.attachment?.imageUrl && !message.attachment.unavailable) {
      const { id, name, set, price, tcg, private: unlisted } = message.attachment;
      items.push({ id: message.id, imageUrl: message.attachment.imageUrl, name, set, price, tcg, cardId: id, private: Boolean(unlisted) });
    }
  }
  return items;
};

// Resumen de una línea para la lista de chats y las citas
export const summaryOf = (content, attachment = null) => {
  const body = decodeMessage(content);
  if (imageOf(body)) return { icon: 'photo_camera', text: body.text || 'Foto' };
  if (body.cardId) return { icon: 'style', text: attachment?.name ? `Carta: ${attachment.name}` : 'Carta' };
  if (body.audio) return { icon: 'mic', text: `Mensaje de voz (${formatDuration(body.audio.seconds)})` };
  return { icon: null, text: body.text };
};

// ---------- Fechas ----------
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const daysBetween = (date, now) => Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
const WEEKDAY = new Intl.DateTimeFormat('es-CL', { weekday: 'long' });
const CLOCK = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);

export const clock = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : CLOCK.format(date); };

// Etiqueta que separa los mensajes de un mismo día: Hoy, Ayer, el día de la semana o la fecha
export const dayLabel = (value, now = new Date()) => {
  const date = new Date(value);
  const diff = daysBetween(date, now);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff > 1 && diff < 7) return cap(WEEKDAY.format(date));
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Hora a la derecha de cada chat en la lista: la hora si es de hoy, "Ayer", el día de la semana o la fecha corta
export const listTime = (value, now = new Date()) => {
  if (!value) return '';
  const date = new Date(value);
  const diff = daysBetween(date, now);
  if (diff === 0) return clock(date);
  if (diff === 1) return 'Ayer';
  if (diff > 1 && diff < 7) return cap(WEEKDAY.format(date));
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

// "últ. vez hoy a las 14:32"
export const lastSeenLabel = (value, now = new Date()) => {
  if (!value) return '';
  const date = new Date(value);
  const diff = daysBetween(date, now);
  if (diff === 0) return `últ. vez hoy a las ${clock(date)}`;
  if (diff === 1) return `últ. vez ayer a las ${clock(date)}`;
  return `últ. vez el ${date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
};

export const fullStamp = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${dayLabel(date)}, ${clock(date)}`;
};

export const isSameDay = (a, b) => sameDay(new Date(a), new Date(b));

// ---------- Texto ----------
// Divide un texto en partes normales y enlaces (solo http/https). Los enlaces se abren en otra pestaña sin pasar la dirección de origen.
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi;
export const splitLinks = (text = '') => {
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const trimmed = raw.replace(/[).,;:!?]+$/, '');
    if (match.index > last) parts.push({ type: 'text', value: text.slice(last, match.index) });
    parts.push({ type: 'link', value: trimmed });
    last = match.index + trimmed.length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
};

// Resalta las coincidencias de una búsqueda dentro de un texto
export const splitMatches = (text = '', query = '') => {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [{ text, match: false }];
  const parts = [];
  const lower = text.toLowerCase();
  let at = 0;
  for (let found = lower.indexOf(needle); found !== -1; found = lower.indexOf(needle, at)) {
    if (found > at) parts.push({ text: text.slice(at, found), match: false });
    parts.push({ text: text.slice(found, found + needle.length), match: true });
    at = found + needle.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), match: false });
  return parts.length ? parts : [{ text, match: false }];
};

// ---------- Personas ----------
const AVATAR_COLORS = ['#1e40af', '#0f766e', '#7c3aed', '#be185d', '#b45309', '#0369a1', '#4d7c0f', '#9333ea'];
export const avatarColor = (name = '') => AVATAR_COLORS[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length];
export const initialOf = (name = '') => (name.trim().charAt(0) || 'C').toUpperCase();

// Quién es la otra persona de un chat de la lista o de un chat nuevo
export const personOf = (chat) => {
  const other = chat?.otherUser || chat?.partner || {};
  return { id: other.id || chat?.otherId || '', name: other.name || other.username || 'Usuario', username: other.username || '', avatar: other.photoURL || null, verified: Boolean(other.verified) };
};

export const MAX_PINNED = 3;
export const EDIT_WINDOW_MS = 15 * 60 * 1000; // igual que en el servidor: un mensaje propio se corrige durante 15 minutos
export const QUICK_REPLIES_BUYER = ['¿Sigue disponible?', '¿Cuál es tu mejor precio?', '¿Hacen envíos?', '¿Dónde podemos juntarnos?'];
export const QUICK_REPLIES_SELLER = ['Hola, sí, sigue disponible', 'Te la dejo en ese precio', 'Hago envíos por Starken o Chilexpress', 'Podemos juntarnos en metro'];
