// Mensajería: contenido de los mensajes, bloqueos, presencia y la forma en que se entregan al cliente. Lo usan las rutas de mensajes y de chats.
import { prisma } from './db.js';
import { isOnline, publish } from './chatEvents.js';
import { isUuid, isAllowedStoredImageUrl, isShortText } from './validation.js';
import { moderationHooks } from '../moderation/services.js';

export const HIDDEN_MESSAGE_TEXT = 'Mensaje oculto por moderación';
export const EDIT_WINDOW_MS = 15 * 60 * 1000; // un mensaje propio se puede corregir durante 15 minutos
export const TEXT_MAX = 4000;
const PRESENCE_ONLINE_MS = 90 * 1000;
const TOUCH_EVERY_MS = 60 * 1000;
const REACTION = /^\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*$/u;

export const isValidReaction = (emoji) => typeof emoji === 'string' && emoji.length <= 16 && REACTION.test(emoji);

// ---------- Contenido ----------
// Un mensaje se guarda como texto plano (los antiguos) o como JSON { v: 1, text, imageUrl, imageBase64, card: { id }, audio: { url, seconds, wave } }
export const decodeContent = (content = '') => {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.v === 1) {
      return { text: typeof parsed.text === 'string' ? parsed.text : '', imageUrl: parsed.imageUrl || null, imageBase64: parsed.imageBase64 || null, cardId: typeof parsed.card?.id === 'string' ? parsed.card.id : null, audio: parsed.audio && typeof parsed.audio === 'object' ? parsed.audio : null };
    }
  } catch (_error) { /* texto plano */ }
  return { text: String(content || ''), imageUrl: null, imageBase64: null, cardId: null, audio: null };
};

export const encodeContent = ({ text = '', imageUrl = null, imageBase64 = null, cardId = null, audio = null }) => JSON.stringify({ v: 1, text, imageUrl, imageBase64, ...(cardId ? { card: { id: cardId } } : {}), ...(audio ? { audio } : {}) });

// La imagen solo de hosts permitidos (una URL cualquiera dejaría a quien envía ver la IP de quien lee) o embebida en base64.
// El adjunto de carta lleva solo su id: los datos se leen de la base al mostrarlo.
// Mensaje de voz: archivo en nuestro almacenamiento (carpeta de voz), duración de hasta 3 minutos y una curva de volumen corta
export const VOICE_MAX_SECONDS = 180;
const isValidAudio = (audio) => typeof audio === 'object' && !Array.isArray(audio)
  && isAllowedStoredImageUrl(audio.url) && /\/voice\/[0-9a-f]{32}\.(webm|ogg|m4a|mp3)$/.test(String(audio.url))
  && Number.isFinite(audio.seconds) && audio.seconds >= 1 && audio.seconds <= VOICE_MAX_SECONDS
  && (audio.wave === undefined || (Array.isArray(audio.wave) && audio.wave.length <= 64 && audio.wave.every((value) => Number.isInteger(value) && value >= 0 && value <= 100)));

export const isAllowedMessageContent = (content) => {
  if (!isShortText(content, 1500000)) return false;
  let body;
  try { body = JSON.parse(content); } catch (_error) { return true; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return true;
  if (body.imageUrl && !isAllowedStoredImageUrl(body.imageUrl)) return false;
  if (body.imageBase64 && !/^data:image[/](png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(String(body.imageBase64))) return false;
  if (body.card !== undefined && body.card !== null && (typeof body.card !== 'object' || !isUuid(body.card.id))) return false;
  if (body.audio !== undefined && body.audio !== null && !isValidAudio(body.audio)) return false;
  if (typeof body.text === 'string' && body.text.length > TEXT_MAX) return false;
  return body.text === undefined || body.text === null || typeof body.text === 'string';
};

export const flagMessageText = (message, receiverId) => {
  const { text } = decodeContent(message.content);
  if (text) moderationHooks.flagText?.('message', message.id, text, 'message', receiverId);
};

// ---------- Personas y bloqueos ----------
export const resolveUserByAnyId = async (identifier) => {
  const value = String(identifier || '').trim();
  if (!value || value.length > 128) return null;
  const where = [{ firebaseUid: value }, { username: value }];
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) where.push({ id: value });
  return prisma.user.findFirst({ where: { OR: where } });
};

// Bloqueo entre usuarios: devuelve el motivo si no se puede escribir, o null
export const messageBlockReason = async (senderId, receiverId) => {
  const rows = await prisma.userBlock.findMany({ where: { OR: [{ blockerId: receiverId, blockedId: senderId }, { blockerId: senderId, blockedId: receiverId }] }, select: { blockerId: true } });
  if (rows.some((row) => row.blockerId === senderId)) return 'Bloqueaste a esta persona. Desbloquéala para escribirle.';
  if (rows.length) return 'No puedes enviarle mensajes a esta persona.';
  return null;
};

export const currentChatUser = (req) => prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });

