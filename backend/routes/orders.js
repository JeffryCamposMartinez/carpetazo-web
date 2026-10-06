// Pedidos: creación (stock en transacción) y gestión del vendedor.
import crypto from 'crypto';
import express from 'express';
import { getAuth } from 'firebase-admin/auth';
import { authenticateToken } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { hashConnection } from '../core/hashing.js';
import { badRequest, isUuid } from '../core/validation.js';

const router = express.Router();

const normalizeOrderItems = (items = []) => {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const quantity = Number(item.quantity ?? item.q ?? 1);
    const price = Number(item.price ?? 0);

    return {
      ...item,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      q: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      price: Number.isFinite(price) ? price : 0
    };
  });
};

const formatOrderForUi = (rawOrder) => {
  const { createdIpHash: _createdIpHash, completedIpHash: _completedIpHash, ...order } = rawOrder;
  const items = normalizeOrderItems(order.items || []);
  const createdAt = order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt;
  const updatedAt = order.updatedAt instanceof Date ? order.updatedAt.toISOString() : order.updatedAt;

  return {
    ...order,
    code: order.code || order.id,
    items,
    totalAmount: order.total,
    total: order.total,
    createdAt,
    updatedAt,
    processedAt: order.status !== 'pending' ? updatedAt : undefined
  };
};

const generateOrderCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = Array.from({ length: 5 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    const existing = await prisma.order.findUnique({ where: { code } });
    if (!existing) return code;
  }

  return crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
};

// POST create short order code

