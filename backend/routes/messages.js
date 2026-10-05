// Mensajes y chats.
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { badRequest, isAllowedStoredImageUrl, isShortText } from '../core/validation.js';
import { moderationHooks } from '../moderation/services.js';

const router = express.Router();

// Bloqueo entre usuarios: devuelve el motivo si no se puede escribir, o null
const messageBlockReason = async (senderId, receiverId) => {
  const rows = await prisma.userBlock.findMany({ where: { OR: [{ blockerId: receiverId, blockedId: senderId }, { blockerId: senderId, blockedId: receiverId }] }, select: { blockerId: true } });
  if (rows.some((row) => row.blockerId === senderId)) return 'Bloqueaste a esta persona. Desbloquéala para escribirle.';
  if (rows.length) return 'No puedes enviarle mensajes a esta persona.';
  return null;
};

// Enviar un mensaje
router.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const sender = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const { receiverId, content } = req.body;
    
    if (!receiverId || !content) return res.status(400).json({ success: false, message: 'Missing fields' });
    if (typeof receiverId !== 'string' || !isAllowedMessageContent(content)) return badRequest(res, 'Mensaje inválido');
    if (!sender) return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    if (receiverId === sender.id || receiverId === sender.firebaseUid || receiverId === sender.username) {
      return res.status(400).json({ success: false, message: 'No puedes enviarte mensajes a ti mismo.' });
    }
    
    const receiver = await resolveUserByAnyId(receiverId);
    if (!receiver) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (receiver.id === sender.id) return res.status(400).json({ success: false, message: 'No puedes enviarte mensajes a ti mismo.' });
    const blockedReason = await messageBlockReason(sender.id, receiver.id);
    if (blockedReason) return res.status(403).json({ success: false, code: 'blocked', message: blockedReason });

    const message = await prisma.message.create({
      data: {
        senderId: sender.id,
        receiverId: receiver.id,
        content
      }
    });
    flagMessageText(message, receiver.id);
    res.json({ success: true, message });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Marcar mensaje como ledo
