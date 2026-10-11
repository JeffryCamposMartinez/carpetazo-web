// Lista de conversaciones y todo lo que pasa entre ellas: ajustes por chat, búsqueda, destacados, reenvío, fotos compartidas,
// privacidad y la conexión de eventos en tiempo real.
import express from 'express';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import {
  HIDDEN_MESSAGE_TEXT, createMessage, currentChatUser, decodeContent, isParticipant, notifyChanged, resolveUserByAnyId, serializeMessages, touchPresence
} from '../core/chat.js';
import { addStream, publish, removeStream } from '../core/chatEvents.js';
import { likePattern } from '../core/listing.js';
import { badRequest, isUuid } from '../core/validation.js';

const router = express.Router();
const PARTNER_SELECT = { id: true, name: true, username: true, photoURL: true, showReadReceipts: true };
const FOREVER = new Date('2100-01-01T00:00:00Z');
const MUTE_FOR = { '8h': 8 * 60 * 60 * 1000, '1w': 7 * 24 * 60 * 60 * 1000 };
const PIN_MAX = 3;
const FORWARD_MAX = 5;
const STREAM_MAX_MS = 9 * 60 * 1000; // la conexión se renueva sola: así también se vuelve a comprobar la sesión
const HEARTBEAT_MS = 25 * 1000;

const isMuted = (setting) => Boolean(setting?.mutedUntil && new Date(setting.mutedUntil) > new Date());
const pairWhere = (a, b) => ({ OR: [{ senderId: a, receiverId: b }, { senderId: b, receiverId: a }] });
const hasConversation = async (a, b) => Boolean(await prisma.message.findFirst({ where: pairWhere(a, b), select: { id: true } }));
const publicPerson = (user) => ({ id: user.id, name: user.name, username: user.username, photoURL: user.photoURL });

