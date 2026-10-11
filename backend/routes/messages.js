// Mensajes de una conversación: leer, enviar, marcar leído, "escribiendo…", responder, reaccionar, destacar y corregir.
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import {
  EDIT_WINDOW_MS, TEXT_MAX, createMessage, currentChatUser, decodeContent, encodeContent, flagMessageText,
  isParticipant, isValidReaction, messageBlockReason, notifyChanged, presenceFor, resolveUserByAnyId, serializeMessages, touchPresence
} from '../core/chat.js';
import { publish } from '../core/chatEvents.js';
import { isVerifiedSeller } from '../core/sellerTrust.js';
import { badRequest, isUuid } from '../core/validation.js';

const router = express.Router();
const PAGE_DEFAULT = 50;
const PAGE_MAX = 100;
const TYPING_TTL_MS = 4500;
const typingPresence = new Map();
const typingKey = (senderId, receiverId) => `${senderId}:${receiverId}`;

const publicPartner = (partner, viewer) => ({
  id: partner.id, name: partner.name, username: partner.username, photoURL: partner.photoURL,
  publicComuna: partner.publicComuna || null, verified: isVerifiedSeller(partner), presence: presenceFor(partner, viewer)
});

// Enviar un mensaje (ruta antigua con el destinatario en el cuerpo)
router.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const sender = await currentChatUser(req);
    const { receiverId, content } = req.body || {};
    if (!receiverId || !content) return res.status(400).json({ success: false, message: 'Missing fields' });
    if (typeof receiverId !== 'string' || typeof content !== 'string') return badRequest(res, 'Mensaje inválido');
    if (!sender) return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    if (receiverId === sender.id || receiverId === sender.firebaseUid || receiverId === sender.username) {
      return res.status(400).json({ success: false, message: 'No puedes enviarte mensajes a ti mismo.' });
    }
    const receiver = await resolveUserByAnyId(receiverId);
    if (!receiver) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const result = await createMessage({ sender, receiver, content });
    if (!result.message) return res.status(result.status).json(result.body);
    res.json({ success: true, message: result.message });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Marcar un mensaje como leído (ruta antigua, uno por uno)