router.post('/api/orders/create', async (req, res) => {
  try {
    const body = req.body || {};
    const rawItems = Array.isArray(body.items || body.orderItems) ? (body.items || body.orderItems) : [];
    const folderId = typeof body.folderId === 'string' ? body.folderId : '';
    // "message": el pedido llega al vendedor como mensaje de Carpetazo; exige un comprador con sesión
    const viaMessage = body.via === 'message';

    if (!rawItems.length || rawItems.length > 100) {
      return res.status(400).json({ success: false, message: 'El pedido no tiene cartas' });
    }
    if (!folderId) {
      return res.status(400).json({ success: false, message: 'Carpeta requerida' });
    }

    // Con sesión, el pedido queda ligado a la cuenta del comprador (así podrá calificar al vendedor); sin sesión sigue siendo anónimo
    let buyer = null;
    const token = String(req.headers['authorization'] || '').split(' ')[1];
    if (token) {
      try {
        const decoded = await getAuth().verifyIdToken(token);
        buyer = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid }, select: { id: true, name: true, username: true } });
      } catch (_error) {
        buyer = null;
      }
    }
    if (viaMessage) {
      if (!token) return res.status(401).json({ success: false, message: 'Inicia sesión para enviar el pedido por mensaje' });
      if (!buyer) return res.status(401).json({ success: false, message: 'Tu sesión venció o tu cuenta aún se está preparando. Intenta de nuevo' });
    }

    const folder = await prisma.folder.findUnique({ where: { id: folderId }, include: { cards: { where: { moderationState: { not: 'hidden' } } } } });
    if (!folder || !folder.isPublic) {
      return res.status(404).json({ success: false, message: 'Carpeta no encontrada' });
    }

    // Datos del vendedor: tema (para saber si recibe mensajes y si comparte sus datos bancarios) y datos para transferir
    const seller = await prisma.user.findUnique({ where: { id: folder.userId }, select: { name: true, fullName: true, rut: true, bankDetails: true, publicTheme: true } });
    const sellerTheme = seller?.publicTheme && typeof seller.publicTheme === 'object' ? seller.publicTheme : {};
    // Ningún vendedor puede pedirse a sí mismo (por WhatsApp ni por mensaje)
    if (buyer && folder.userId === buyer.id) return res.status(400).json({ success: false, message: 'No puedes enviarte un pedido a ti mismo' });
    if (viaMessage) {
      if (sellerTheme.showMessageButton === 'off') return res.status(400).json({ success: false, message: 'Este vendedor no recibe pedidos por mensaje' });
    }

    // Anti-spam y reserva: los pedidos pendientes recientes de la carpeta reservan su stock y limitan cuántos puede dejar una misma persona.
    // Con cuenta reservan 7 días; sin cuenta solo 24 horas y con un cupo propio, para que pedidos anónimos no bloqueen el stock ni la carpeta.
    const reserveSince = new Date(Date.now() - ORDER_RESERVE_DAYS * 24 * 60 * 60 * 1000);
    const anonSince = Date.now() - ORDER_ANON_RESERVE_HOURS * 60 * 60 * 1000;
    const pendingOrders = (await prisma.order.findMany({ where: { folderId: folder.id, status: 'pending', createdAt: { gt: reserveSince } }, select: { items: true, createdIpHash: true, buyerId: true, createdAt: true } }))
      .filter((pending) => pending.buyerId || pending.createdAt.getTime() > anonSince);
    const anonPending = pendingOrders.filter((pending) => !pending.buyerId).length;
    if (!buyer && anonPending >= ORDER_MAX_ANON_PENDING_PER_FOLDER) {
      return res.status(429).json({ success: false, message: 'Este vendedor tiene muchos pedidos sin cuenta pendientes. Inicia sesión para hacer tu pedido.' });
    }
    if (buyer && pendingOrders.length - anonPending >= ORDER_MAX_PENDING_PER_FOLDER) {
      return res.status(429).json({ success: false, message: 'Este vendedor tiene muchos pedidos pendientes. Intenta más tarde.' });
    }
    const myConnection = hashConnection(req);
    const mine = pendingOrders.filter((pending) => pending.createdIpHash === myConnection || (buyer && pending.buyerId === buyer.id)).length;
    if (mine >= ORDER_MAX_PENDING_PER_BUYER) {
      return res.status(429).json({ success: false, message: 'Ya tienes pedidos pendientes con este vendedor. Espera a que los atienda.' });
    }
    const reserved = new Map();
    pendingOrders.forEach((pending) => normalizeOrderItems(pending.items).forEach((item) => reserved.set(String(item.id), (reserved.get(String(item.id)) || 0) + Number(item.quantity || 1))));
    const asked = new Map();

    // Nombre, precio y vendedor salen de la base de datos; del cliente solo se acepta id y cantidad
    const cardsById = new Map(folder.cards.map((card) => [card.id, card]));
    const items = [];
    const lines = [];
    let total = 0;
    const clp = (value) => '$' + Math.round(value).toLocaleString('es-CL');
    for (const raw of rawItems) {
      const card = cardsById.get(String(raw?.id ?? ''));
      if (!card) {
        return res.status(400).json({ success: false, message: 'El pedido contiene cartas que ya no están disponibles' });
      }
      const requested = Math.floor(Number(raw.quantity ?? raw.q ?? 1));
      const quantity = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 99) : 1;
      const askedTotal = (asked.get(card.id) || 0) + quantity;
      asked.set(card.id, askedTotal);
      const available = Number(card.stock || 0) - (reserved.get(card.id) || 0);
      if (askedTotal > available) {
        return res.status(409).json({ success: false, message: available <= 0 ? `"${card.name}" ya no está disponible` : `Solo quedan ${available} de "${card.name}"` });
      }
      const price = Number.isFinite(card.price) && card.price > 0 ? card.price : 0;
      total += price * quantity;
      // `tcgId` queda en el pedido para poder calcular el precio referencial de ventas aunque la carta se borre después
      items.push({ id: card.id, tcgId: card.tcgId, name: card.name, quantity, q: quantity, price });
      const set = card.data && typeof card.data === 'object' && typeof card.data.set === 'string' && card.data.set !== 'Unknown' ? ` (${card.data.set.slice(0, 60)})` : '';
      lines.push(`• ${quantity}x ${card.name}${set} - ${clp(price * quantity)}`);
    }

    // Datos para transferir: solo si el vendedor lo activó (por defecto no se envían), y solo a quien acaba de crear un pedido, nunca en rutas públicas
    const bank = seller?.bankDetails && typeof seller.bankDetails === 'object' ? seller.bankDetails : {};
    const payment = bank.accountNumber && sellerTheme.shareBankInOrders === 'on'
      ? { holderName: seller.fullName || seller.name || '', rut: seller.rut || '', bank: bank.bank || '', accountType: bank.accountType || '', accountNumber: bank.accountNumber }
      : null;

    const code = await generateOrderCode();
    const orderData = {
      code,
      sellerId: folder.userId,
      buyerName: viaMessage ? String(buyer.name || buyer.username || 'Cliente').slice(0, 80) : 'Cliente por WhatsApp',
      buyerId: buyer ? buyer.id : null,
      createdIpHash: hashConnection(req),
      folderId: folder.id,
      folderName: folder.name || 'Catálogo',
      items,
      total,
      status: 'pending'
    };

    let order;
    if (viaMessage) {
      const text = [
        `¡Hola! Te hice un pedido desde tu carpeta "${folder.name || 'Catálogo'}" en Carpetazo:`,
        '',
        ...lines,
        '',
        `Total: ${clp(total)}`,
        `Código de pedido: ${code}`,
        ...(payment ? ['', 'Datos para transferir:', [payment.holderName, payment.rut, payment.bank, payment.accountType, payment.accountNumber].filter(Boolean).join('\n')] : []),
        '',
        payment ? '¿Tienes disponibilidad?' : '¿Tienes disponibilidad? ¿Me compartes los datos para transferir?'
      ].join('\n');
      // Pedido y mensaje se crean juntos: no puede quedar uno sin el otro
      [order] = await prisma.$transaction([
        prisma.order.create({ data: orderData }),
        prisma.message.create({ data: { senderId: buyer.id, receiverId: folder.userId, content: JSON.stringify({ v: 1, text, imageUrl: null, imageBase64: null }) } })
      ]);
    } else {
      order = await prisma.order.create({ data: orderData });
    }

    res.json({ success: true, code, order: formatOrderForUi(order), payment, viaMessage });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: 'Error interno al crear el pedido' });
  }
});
const ORDER_RESERVE_DAYS = 7; // un pedido pendiente de un comprador con cuenta reserva su stock hasta por una semana
const ORDER_ANON_RESERVE_HOURS = 24; // uno sin cuenta, solo un día
const ORDER_MAX_PENDING_PER_FOLDER = 50;
const ORDER_MAX_ANON_PENDING_PER_FOLDER = 15;
const ORDER_MAX_PENDING_PER_BUYER = 3;