// ---------- Presencia ----------
const lastTouch = new Map();
// Se anota la actividad como mucho una vez por minuto (o al forzarla, p. ej. al cerrar la conexión)
export const touchPresence = (userId, force = false) => {
  const now = Date.now();
  if (!force && now - (lastTouch.get(userId) || 0) < TOUCH_EVERY_MS) return;
  lastTouch.set(userId, now);
  if (lastTouch.size > 5000) lastTouch.delete(lastTouch.keys().next().value);
  prisma.user.updateMany({ where: { id: userId }, data: { lastSeenAt: new Date(now) } }).catch(() => {});
};

// "En línea" o la última conexión. Es recíproco: quien oculta la suya tampoco ve la de los demás.
export const presenceFor = (partner, viewer) => {
  if (!partner.showLastSeen || !viewer.showLastSeen) return null;
  const online = isOnline(partner.id) || Boolean(partner.lastSeenAt && Date.now() - new Date(partner.lastSeenAt).getTime() < PRESENCE_ONLINE_MS);
  return { online, lastSeenAt: online ? null : partner.lastSeenAt || null };
};

// ---------- Cómo se entrega un mensaje ----------
const cardInfo = (card) => ({ id: card.id, name: card.name, imageUrl: card.imageUrl, price: card.price, stock: card.stock, tcg: card.folder?.tcg || null, set: card.data && typeof card.data === 'object' && typeof card.data.set === 'string' ? card.data.set.slice(0, 80) : null, ...(card.folder?.isPublic ? {} : { private: true }) });

// Una carta de una carpeta pública la puede ver cualquiera; una de una carpeta no pública solo si la manda su dueño (`ownerIds`)
const loadCards = async (ids, ownerIds = []) => {
  const unique = [...new Set(ids)].filter(isUuid);
  if (!unique.length) return new Map();
  const cards = await prisma.card.findMany({
    where: {
      id: { in: unique }, moderationState: 'visible',
      OR: [{ folder: { isPublic: true, moderationState: 'visible' } }, ...(ownerIds.length ? [{ folder: { userId: { in: ownerIds }, moderationState: 'visible' } }] : [])]
    },
    select: { id: true, name: true, imageUrl: true, price: true, stock: true, data: true, folder: { select: { tcg: true, isPublic: true, userId: true } } }
  });
  return new Map(cards.map((card) => [card.id, { ...cardInfo(card), ownerId: card.folder.userId }]));
};

// La carta de una carpeta no pública solo cuenta si quien la mandó es su dueño; nunca se devuelve el dueño
const attachmentFor = (card, cardId, senderId) => {
  if (!card || (card.private && card.ownerId !== senderId)) return { id: cardId, unavailable: true };
  const { ownerId, ...visible } = card; // eslint-disable-line no-unused-vars
  return visible;
};

const replyPreview =(row, viewerId) => {
  if (!row) return { id: null, gone: true };
  const hidden = row.moderationState === 'hidden' && row.senderId !== viewerId;
  const body = hidden ? { text: HIDDEN_MESSAGE_TEXT, imageUrl: null, imageBase64: null, cardId: null } : decodeContent(row.content);
  return { id: row.id, senderId: row.senderId, text: body.text.slice(0, 160), kind: body.imageUrl || body.imageBase64 ? 'image' : body.cardId ? 'card' : body.audio ? 'audio' : 'text' };
};