// Conversaciones: una por persona, último mensaje, no leídos y ajustes, resueltos en la base (sin traer todo el historial)
router.get('/api/chats', authenticateToken, async (req, res) => {
  try {
    const me = await currentChatUser(req);
    if (!me) return res.status(401).json({ success: false });
    touchPresence(me.id);

    // Lo que ya llegó a esta app queda como entregado (✓✓ gris para quien lo envió)
    const delivered = await prisma.$queryRaw`UPDATE "Message" SET "deliveredAt" = now() WHERE "receiverId" = ${me.id} AND "deliveredAt" IS NULL RETURNING "senderId"`;
    for (const senderId of new Set(delivered.map((row) => row.senderId))) publish(senderId, 'delivered', { partnerId: me.id });

    const [lastMessages, unreadRows, settingsRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT * FROM (
          SELECT DISTINCT ON (m.partner) m."id", m."senderId", m."receiverId", m."content", m."moderationState", m."isRead", m."deliveredAt", m."readAt", m."forwarded", m."createdAt"
          FROM (
            SELECT *, CASE WHEN "senderId" = ${me.id} THEN "receiverId" ELSE "senderId" END AS partner
            FROM "Message"
            WHERE "senderId" = ${me.id} OR "receiverId" = ${me.id}
          ) m
          WHERE m.partner <> ${me.id}
          ORDER BY m.partner, m."createdAt" DESC
        ) last
        ORDER BY "createdAt" DESC`,
      prisma.message.groupBy({ by: ['senderId'], where: { receiverId: me.id, isRead: false, senderId: { not: me.id } }, _count: { _all: true } }),
      prisma.chatSetting.findMany({ where: { userId: me.id } })
    ]);

    const unreadCounts = new Map(unreadRows.map((row) => [row.senderId, row._count._all]));
    const settingsBy = new Map(settingsRows.map((row) => [row.partnerId, row]));
    const partnerIds = lastMessages.map((msg) => (msg.senderId === me.id ? msg.receiverId : msg.senderId));
    const users = partnerIds.length ? await prisma.user.findMany({ where: { id: { in: partnerIds } }, select: PARTNER_SELECT }) : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    const all = lastMessages.map((msg) => {
      const partnerId = msg.senderId === me.id ? msg.receiverId : msg.senderId;
      const partner = usersById.get(partnerId) || {};
      const setting = settingsBy.get(partnerId);
      const { moderationState, ...chatMessage } = msg;
      const mine = msg.senderId === me.id;
      const hiddenForMe = moderationState === 'hidden' && !mine;
      const receipts = Boolean(me.showReadReceipts && partner.showReadReceipts !== false);
      const { showReadReceipts: _hidden, ...publicPartner } = partner;
      return {
        ...chatMessage,
        ...(hiddenForMe ? { content: HIDDEN_MESSAGE_TEXT, hidden: true } : {}),
        ...(mine && !receipts ? { isRead: false, readAt: null } : {}),
        lastFromMe: mine,
        unreadCount: unreadCounts.get(partnerId) || 0,
        pinned: Boolean(setting?.pinnedAt), pinnedAt: setting?.pinnedAt || null, archived: Boolean(setting?.archivedAt),
        muted: isMuted(setting), mutedUntil: isMuted(setting) ? setting.mutedUntil : null, markedUnread: Boolean(setting?.markedUnread),
        partner: publicPartner, otherUser: publicPartner
      };
    });

    const visible = all.filter((chat) => !chat.archived);
    const archived = all.filter((chat) => chat.archived);
    const wantsArchived = req.query.archived === '1';
    const chats = (wantsArchived ? archived : visible).sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (a.pinned && b.pinned ? new Date(b.pinnedAt) - new Date(a.pinnedAt) : 0) || (new Date(b.createdAt) - new Date(a.createdAt)));
    // Los chats silenciados y los archivados no suman a la burbuja de mensajes sin leer
    const totalUnread = visible.filter((chat) => !chat.muted).reduce((total, chat) => total + chat.unreadCount, 0);
    res.json({
      success: true, chats, totalUnread,
      archivedCount: archived.length, archivedUnread: archived.reduce((total, chat) => total + chat.unreadCount, 0),
      privacy: { showLastSeen: me.showLastSeen, showReadReceipts: me.showReadReceipts }
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Conexión de eventos en tiempo real (SSE). Va con la sesión en el encabezado, así que el cliente usa fetch y no EventSource.
router.get('/api/chats/stream', authenticateToken, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
    if (!me) return res.status(401).json({ success: false });
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 4000\nevent: ready\ndata: {}\n\n');
    addStream(me.id, res);
    touchPresence(me.id, true);
    const beat = setInterval(() => { try { res.write(': ping\n\n'); } catch (_error) { /* se cierra solo */ } }, HEARTBEAT_MS);
    const stop = setTimeout(() => res.end(), STREAM_MAX_MS);
    req.on('close', () => {
      clearInterval(beat);
      clearTimeout(stop);
      removeStream(me.id, res);
      touchPresence(me.id, true); // la última conexión queda anotada al cerrar
    });
  } catch (error) {
    console.error('Error opening chat stream:', error);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Privacidad del chat: última conexión y confirmaciones de lectura (recíprocas, como en WhatsApp)
router.put('/api/chats/privacy', authenticateToken, async (req, res) => {
  try {
    const me = await currentChatUser(req);
    if (!me) return res.status(401).json({ success: false });
    const { showLastSeen, showReadReceipts } = req.body || {};
    if ((showLastSeen !== undefined && typeof showLastSeen !== 'boolean') || (showReadReceipts !== undefined && typeof showReadReceipts !== 'boolean')) return badRequest(res, 'Datos inválidos');
    const updated = await prisma.user.update({
      where: { id: me.id },
      data: { ...(showLastSeen !== undefined ? { showLastSeen } : {}), ...(showReadReceipts !== undefined ? { showReadReceipts } : {}) },
      select: { showLastSeen: true, showReadReceipts: true }
    });
    res.json({ success: true, privacy: updated });
  } catch (error) {
    console.error('Error saving chat privacy:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Buscar: personas con las que ya conversas y texto dentro de los mensajes (de todos los chats o de uno)
router.get('/api/chats/search', authenticateToken, async (req, res) => {
  try {
    const me = await currentChatUser(req);
    if (!me) return res.status(401).json({ success: false });
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2 || q.length > 60) return badRequest(res, 'Escribe entre 2 y 60 letras');
    const partner = req.query.partner ? await resolveUserByAnyId(req.query.partner) : null;
    if (req.query.partner && !partner) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const pattern = likePattern(q);
    const needle = q.toLowerCase();

    const rows = partner
      ? await prisma.$queryRaw`SELECT m."id", m."senderId", m."receiverId", m."content", m."moderationState", m."createdAt" FROM "Message" m
          WHERE ((m."senderId" = ${me.id} AND m."receiverId" = ${partner.id}) OR (m."senderId" = ${partner.id} AND m."receiverId" = ${me.id})) AND m."content" ILIKE ${pattern}
          ORDER BY m."createdAt" DESC LIMIT 200`
      : await prisma.$queryRaw`SELECT m."id", m."senderId", m."receiverId", m."content", m."moderationState", m."createdAt" FROM "Message" m
          WHERE (m."senderId" = ${me.id} OR m."receiverId" = ${me.id}) AND m."senderId" <> m."receiverId" AND m."content" ILIKE ${pattern}
          ORDER BY m."createdAt" DESC LIMIT 200`;
    const matches = [];
    for (const row of rows) {
      if (row.moderationState === 'hidden' && row.senderId !== me.id) continue;
      const { text } = decodeContent(row.content);
      const at = text.toLowerCase().indexOf(needle);
      if (at === -1) continue; // coincidió con una parte del formato interno, no con el texto
      const start = Math.max(0, at - 30);
      matches.push({ id: row.id, partnerId: row.senderId === me.id ? row.receiverId : row.senderId, fromMe: row.senderId === me.id, createdAt: row.createdAt, snippet: `${start > 0 ? '…' : ''}${text.slice(start, at + needle.length + 60)}${text.length > at + needle.length + 60 ? '…' : ''}` });
      if (matches.length >= 40) break;
    }

    let people = [];
    if (!partner) {
      const partnerRows = await prisma.$queryRaw`SELECT DISTINCT CASE WHEN "senderId" = ${me.id} THEN "receiverId" ELSE "senderId" END AS id FROM "Message" WHERE "senderId" = ${me.id} OR "receiverId" = ${me.id} LIMIT 500`;
      people = await prisma.user.findMany({ where: { id: { in: partnerRows.map((row) => row.id).filter((id) => id !== me.id) }, OR: [{ name: { contains: q, mode: 'insensitive' } }, { username: { contains: q, mode: 'insensitive' } }] }, select: PARTNER_SELECT, take: 20 });
    }
    const personIds = [...new Set(matches.map((match) => match.partnerId))];
    const owners = personIds.length ? await prisma.user.findMany({ where: { id: { in: personIds } }, select: PARTNER_SELECT }) : [];
    const ownerById = new Map(owners.map((user) => [user.id, publicPerson(user)]));
    res.json({ success: true, people: people.map(publicPerson), messages: matches.map((match) => ({ ...match, partner: ownerById.get(match.partnerId) || null })) });
  } catch (error) {
    console.error('Error searching chats:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Mensajes destacados de la persona (de todos los chats o de uno)
router.get('/api/chats/starred', authenticateToken, async (req, res) => {
  try {
    const me = await currentChatUser(req);
    if (!me) return res.status(401).json({ success: false });
    const partner = req.query.partner ? await resolveUserByAnyId(req.query.partner) : null;
    if (req.query.partner && !partner) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const stars = await prisma.messageStar.findMany({
      where: { userId: me.id, ...(partner ? { message: pairWhere(me.id, partner.id) } : {}) },
      orderBy: { createdAt: 'desc' }, take: 100, include: { message: true }
    });
    const messages = stars.map((star) => star.message).filter((message) => isParticipant(message, me.id) && !(message.moderationState === 'hidden' && message.senderId !== me.id));
    const serialized = await serializeMessages(messages, { viewer: me, partner });
    const partnerIds = [...new Set(messages.map((message) => (message.senderId === me.id ? message.receiverId : message.senderId)))];
    const people = partnerIds.length ? await prisma.user.findMany({ where: { id: { in: partnerIds } }, select: PARTNER_SELECT }) : [];
    const personById = new Map(people.map((user) => [user.id, publicPerson(user)]));
    res.json({ success: true, messages: serialized.map((message) => ({ ...message, partner: personById.get(message.senderId === me.id ? message.receiverId : message.senderId) || null })) });
  } catch (error) {
    console.error('Error loading starred messages:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Reenviar un mensaje a otras conversaciones (hasta 5, solo con personas con las que ya hay conversación)
router.post('/api/chats/forward', authenticateToken, async (req, res) => {
  try {
    const me = await currentChatUser(req);
    if (!me) return res.status(401).json({ success: false });
    const { messageId, to } = req.body || {};
    if (!isUuid(messageId) || !Array.isArray(to) || to.length < 1 || to.length > FORWARD_MAX || !to.every(isUuid)) return badRequest(res, 'Datos inválidos');
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message || !isParticipant(message, me.id) || (message.moderationState === 'hidden' && message.senderId !== me.id)) return res.status(404).json({ success: false, message: 'Mensaje no encontrado' });
    const results = [];
    for (const id of [...new Set(to)]) {
      const receiver = id === me.id ? null : await prisma.user.findUnique({ where: { id } });
      if (!receiver || receiver.role === 'deleted' || !(await hasConversation(me.id, receiver.id))) { results.push({ to: id, ok: false, message: 'No puedes reenviar a esta persona.' }); continue; }
      const result = await createMessage({ sender: me, receiver, content: message.content, forwarded: true });
      results.push(result.message ? { to: id, ok: true } : { to: id, ok: false, message: result.body.message });
    }
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error forwarding message:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Fijar, archivar, silenciar o marcar como no leída una conversación
router.put('/api/chats/:otherId/settings', authenticateToken, async (req, res) => {
  try {
    const me = await currentChatUser(req);
    if (!me) return res.status(401).json({ success: false });
    const other = await resolveUserByAnyId(req.params.otherId);
    if (!other || other.id === me.id || !(await hasConversation(me.id, other.id))) return res.status(404).json({ success: false, message: 'Conversación no encontrada' });
    const { pinned, archived, muted, markedUnread } = req.body || {};
    if ((pinned !== undefined && typeof pinned !== 'boolean') || (archived !== undefined && typeof archived !== 'boolean') || (markedUnread !== undefined && typeof markedUnread !== 'boolean')
      || (muted !== undefined && muted !== null && !['8h', '1w', 'always'].includes(muted))) return badRequest(res, 'Datos inválidos');

    const current = await prisma.chatSetting.findUnique({ where: { userId_partnerId: { userId: me.id, partnerId: other.id } } });
    const data = {};
    if (pinned === true && !current?.pinnedAt) {
      if ((await prisma.chatSetting.count({ where: { userId: me.id, pinnedAt: { not: null } } })) >= PIN_MAX) return res.status(409).json({ success: false, code: 'pin_limit', message: `Solo puedes fijar ${PIN_MAX} conversaciones.` });
      data.pinnedAt = new Date();
    }
    if (pinned === false) data.pinnedAt = null;
    if (archived !== undefined) { data.archivedAt = archived ? new Date() : null; if (archived) data.pinnedAt = null; } // archivar quita lo fijado
    if (muted !== undefined) data.mutedUntil = muted === null ? null : muted === 'always' ? FOREVER : new Date(Date.now() + MUTE_FOR[muted]);
    if (markedUnread !== undefined) data.markedUnread = markedUnread;
    const saved = await prisma.chatSetting.upsert({ where: { userId_partnerId: { userId: me.id, partnerId: other.id } }, create: { userId: me.id, partnerId: other.id, ...data }, update: data });
    publish(me.id, 'settings', { partnerId: other.id });
    res.json({ success: true, settings: { pinned: Boolean(saved.pinnedAt), archived: Boolean(saved.archivedAt), muted: isMuted(saved), mutedUntil: isMuted(saved) ? saved.mutedUntil : null, markedUnread: saved.markedUnread } });
  } catch (error) {
    console.error('Error saving chat settings:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Fotos compartidas en la conversación
router.get('/api/chats/:otherId/media', authenticateToken, async (req, res) => {
  try {
    const me = await currentChatUser(req);
    if (!me) return res.status(401).json({ success: false });
    const other = await resolveUserByAnyId(req.params.otherId);
    if (!other) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const rows = await prisma.message.findMany({
      where: { AND: [pairWhere(me.id, other.id), { content: { contains: '"imageUrl":"https://' } }, { OR: [{ moderationState: 'visible' }, { senderId: me.id }] }] },
      orderBy: { createdAt: 'desc' }, take: 60, select: { id: true, senderId: true, content: true, createdAt: true }
    });
    res.json({ success: true, media: rows.map((row) => ({ id: row.id, senderId: row.senderId, createdAt: row.createdAt, imageUrl: decodeContent(row.content).imageUrl })).filter((item) => item.imageUrl) });
  } catch (error) {
    console.error('Error loading chat media:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