// --- Pedidos del vendedor: solo ve y gestiona los pedidos de sus propias carpetas ---
const getSellerId = async (req) => {
  const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
  return user?.id || null;
};

router.get('/api/orders/mine', authenticateToken, async (req, res) => {
  try {
    const sellerId = await getSellerId(req);
    if (!sellerId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const orders = await prisma.order.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      take: 1000
    });

    // Imagen, edición, número e idioma actuales de cada carta del pedido
    const cardIds = [...new Set(orders.flatMap((order) => normalizeOrderItems(order.items).map((item) => String(item.id || ''))).filter(isUuid))];
    const cards = cardIds.length
      ? await prisma.card.findMany({ where: { id: { in: cardIds } }, select: { id: true, imageUrl: true, stock: true, data: true } })
      : [];
    const cardsById = new Map(cards.map((card) => [card.id, card]));

    res.json({
      success: true,
      orders: orders.map((order) => {
        const formatted = formatOrderForUi(order);
        return {
          ...formatted,
          items: formatted.items.map((item) => {
            const card = cardsById.get(String(item.id || ''));
            const cardData = card?.data && typeof card.data === 'object' ? card.data : {};
            return {
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              imageUrl: card?.imageUrl || null,
              set: cardData.set || '',
              number: cardData.number || '',
              language: cardData.language || '',
              stockNow: card ? card.stock : null
            };
          })
        };
      })
    });
  } catch (error) {
    console.error('Error loading seller orders:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Solicitudes de compra pendientes del vendedor: consulta liviana para la campana de notificaciones
router.get('/api/orders/mine/pending', authenticateToken, async (req, res) => {
  try {
    const sellerId = await getSellerId(req);
    if (!sellerId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const where = { sellerId, status: 'pending' };
    // "since": fecha (ISO) hasta la que el vendedor ya vio sus solicitudes en la campana
    const sinceRaw = typeof req.query.since === 'string' && req.query.since.length <= 40 ? new Date(req.query.since) : null;
    const since = sinceRaw && !Number.isNaN(sinceRaw.getTime()) ? sinceRaw : null;
    const [count, unseen, latest] = await Promise.all([
      prisma.order.count({ where }),
      since ? prisma.order.count({ where: { ...where, createdAt: { gt: since } } }) : null,
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, code: true, folderName: true, total: true, items: true, createdAt: true }
      })
    ]);

    // Con ETag: si nada cambió responde 304 sin cuerpo
    res.set('Cache-Control', 'private, no-cache');
    res.json({
      success: true,
      count,
      unseen: unseen === null ? count : unseen,
      orders: latest.map((order) => ({
        id: order.id,
        code: order.code,
        folderName: order.folderName,
        total: order.total,
        cards: normalizeOrderItems(order.items).reduce((sum, item) => sum + Number(item.quantity || 1), 0),
        createdAt: order.createdAt
      }))
    });
  } catch (error) {
    console.error('Error loading pending orders:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.post('/api/orders/mine/:id/status', authenticateToken, async (req, res) => {
  try {
    const status = req.body?.status;
    if (!['completed', 'rejected'].includes(status)) {
      return badRequest(res, 'Estado inválido');
    }

    const sellerId = await getSellerId(req);
    const order = isUuid(req.params.id) ? await prisma.order.findUnique({ where: { id: req.params.id } }) : null;
    if (!order || !sellerId || order.sellerId !== sellerId) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
    if (order.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'Este pedido ya fue gestionado' });
    }

    // Completar descuenta el stock de las cartas de la carpeta en la misma transacción.
    // El cambio de estado se reclama primero (solo si sigue pendiente): dos clics simultáneos no descuentan el stock dos veces.
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({ where: { id: order.id, status: 'pending' }, data: { status } });
      if (claimed.count === 0) return null;
      if (status === 'completed') {
        for (const item of normalizeOrderItems(order.items)) {
          const id = String(item.id || '');
          if (!isUuid(id)) continue;
          const card = await tx.card.findFirst({ where: { id, folderId: order.folderId } });
          if (!card) continue;
          await tx.card.update({ where: { id }, data: { stock: Math.max(0, Number(card.stock || 0) - Number(item.quantity || 1)) } });
        }
      }
      return tx.order.update({ where: { id: order.id }, data: { status, ...(status === 'completed' ? { completedIpHash: hashConnection(req) } : {}) } });
    });
    if (!updated) return res.status(409).json({ success: false, message: 'Este pedido ya fue gestionado' });

    res.json({ success: true, order: formatOrderForUi(updated) });
  } catch (error) {
    console.error('Error updating seller order:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