// `viewer` y `partner`: filas de usuario (con showReadReceipts). Las confirmaciones de lectura son recíprocas.
export const serializeMessages = async (messages, { viewer, partner = null }) => {
  if (!messages.length) return [];
  const ids = messages.map((message) => message.id);
  const replyIds = [...new Set(messages.map((message) => message.replyToId).filter(Boolean))];
  const cardIds = messages.map((message) => decodeContent(message.content).cardId).filter(Boolean);
  const [reactions, stars, replies, cards] = await Promise.all([
    prisma.messageReaction.findMany({ where: { messageId: { in: ids } }, select: { messageId: true, userId: true, emoji: true } }),
    prisma.messageStar.findMany({ where: { userId: viewer.id, messageId: { in: ids } }, select: { messageId: true } }),
    replyIds.length ? prisma.message.findMany({ where: { id: { in: replyIds }, OR: [{ senderId: viewer.id }, { receiverId: viewer.id }] }, select: { id: true, senderId: true, content: true, moderationState: true } }) : [],
    loadCards(cardIds, [...new Set(messages.map((message) => message.senderId))])
  ]);
  const reactionsBy = new Map();
  for (const row of reactions) {
    if (!reactionsBy.has(row.messageId)) reactionsBy.set(row.messageId, new Map());
    const group = reactionsBy.get(row.messageId);
    const entry = group.get(row.emoji) || { emoji: row.emoji, count: 0, mine: false };
    entry.count += 1;
    if (row.userId === viewer.id) entry.mine = true;
    group.set(row.emoji, entry);
  }
  const starred = new Set(stars.map((row) => row.messageId));
  const replyById = new Map(replies.map((row) => [row.id, row]));
  const receipts = Boolean(viewer.showReadReceipts && (partner ? partner.showReadReceipts : true));

  return messages.map(({ moderationState, replyToId, ...message }) => {
    const mine = message.senderId === viewer.id;
    const hidden = moderationState === 'hidden' && !mine;
    const body = decodeContent(message.content);
    return {
      ...message,
      ...(hidden ? { content: HIDDEN_MESSAGE_TEXT, hidden: true } : {}),
      // Quien envía solo ve "leído" si ambos tienen activadas las confirmaciones de lectura
      ...(mine && !receipts ? { isRead: false, readAt: null } : {}),
      starred: starred.has(message.id),
      reactions: hidden ? [] : [...(reactionsBy.get(message.id)?.values() || [])],
      replyTo: replyToId ? replyPreview(replyById.get(replyToId), viewer.id) : null,
      attachment: !hidden && body.cardId ? attachmentFor(cards.get(body.cardId), body.cardId, message.senderId) : null
    };
  });
};

// ---------- Crear un mensaje ----------
// Devuelve { message } o { status, body } con el error para el cliente
export const createMessage = async ({ sender, receiver, content, replyToId = null, forwarded = false }) => {
  if (!content || !isAllowedMessageContent(content)) return { status: 400, body: { success: false, message: 'Mensaje inválido' } };
  if (receiver.id === sender.id) return { status: 400, body: { success: false, message: 'No puedes enviarte mensajes a ti mismo.' } };
  if (receiver.role === 'deleted') return { status: 403, body: { success: false, code: 'deleted', message: 'Esta cuenta ya no existe.' } };
  const blockedReason = await messageBlockReason(sender.id, receiver.id);
  if (blockedReason) return { status: 403, body: { success: false, code: 'blocked', message: blockedReason } };

  const body = decodeContent(content);
  if (!body.text.trim() && !body.imageUrl && !body.imageBase64 && !body.cardId && !body.audio) return { status: 400, body: { success: false, message: 'Mensaje inválido' } };
  if (body.cardId && !(await loadCards([body.cardId], [sender.id])).has(body.cardId)) return { status: 400, body: { success: false, message: 'Esa carta ya no está disponible.' } };
  if (replyToId) {
    const target = isUuid(replyToId)
      ? await prisma.message.findFirst({ where: { id: replyToId, OR: [{ senderId: sender.id, receiverId: receiver.id }, { senderId: receiver.id, receiverId: sender.id }] }, select: { id: true } })
      : null;
    if (!target) return { status: 400, body: { success: false, message: 'El mensaje al que respondes no existe.' } };
  }

  const message = await prisma.message.create({
    data: { senderId: sender.id, receiverId: receiver.id, content, replyToId: replyToId || null, forwarded, deliveredAt: isOnline(receiver.id) ? new Date() : null }
  });
  // Un chat archivado vuelve a la lista cuando llega un mensaje nuevo
  prisma.chatSetting.updateMany({ where: { userId: receiver.id, partnerId: sender.id, archivedAt: { not: null } }, data: { archivedAt: null } }).catch(() => {});
  publish(receiver.id, 'message', { partnerId: sender.id });
  publish(sender.id, 'message', { partnerId: receiver.id });
  flagMessageText(message, receiver.id);
  touchPresence(sender.id);
  return { message };
};

// Avisa a las dos personas (y a sus otras pestañas) que algo de la conversación cambió
export const notifyChanged = (userId, partnerId) => {
  publish(userId, 'message', { partnerId });
  publish(partnerId, 'message', { partnerId: userId });
};

export const isParticipant = (message, userId) => Boolean(message && (message.senderId === userId || message.receiverId === userId));