router.put('/api/messages/:id/read', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    
    if (!user || !message || message.receiverId !== user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    await prisma.message.update({
      where: { id: req.params.id },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});


// Contenido de un mensaje: texto plano o {v, text, imageUrl, imageBase64}. La imagen solo de hosts permitidos
// (una URL cualquiera dejaría a quien envía ver la IP de quien lee) o una imagen embebida en base64.
const isAllowedMessageContent = (content) => {
  if (!isShortText(content, 1500000)) return false;
  let body;
  try { body = JSON.parse(content); } catch (_error) { return true; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return true;
  if (body.imageUrl && !isAllowedStoredImageUrl(body.imageUrl)) return false;
  if (body.imageBase64 && !/^data:image[/](png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(String(body.imageBase64))) return false;
  return body.text === undefined || body.text === null || typeof body.text === 'string';
};

const resolveUserByAnyId = async (identifier) => {
  const value = String(identifier || '').trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  const where = [{ firebaseUid: value }, { username: value }];
  if (isUuid) where.push({ id: value });
  return prisma.user.findFirst({ where: { OR: where } });
};

const typingPresence = new Map();
const TYPING_TTL_MS = 4500;

const typingKey = (senderId, receiverId) => `${senderId}:${receiverId}`;

router.post('/api/messages/:otherId/typing', authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    if (!currentUser) return res.status(401).json({ success: false });

    const otherUser = await resolveUserByAnyId(req.params.otherId);
    if (!otherUser) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (otherUser.id === currentUser.id) return res.json({ success: true });

    const key = typingKey(currentUser.id, otherUser.id);
    if (req.body?.isTyping) {
      typingPresence.set(key, Date.now() + TYPING_TTL_MS);
    } else {
      typingPresence.delete(key);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating typing status:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.get('/api/messages/:otherId/typing', authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    if (!currentUser) return res.status(401).json({ success: false });

    const otherUser = await resolveUserByAnyId(req.params.otherId);
    if (!otherUser) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const key = typingKey(otherUser.id, currentUser.id);
    const expiresAt = typingPresence.get(key) || 0;
    const isTyping = expiresAt > Date.now();
    if (!isTyping) typingPresence.delete(key);
    res.json({ success: true, isTyping });
  } catch (error) {
    console.error('Error fetching typing status:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// GET messages between current user and another
router.get('/api/messages/:otherId', authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    if (!currentUser) return res.status(401).json({ success: false });

    const otherUser = await resolveUserByAnyId(req.params.otherId);
    if (!otherUser) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const otherId = otherUser.id;
    
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUser.id, receiverId: otherId },
          { senderId: otherId, receiverId: currentUser.id }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });
    
    // Un mensaje ocultado por moderación no se muestra a quien lo recibió (el autor sigue viendo el suyo)
    const shown = messages.map(({ moderationState, ...message }) => (moderationState === 'hidden' && message.senderId !== currentUser.id
      ? { ...message, content: HIDDEN_MESSAGE_TEXT, hidden: true }
      : message));
    res.json({ success: true, messages: shown });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// POST new message
router.post('/api/messages/:otherId', authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    if (!currentUser) return res.status(401).json({ success: false });

    const otherUser = await resolveUserByAnyId(req.params.otherId);
    if (!otherUser) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const otherId = otherUser.id;
    const { content } = req.body;
    
    if (!content) return res.status(400).json({ success: false });
    if (!isAllowedMessageContent(content)) return badRequest(res, 'Mensaje inválido');
    if (otherId === currentUser.id) {
      return res.status(400).json({ success: false, message: 'No puedes enviarte mensajes a ti mismo.' });
    }
    const blockedReason = await messageBlockReason(currentUser.id, otherId);
    if (blockedReason) return res.status(403).json({ success: false, code: 'blocked', message: blockedReason });

    const message = await prisma.message.create({
      data: {
        senderId: currentUser.id,
        receiverId: otherId,
        content
      }
    });
    flagMessageText(message, otherId);
    
    res.json({
      success: true,
      message,
      otherUser: {
        id: otherUser.id,
        name: otherUser.name,
        username: otherUser.username,
        photoURL: otherUser.photoURL
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

const HIDDEN_MESSAGE_TEXT = 'Mensaje oculto por moderación';

// Los mensajes se guardan como JSON { v: 1, text }: se revisa solo el texto, buscando cobros por adelantado o enlaces sospechosos
const flagMessageText = (message, receiverId) => {
  let text = message.content;
  try {
    const parsed = JSON.parse(message.content);
    if (parsed && typeof parsed === 'object' && parsed.v === 1) text = parsed.text || '';
  } catch (_error) {
    // texto plano
  }
  if (typeof text === 'string' && text) moderationHooks.flagText?.('message', message.id, text, 'message', receiverId);
};

// GET user chats: último mensaje con cada persona y no leídos, resueltos en la base (sin traer todo el historial)
router.get('/api/chats', authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    if (!currentUser) return res.status(401).json({ success: false });

    const [lastMessages, unreadRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT * FROM (
          SELECT DISTINCT ON (m.partner) m."id", m."senderId", m."receiverId", m."content", m."moderationState", m."isRead", m."createdAt"
          FROM (
            SELECT *, CASE WHEN "senderId" = ${currentUser.id} THEN "receiverId" ELSE "senderId" END AS partner
            FROM "Message"
            WHERE "senderId" = ${currentUser.id} OR "receiverId" = ${currentUser.id}
          ) m
          WHERE m.partner <> ${currentUser.id}
          ORDER BY m.partner, m."createdAt" DESC
        ) last
        ORDER BY "createdAt" DESC`,
      prisma.message.groupBy({ by: ['senderId'], where: { receiverId: currentUser.id, isRead: false, senderId: { not: currentUser.id } }, _count: { _all: true } })
    ]);

    const unreadCounts = new Map(unreadRows.map((row) => [row.senderId, row._count._all]));
    const totalUnread = [...unreadCounts.values()].reduce((total, count) => total + count, 0);
    const partnerIds = lastMessages.map((msg) => (msg.senderId === currentUser.id ? msg.receiverId : msg.senderId));
    const users = partnerIds.length
      ? await prisma.user.findMany({ where: { id: { in: partnerIds } }, select: { id: true, name: true, username: true, photoURL: true } })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    const enrichedChats = lastMessages.map((msg) => {
      const partnerId = msg.senderId === currentUser.id ? msg.receiverId : msg.senderId;
      const partner = usersById.get(partnerId) || {};
      const { moderationState, ...chatMessage } = msg;
      const hiddenForMe = moderationState === 'hidden' && msg.senderId !== currentUser.id;
      return { ...chatMessage, ...(hiddenForMe ? { content: HIDDEN_MESSAGE_TEXT, hidden: true } : {}), unreadCount: unreadCounts.get(partnerId) || 0, partner, otherUser: partner };
    });

    res.json({ success: true, chats: enrichedChats, totalUnread });
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