router.put('/api/messages/:id/read', authenticateToken, async (req, res) => {
  try {
    const user = await currentChatUser(req);
    const message = isUuid(req.params.id) ? await prisma.message.findUnique({ where: { id: req.params.id } }) : null;
    if (!user || !message || message.receiverId !== user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
    const now = new Date();
    await prisma.message.update({ where: { id: message.id }, data: { isRead: true, readAt: message.readAt || now, deliveredAt: message.deliveredAt || now } });
    publish(message.senderId, 'read', { partnerId: user.id });
    res.json({ success: true });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Marcar como leída toda la conversación con una persona (una sola petición)
router.post('/api/messages/:otherId/read', authenticateToken, async (req, res) => {
  try {
    const me = await currentChatUser(req);
    if (!me) return res.status(401).json({ success: false });
    const other = await resolveUserByAnyId(req.params.otherId);
    if (!other) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const updated = await prisma.$executeRaw`
      UPDATE "Message" SET "isRead" = true, "readAt" = now(), "deliveredAt" = COALESCE("deliveredAt", now())
      WHERE "senderId" = ${other.id} AND "receiverId" = ${me.id} AND "isRead" = false`;
    await prisma.chatSetting.updateMany({ where: { userId: me.id, partnerId: other.id, markedUnread: true }, data: { markedUnread: false } });
    if (updated > 0) publish(other.id, 'read', { partnerId: me.id });
    publish(me.id, 'read', { partnerId: other.id });
    touchPresence(me.id);
    res.json({ success: true, read: updated });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.post('/api/messages/:otherId/typing', authenticateToken, async (req, res) => {
  try {
    const currentUser = await currentChatUser(req);
    if (!currentUser) return res.status(401).json({ success: false });
    const otherUser = await resolveUserByAnyId(req.params.otherId);
    if (!otherUser) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (otherUser.id === currentUser.id) return res.json({ success: true });
    const typing = Boolean(req.body?.isTyping);
    if (typing) typingPresence.set(typingKey(currentUser.id, otherUser.id), Date.now() + TYPING_TTL_MS);
    else typingPresence.delete(typingKey(currentUser.id, otherUser.id));
    if (!(await messageBlockReason(currentUser.id, otherUser.id))) publish(otherUser.id, 'typing', { partnerId: currentUser.id, isTyping: typing });
    touchPresence(currentUser.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating typing status:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.get('/api/messages/:otherId/typing', authenticateToken, async (req, res) => {
  try {
    const currentUser = await currentChatUser(req);
    if (!currentUser) return res.status(401).json({ success: false });
    const otherUser = await resolveUserByAnyId(req.params.otherId);
    if (!otherUser) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const key = typingKey(otherUser.id, currentUser.id);
    const isTyping = (typingPresence.get(key) || 0) > Date.now();
    if (!isTyping) typingPresence.delete(key);
    res.json({ success: true, isTyping });
  } catch (error) {
    console.error('Error fetching typing status:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Mensajes con otra persona: los últimos (`limit`) o los anteriores a `before`. Devuelve en orden cronológico y si hay más antiguos.
router.get('/api/messages/:otherId', authenticateToken, async (req, res) => {
  try {
    const me = await currentChatUser(req);
    if (!me) return res.status(401).json({ success: false });
    const other = await resolveUserByAnyId(req.params.otherId);
    if (!other) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const limit = Math.min(PAGE_MAX, Math.max(1, Number.parseInt(req.query.limit, 10) || PAGE_DEFAULT));
    const pair = { OR: [{ senderId: me.id, receiverId: other.id }, { senderId: other.id, receiverId: me.id }] };
    let cursor = null;
    if (req.query.before !== undefined) {
      cursor = isUuid(req.query.before) ? await prisma.message.findFirst({ where: { id: req.query.before, ...pair }, select: { createdAt: true } }) : null;
      if (!cursor) return badRequest(res, 'Mensaje de referencia inválido');
    }
    const rows = await prisma.message.findMany({ where: { ...pair, ...(cursor ? { createdAt: { lt: cursor.createdAt } } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1 });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse();

    // Lo que llegó a esta persona queda como entregado y el emisor lo ve al instante
    if (!cursor) {
      const delivered = await prisma.message.updateMany({ where: { senderId: other.id, receiverId: me.id, deliveredAt: null }, data: { deliveredAt: new Date() } });
      if (delivered.count > 0) publish(other.id, 'delivered', { partnerId: me.id });
      touchPresence(me.id);
    }
    const [messages, settings, block, firstUnread] = await Promise.all([
      serializeMessages(page, { viewer: me, partner: other }),
      prisma.chatSetting.findUnique({ where: { userId_partnerId: { userId: me.id, partnerId: other.id } } }),
      prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: me.id, blockedId: other.id } }, select: { blockerId: true } }),
      cursor ? null : prisma.message.findFirst({ where: { senderId: other.id, receiverId: me.id, isRead: false }, orderBy: { createdAt: 'asc' }, select: { id: true } })
    ]);
    res.json({
      success: true, messages, hasMore, firstUnreadId: firstUnread?.id || null,
      otherUser: publicPartner(other, me),
      settings: { pinned: Boolean(settings?.pinnedAt), archived: Boolean(settings?.archivedAt), mutedUntil: settings?.mutedUntil || null, markedUnread: Boolean(settings?.markedUnread) },
      blockedByMe: Boolean(block)
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Enviar un mensaje a una persona (texto, foto, carta; puede responder a otro mensaje)
router.post('/api/messages/:otherId', authenticateToken, async (req, res) => {
  try {
    const currentUser = await currentChatUser(req);
    if (!currentUser) return res.status(401).json({ success: false });
    const otherUser = await resolveUserByAnyId(req.params.otherId);
    if (!otherUser) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const { content, replyToId } = req.body || {};
    if (!content || typeof content !== 'string') return res.status(400).json({ success: false });
    if (replyToId !== undefined && replyToId !== null && typeof replyToId !== 'string') return badRequest(res, 'Mensaje inválido');
    const result = await createMessage({ sender: currentUser, receiver: otherUser, content, replyToId });
    if (!result.message) return res.status(result.status).json(result.body);
    const [message] = await serializeMessages([result.message], { viewer: currentUser, partner: otherUser });
    res.json({ success: true, message, otherUser: { id: otherUser.id, name: otherUser.name, username: otherUser.username, photoURL: otherUser.photoURL } });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// ---------- Acciones sobre un mensaje concreto ----------
// Solo participa quien envió o recibió el mensaje; un mensaje ocultado por moderación no se ve ni se usa para quien lo recibió
const loadOwnMessage = async (req, res) => {
  const me = await currentChatUser(req);
  if (!me) { res.status(401).json({ success: false }); return null; }
  const message = isUuid(req.params.id) ? await prisma.message.findUnique({ where: { id: req.params.id } }) : null;
  if (!message || !isParticipant(message, me.id) || (message.moderationState === 'hidden' && message.senderId !== me.id)) {
    res.status(404).json({ success: false, message: 'Mensaje no encontrado' });
    return null;
  }
  return { me, message, partnerId: message.senderId === me.id ? message.receiverId : message.senderId };
};

// Reaccionar con un emoji (uno por persona; null lo quita)
router.put('/api/messages/item/:id/reaction', authenticateToken, async (req, res) => {
  try {
    const found = await loadOwnMessage(req, res);
    if (!found) return;
    const { me, message, partnerId } = found;
    const emoji = req.body?.emoji;
    if (emoji !== null && !isValidReaction(emoji)) return badRequest(res, 'Reacción inválida');
    if (emoji !== null && (await messageBlockReason(me.id, partnerId))) return res.status(403).json({ success: false, code: 'blocked', message: 'No puedes reaccionar en esta conversación.' });
    if (emoji === null) await prisma.messageReaction.deleteMany({ where: { messageId: message.id, userId: me.id } });
    else await prisma.messageReaction.upsert({ where: { messageId_userId: { messageId: message.id, userId: me.id } }, create: { messageId: message.id, userId: me.id, emoji }, update: { emoji } });
    notifyChanged(me.id, partnerId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reacting to message:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Destacar o quitar el destacado (solo lo ve quien lo destaca)
router.put('/api/messages/item/:id/star', authenticateToken, async (req, res) => {
  try {
    const found = await loadOwnMessage(req, res);
    if (!found) return;
    const { me, message } = found;
    if (typeof req.body?.starred !== 'boolean') return badRequest(res, 'Dato inválido');
    if (req.body.starred) await prisma.messageStar.upsert({ where: { messageId_userId: { messageId: message.id, userId: me.id } }, create: { messageId: message.id, userId: me.id }, update: {} });
    else await prisma.messageStar.deleteMany({ where: { messageId: message.id, userId: me.id } });
    publish(me.id, 'message', { partnerId: found.partnerId });
    res.json({ success: true, starred: req.body.starred });
  } catch (error) {
    console.error('Error starring message:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Corregir el texto de un mensaje propio durante los primeros 15 minutos (la foto o la carta no cambian)
router.put('/api/messages/item/:id', authenticateToken, async (req, res) => {
  try {
    const found = await loadOwnMessage(req, res);
    if (!found) return;
    const { me, message, partnerId } = found;
    if (message.senderId !== me.id) return res.status(403).json({ success: false, message: 'Solo puedes corregir tus mensajes.' });
    if (message.moderationState !== 'visible') return res.status(403).json({ success: false, message: 'Este mensaje no se puede corregir.' });
    if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) return res.status(409).json({ success: false, code: 'edit_window', message: 'Ya pasaron más de 15 minutos: no se puede corregir.' });
    const text = req.body?.text;
    if (typeof text !== 'string' || text.length > TEXT_MAX) return badRequest(res, 'Texto inválido');
    const body = decodeContent(message.content);
    if (body.audio) return badRequest(res, 'Un mensaje de voz no se puede corregir');
    if (!text.trim() && !body.imageUrl && !body.imageBase64 && !body.cardId) return badRequest(res, 'El mensaje no puede quedar vacío');
    if (await messageBlockReason(me.id, partnerId)) return res.status(403).json({ success: false, code: 'blocked', message: 'No puedes modificar mensajes en esta conversación.' });
    const updated = await prisma.message.update({ where: { id: message.id }, data: { content: encodeContent({ text: text.trim(), imageUrl: body.imageUrl, imageBase64: body.imageBase64, cardId: body.cardId }), editedAt: new Date() } });
    flagMessageText(updated, partnerId);
    notifyChanged(me.id, partnerId);
    const partner = await prisma.user.findUnique({ where: { id: partnerId }, select: { id: true, showReadReceipts: true } });
    const [serialized] = await serializeMessages([updated], { viewer: me, partner });
    res.json({ success: true, message: serialized });
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
