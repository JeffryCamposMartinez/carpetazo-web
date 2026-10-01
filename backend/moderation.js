// Reportes y moderación de contenido (documento 20, Fase A).
// Se registra desde server.js con las utilidades de seguridad del servidor (sesión, administrador, límites, correo).
import crypto from 'node:crypto';
import { REPORT_TARGETS, REPORT_TARGET_TYPES, findReason, publicReasons, SEVERITY_ORDER } from './reportReasons.js';

const COMMENT_MAX = 500;
const COMMENT_MIN_REQUIRED = 20;
const EXTRA_MAX = 120;
const NOTE_MAX = 1000;
const MESSAGE_CONTEXT = 30;
const SNAPSHOT_VALUE_MAX = 1_000_000;
const MIN_AGE_FOR_AUTO_HIDE_MS = 24 * 60 * 60 * 1000;
const REPORTS_PER_HOUR = 20;
const REPORTS_PER_DAY = 60;
const PAGE_SIZE = 30;
const SHORT_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ADMIN_ACTIONS = ['dismiss', 'hide', 'remove', 'restore'];
const IMAGE_TYPES = ['profile_image', 'profile_banner', 'profile_wallpaper', 'card_image', 'message_image'];
const AUTO_HIDE_TYPES = ['profile_image', 'profile_banner', 'profile_wallpaper', 'card_image'];
const SUPPORT_EMAIL = 'carpetazo.soporte@gmail.com';

const newShortCode = () => `RP-${Array.from(crypto.randomBytes(5), (byte) => SHORT_CODE_ALPHABET[byte % SHORT_CODE_ALPHABET.length]).join('')}`;
const sha256 = (text) => crypto.createHash('sha256').update(String(text)).digest('hex');
const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// Un valor grande (imagen en base64) se guarda completo si cabe; si no, solo su huella
const keepValue = (value) => {
  if (typeof value !== 'string') return value ?? null;
  return value.length > SNAPSHOT_VALUE_MAX ? { truncated: true, length: value.length, sha256: sha256(value) } : value;
};

const cleanText = (value, max) => (typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : '').slice(0, max);
const hasBadControlChars = (text) => /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text);

// Los mensajes se guardan como JSON { v: 1, text, imageUrl, imageBase64 }; los antiguos son texto plano o una imagen en base64
const messageHasImage = (content) => {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && parsed.v === 1) return Boolean(parsed.imageUrl || parsed.imageBase64);
  } catch (_error) {
    // texto plano
  }
  return /^data:image\//i.test(content);
};

const fail = (status, message) => ({ error: { status, message } });
const NOT_FOUND = fail(404, 'Contenido no encontrado');
const SELF = fail(400, 'No puedes reportar tu propio contenido');

export const registerModeration = (app, deps) => {
  const { prisma, authenticateToken, requireStaff, hooks, badRequest, isUuid, currentUserId, hashConnection, sendUserEmail, escapeHtml, reviewHideReports } = deps;

  // --- Qué se guarda como instantánea y quién puede reportar cada tipo (la decide el servidor, nunca el cliente) ---
  const resolvers = {
    async user(id, me) {
      const user = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, name: true, bio: true, facebookUrl: true, instagramUrl: true, youtubeUrl: true, createdAt: true, role: true } });
      if (!user || user.role === 'deleted' || !user.username) return NOT_FOUND;
      if (user.id === me.id) return SELF;
      return { ownerId: user.id, snapshot: { username: user.username, name: user.name, bio: user.bio, facebookUrl: user.facebookUrl, instagramUrl: user.instagramUrl, youtubeUrl: user.youtubeUrl, createdAt: user.createdAt } };
    },
    async profileField(field, id, me) {
      const user = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, role: true, [field]: true } });
      if (!user || user.role === 'deleted' || !user.username || !user[field]) return NOT_FOUND;
      if (user.id === me.id) return SELF;
      return { ownerId: user.id, snapshot: { username: user.username, field, value: keepValue(user[field]) } };
    },
    profile_image: (id, me) => resolvers.profileField('photoURL', id, me),
    profile_banner: (id, me) => resolvers.profileField('bannerBase64', id, me),
    profile_wallpaper: (id, me) => resolvers.profileField('wallpaperBase64', id, me),
    async profile_text(id, me) {
      const user = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, name: true, bio: true, facebookUrl: true, instagramUrl: true, youtubeUrl: true, role: true } });
      if (!user || user.role === 'deleted' || !user.username) return NOT_FOUND;
      if (user.id === me.id) return SELF;
      return { ownerId: user.id, snapshot: { username: user.username, name: user.name, bio: user.bio, facebookUrl: user.facebookUrl, instagramUrl: user.instagramUrl, youtubeUrl: user.youtubeUrl } };
    },
    async folder(id, me) {
      const folder = await prisma.folder.findFirst({ where: { id, isPublic: true, moderationState: 'visible' }, select: { id: true, name: true, description: true, tcg: true, userId: true, user: { select: { username: true } }, _count: { select: { cards: true } } } });
      if (!folder) return NOT_FOUND;
      if (folder.userId === me.id) return SELF;
      return { ownerId: folder.userId, snapshot: { name: folder.name, description: folder.description, tcg: folder.tcg, cardCount: folder._count.cards, ownerUsername: folder.user?.username || null } };
    },
    async card(id, me, type) {
      const card = await prisma.card.findFirst({ where: { id, moderationState: { not: 'removed' }, folder: { isPublic: true, moderationState: 'visible' } }, select: { id: true, name: true, tcgId: true, price: true, stock: true, imageUrl: true, data: true, folderId: true, folder: { select: { userId: true, name: true } } } });
      if (!card) return NOT_FOUND;
      if (type === 'card_image' && !card.imageUrl) return NOT_FOUND;
      if (card.folder.userId === me.id) return SELF;
      const images = card.data && typeof card.data === 'object' ? card.data.images ?? null : null;
      return { ownerId: card.folder.userId, snapshot: { name: card.name, tcgId: card.tcgId, price: card.price, stock: card.stock, folderId: card.folderId, folderName: card.folder.name, imageUrl: keepValue(card.imageUrl), images } };
    },
    card_image: (id, me) => resolvers.card(id, me, 'card_image'),
    async review(id, me) {
      const review = await prisma.sellerReview.findFirst({ where: { id, counts: true }, select: { id: true, rating: true, comment: true, reviewerId: true, sellerId: true, seller: { select: { username: true } }, reviewer: { select: { username: true } } } });
      if (!review) return NOT_FOUND;
      if (review.reviewerId === me.id) return SELF;
      return { ownerId: review.reviewerId, snapshot: { rating: review.rating, comment: review.comment, sellerId: review.sellerId, sellerUsername: review.seller?.username || null, reviewerUsername: review.reviewer?.username || null } };
    },
    async message(id, me, type) {
      // Solo se reporta un mensaje que recibiste; moderación ve esta instantánea y nada más de la conversación
      const message = await prisma.message.findFirst({ where: { id, receiverId: me.id }, select: { id: true, senderId: true, content: true } });
      if (!message) return NOT_FOUND;
      if (type === 'message_image' && !messageHasImage(message.content)) return fail(400, 'Tipo de reporte inválido');
      const context = await prisma.message.findMany({
        where: { OR: [{ senderId: me.id, receiverId: message.senderId }, { senderId: message.senderId, receiverId: me.id }] },
        orderBy: { createdAt: 'desc' }, take: MESSAGE_CONTEXT, select: { id: true, senderId: true, content: true, createdAt: true }
      });
      const messages = context.reverse().map((row) => ({ id: row.id, from: row.senderId === me.id ? 'reporter' : 'reported', content: keepValue(row.content), createdAt: row.createdAt, reported: row.id === message.id }));
      return { ownerId: message.senderId, snapshot: { content: keepValue(message.content), messages } };
    },
    message_image: (id, me) => resolvers.message(id, me, 'message_image'),
    async order(id, me) {
      // Solo participantes: el comprador (con cuenta) o el vendedor del pedido
      const order = await prisma.order.findUnique({ where: { id }, select: { id: true, code: true, sellerId: true, buyerId: true, folderName: true, items: true, total: true, status: true, createdAt: true, updatedAt: true, createdIpHash: true, completedIpHash: true } });
      if (!order) return NOT_FOUND;
      let reporterRole = null;
      if (order.buyerId === me.id) reporterRole = 'buyer';
      else if (order.sellerId === me.id && order.buyerId) reporterRole = 'seller';
      if (!reporterRole) return NOT_FOUND;
      const items = Array.isArray(order.items) ? order.items.slice(0, 100) : [];
      return {
        ownerId: reporterRole === 'buyer' ? order.sellerId : order.buyerId,
        reporterRole,
        snapshot: { code: order.code, folderName: order.folderName, items, total: order.total, status: order.status, createdAt: order.createdAt, updatedAt: order.updatedAt, createdIpHash: order.createdIpHash, completedIpHash: order.completedIpHash }
      };
    },
    async wishlist_item(id, me) {
      const item = await prisma.wishlistItem.findFirst({ where: { id, moderationState: 'visible' }, select: { id: true, userId: true, name: true, detail: true, note: true } });
      if (!item) return NOT_FOUND;
      if (item.userId === me.id) return SELF;
      return { ownerId: item.userId, snapshot: { name: item.name, detail: item.detail, note: item.note } };
    }
  };

  // --- Efectos de ocultar y restaurar sobre el contenido real (dentro de una transacción) ---
  const PROFILE_FIELD = { profile_image: ['photoURL', 'photo'], profile_banner: ['bannerBase64', 'banner'], profile_wallpaper: ['wallpaperBase64', 'wallpaper'] };
  const TEXT_FIELDS = ['bio', 'facebookUrl', 'instagramUrl', 'youtubeUrl'];

  // Devuelve { ok:true } o { ok:false, message } si el contenido cambió desde el reporte
  const applyHide = async (tx, report, action) => {
    const { targetType: type, targetId: id, snapshot } = report;
    if (PROFILE_FIELD[type]) {
      const [column, marker] = PROFILE_FIELD[type];
      const user = await tx.user.findUnique({ where: { id }, select: { [column]: true, moderationHidden: true } });
      if (!user) return { ok: false, message: 'El contenido ya no existe' };
      if (user[column] === null) return { ok: true };
      if (!sameValue(keepValue(user[column]), snapshot.value)) return { ok: false, message: 'La persona cambió este contenido después del reporte. Revisa el perfil y vuelve a decidir.' };
      await tx.user.update({ where: { id }, data: { [column]: null, moderationHidden: [...new Set([...(user.moderationHidden || []), marker])] } });
    } else if (type === 'profile_text') {
      const user = await tx.user.findUnique({ where: { id }, select: { username: true, name: true, bio: true, facebookUrl: true, instagramUrl: true, youtubeUrl: true, moderationHidden: true } });
      if (!user) return { ok: false, message: 'El contenido ya no existe' };
      const changed = ['name', ...TEXT_FIELDS].some((field) => !sameValue(user[field], snapshot[field]));
      if (changed) return { ok: false, message: 'La persona cambió este contenido después del reporte. Revisa el perfil y vuelve a decidir.' };
      await tx.user.update({ where: { id }, data: { name: user.username, bio: null, facebookUrl: null, instagramUrl: null, youtubeUrl: null, moderationHidden: [...new Set([...(user.moderationHidden || []), 'text'])] } });
    } else if (type === 'folder') {
      const updated = await tx.folder.updateMany({ where: { id }, data: { isPublic: false, moderationState: action === 'remove' ? 'removed' : 'hidden' } });
      if (updated.count === 0) return { ok: false, message: 'El contenido ya no existe' };
    } else if (type === 'card') {
      if (action === 'remove') {
        const deleted = await tx.card.deleteMany({ where: { id } });
        if (deleted.count === 0) return { ok: false, message: 'El contenido ya no existe' };
      } else {
        const updated = await tx.card.updateMany({ where: { id }, data: { moderationState: 'hidden' } });
        if (updated.count === 0) return { ok: false, message: 'El contenido ya no existe' };
      }
    } else if (type === 'card_image') {
      const card = await tx.card.findUnique({ where: { id }, select: { imageUrl: true, data: true } });
      if (!card) return { ok: false, message: 'El contenido ya no existe' };
      if (card.imageUrl === null) return { ok: true };
      if (!sameValue(keepValue(card.imageUrl), snapshot.imageUrl)) return { ok: false, message: 'La foto cambió después del reporte. Revisa la carta y vuelve a decidir.' };
      const data = card.data && typeof card.data === 'object' ? { ...card.data } : {};
      delete data.images;
      await tx.card.update({ where: { id }, data: { imageUrl: null, moderationState: 'image_hidden', data } });
    } else if (type === 'review') {
      if (action === 'remove') await tx.sellerReview.deleteMany({ where: { id } });
      else await tx.sellerReview.updateMany({ where: { id }, data: { counts: false, flag: 'moderated' } });
    } else if (type === 'message' || type === 'message_image') {
      await tx.message.updateMany({ where: { id }, data: { moderationState: 'hidden' } });
    } else if (type === 'wishlist_item') {
      await tx.wishlistItem.updateMany({ where: { id }, data: { moderationState: 'hidden' } });
    }
    return { ok: true };
  };

  const applyRestore = async (tx, report) => {
    const { targetType: type, targetId: id, snapshot } = report;
    if (PROFILE_FIELD[type]) {
      const [column, marker] = PROFILE_FIELD[type];
      const user = await tx.user.findUnique({ where: { id }, select: { [column]: true, moderationHidden: true } });
      if (!user) return { ok: false, message: 'El contenido ya no existe' };
      if (user[column] === null && typeof snapshot.value === 'string') await tx.user.update({ where: { id }, data: { [column]: snapshot.value, moderationHidden: (user.moderationHidden || []).filter((item) => item !== marker) } });
      else if (typeof snapshot.value !== 'string' && user[column] === null) return { ok: false, message: 'No se puede restaurar: la copia del original no se guardó completa' };
    } else if (type === 'profile_text') {
      const user = await tx.user.findUnique({ where: { id }, select: { username: true, name: true, bio: true, facebookUrl: true, instagramUrl: true, youtubeUrl: true, moderationHidden: true } });
      if (!user) return { ok: false, message: 'El contenido ya no existe' };
      const data = { moderationHidden: (user.moderationHidden || []).filter((item) => item !== 'text') };
      if (user.name === user.username && snapshot.name) data.name = snapshot.name;
      for (const field of TEXT_FIELDS) if (user[field] === null && snapshot[field]) data[field] = snapshot[field];
      await tx.user.update({ where: { id }, data });
    } else if (type === 'folder') {
      await tx.folder.updateMany({ where: { id }, data: { isPublic: true, moderationState: 'visible' } });
    } else if (type === 'card') {
      await tx.card.updateMany({ where: { id, moderationState: 'hidden' }, data: { moderationState: 'visible' } });
    } else if (type === 'card_image') {
      const card = await tx.card.findUnique({ where: { id }, select: { imageUrl: true, data: true } });
      if (!card) return { ok: false, message: 'El contenido ya no existe' };
      if (card.imageUrl === null && typeof snapshot.imageUrl === 'string') {
        const data = card.data && typeof card.data === 'object' ? { ...card.data } : {};
        if (snapshot.images) data.images = snapshot.images;
        await tx.card.update({ where: { id }, data: { imageUrl: snapshot.imageUrl, moderationState: 'visible', data } });
      } else if (card.imageUrl === null) return { ok: false, message: 'No se puede restaurar: la copia del original no se guardó completa' };
    } else if (type === 'review') {
      await tx.reviewReport.deleteMany({ where: { reviewId: id } });
      await tx.sellerReview.updateMany({ where: { id }, data: { counts: true, flag: null } });
    } else if (type === 'message' || type === 'message_image') {
      await tx.message.updateMany({ where: { id }, data: { moderationState: 'visible' } });
    } else if (type === 'wishlist_item') {
      await tx.wishlistItem.updateMany({ where: { id }, data: { moderationState: 'visible' } });
    }
    return { ok: true };
  };

  // --- Avisos por correo (solo a cuentas con los términos vigentes aceptados; sendUserEmail lo comprueba) ---
  const notifyAdminsOfCritical = async (report, label) => {
    try {
      const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true, email: true } });
      const targets = admins.filter((admin) => admin.email);
      await Promise.all(targets.map((admin) => sendUserEmail(admin.id, {
        subject: `Reporte crítico ${report.shortCode} en Carpetazo`,
        text: `Hay un reporte de gravedad crítica (${report.shortCode}): ${label}.\n\nRevísalo en https://carpetazo.cl/moderacion`,
        html: `<p>Hay un reporte de gravedad <b>crítica</b> (${escapeHtml(report.shortCode)}): ${escapeHtml(label)}.</p><p><a href="https://carpetazo.cl/moderacion">Revisarlo en Moderación</a></p>`
      })));
    } catch (error) {
      console.error('Error notifying admins:', error.message);
    }
  };

  const notifyOwnerOfAction = async (ownerId, targetType, reasonLabel, action, publicMessage = '') => {
    if (!ownerId) return;
    const object = REPORT_TARGETS[targetType]?.label || 'tu contenido';
    const verb = action === 'remove' ? 'retiramos' : 'ocultamos';
    const extraText = publicMessage ? `\n\nMensaje del equipo: ${publicMessage}` : '';
    const extraHtml = publicMessage ? `<p><b>Mensaje del equipo:</b> ${escapeHtml(publicMessage)}</p>` : '';
    await sendUserEmail(ownerId, {
      subject: 'Aviso sobre tu contenido en Carpetazo',
      text: `Hola:\n\nRevisamos un reporte y ${verb} ${object} porque podría incumplir las normas de Carpetazo (motivo: ${reasonLabel}).\n\nSi crees que fue un error, escríbenos a ${SUPPORT_EMAIL} o apela desde tu cuenta (Mi perfil → Moderación) dentro de los próximos 14 días y lo revisamos.${extraText}\n\nEquipo Carpetazo`,
      html: `<p>Hola:</p><p>Revisamos un reporte y ${verb} <b>${escapeHtml(object)}</b> porque podría incumplir las normas de Carpetazo (motivo: ${escapeHtml(reasonLabel)}).</p><p>Si crees que fue un error, escríbenos a <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> o apela desde tu cuenta (Mi perfil → Moderación) dentro de los próximos 14 días y lo revisamos.</p>${extraHtml}<p>Equipo Carpetazo</p>`
    });
  };

  const validateExtra = (reason, raw) => {
    if (raw === undefined || raw === null) raw = {};
    if (typeof raw !== 'object' || Array.isArray(raw)) return null;
    const extra = {};
    for (const field of reason.extra) {
      const value = cleanText(raw[field.key], EXTRA_MAX);
      if (hasBadControlChars(value)) return null;
      if (!value && !field.optional) return null;
      if (value) extra[field.key] = value;
    }
    return extra;
  };

  // ============ Rutas de usuarios con sesión ============
  // En un pedido las razones dependen de si quien reporta es el comprador o el vendedor
  const orderRole = async (orderId, userId) => {
    if (!isUuid(orderId || '')) return null;
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { buyerId: true, sellerId: true } });
    if (!order) return null;
    if (order.buyerId === userId) return 'buyer';
    if (order.sellerId === userId && order.buyerId) return 'seller';
    return null;
  };

  app.get('/api/reports/reasons', authenticateToken, async (req, res) => {
    try {
      const type = String(req.query.targetType || '');
      if (!REPORT_TARGET_TYPES.includes(type)) return badRequest(res, 'Tipo inválido');
      let role = null;
      if (type === 'order') {
        const userId = await currentUserId(req);
        role = userId ? await orderRole(String(req.query.targetId || ''), userId) : null;
        if (!role) return res.status(404).json({ success: false, message: 'Contenido no encontrado' });
      }
      res.json({ success: true, targetType: type, label: REPORT_TARGETS[type].label, reasons: publicReasons(type, role) });
    } catch (error) {
      console.error('Error loading report reasons:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  app.post('/api/reports', authenticateToken, async (req, res) => {
    try {
      const me = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true, role: true, createdAt: true } });
      if (!me || me.role === 'deleted') return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const { targetType, targetId, reasonCode } = body;
      if (typeof targetType !== 'string' || !REPORT_TARGET_TYPES.includes(targetType)) return badRequest(res, 'Tipo inválido');
      if (typeof targetId !== 'string' || !isUuid(targetId)) return res.status(404).json({ success: false, message: 'Contenido no encontrado' });
      const reason = typeof reasonCode === 'string' ? findReason(targetType, reasonCode) : null;
      if (!reason) return badRequest(res, 'Motivo inválido');
      if (body.comment !== undefined && body.comment !== null && typeof body.comment !== 'string') return badRequest(res, 'Comentario inválido');
      const comment = cleanText(body.comment, COMMENT_MAX);
      if (typeof body.comment === 'string' && (body.comment.length > COMMENT_MAX * 2 || hasBadControlChars(body.comment))) return badRequest(res, 'Comentario inválido');
      if (reason.requiresComment && comment.length < COMMENT_MIN_REQUIRED) return badRequest(res, `Cuéntanos un poco más (mínimo ${COMMENT_MIN_REQUIRED} caracteres)`);
      const extra = validateExtra(reason, body.extra);
      if (!extra) return badRequest(res, 'Faltan datos del reporte');

      // Límites por persona: el sistema de reportes no puede usarse como arma ni para spam
      const now = Date.now();
      const [lastHour, lastDay] = await Promise.all([
        prisma.report.count({ where: { reporterId: me.id, createdAt: { gt: new Date(now - 60 * 60 * 1000) } } }),
        prisma.report.count({ where: { reporterId: me.id, createdAt: { gt: new Date(now - 24 * 60 * 60 * 1000) } } })
      ]);
      if (lastHour >= REPORTS_PER_HOUR || lastDay >= REPORTS_PER_DAY) return res.status(429).json({ success: false, message: 'Hiciste muchos reportes seguidos. Intenta más tarde.' });

      const resolved = await resolvers[targetType](targetId, me, targetType);
      if (resolved.error) return res.status(resolved.error.status).json({ success: false, message: resolved.error.message });
      // Razón válida para el rol de quien reporta (pedidos)
      if (reason.appliesTo && reason.appliesTo !== resolved.reporterRole) return badRequest(res, 'Motivo inválido');

      const accountOldEnough = now - new Date(me.createdAt).getTime() >= MIN_AGE_FOR_AUTO_HIDE_MS;
      // Reputación de quien reporta: con muchos reportes descartados su reporte entra a la cola pero sin efecto automático
      const reputation = hooks.reporterWeight ? await hooks.reporterWeight(me.id) : { weight: 1, low: false };
      const autoHide = Boolean(reason.autoHide && AUTO_HIDE_TYPES.includes(targetType) && accountOldEnough && lastHour <= 10 && !reputation.low);

      let report = null;
      let hiddenNow = false;
      const afterCommit = [];
      for (let attempt = 0; attempt < 4 && !report; attempt += 1) {
        afterCommit.length = 0;
        try {
          report = await prisma.$transaction(async (tx) => {
            const created = await tx.report.create({
              data: {
                shortCode: newShortCode(), targetType, targetId, targetOwnerId: resolved.ownerId, reasonCode: reason.code, severity: reason.severity,
                comment: comment || null, extra: Object.keys(extra).length ? extra : undefined, reporterId: me.id, reporterRole: resolved.reporterRole || null, weight: reputation.weight, snapshot: resolved.snapshot, createdIpHash: hashConnection(req)
              }
            });
            // Estafas: el reporte se une al caso abierto contra esa persona (o abre uno)
            if (reason.fraud && resolved.ownerId && hooks.linkFraudCase) {
              const linked = await hooks.linkFraudCase(tx, created);
              if (linked?.caseId) created.caseId = linked.caseId;
              if (linked?.after) afterCommit.push(linked.after);
            }
            if (targetType === 'review') {
              // Misma regla de siempre: la reseña se oculta cuando la reportan compradores verificados distintos del vendedor
              const review = await tx.sellerReview.findUnique({ where: { id: targetId }, select: { id: true, sellerId: true } });
              await tx.reviewReport.createMany({ data: [{ reviewId: review.id, reporterId: me.id, reason: reason.code }], skipDuplicates: true });
              const reporters = await tx.reviewReport.findMany({ where: { reviewId: review.id, reporterId: { not: review.sellerId } }, select: { reporterId: true } });
              const verified = reporters.length ? await tx.order.groupBy({ by: ['buyerId'], where: { buyerId: { in: reporters.map((row) => row.reporterId) }, status: 'completed' } }) : [];
              const hide = verified.length >= reviewHideReports;
              await tx.sellerReview.update({ where: { id: review.id }, data: { flag: 'reported', ...(hide ? { counts: false } : {}) } });
              hiddenNow = hide;
            } else if (autoHide) {
              const applied = await applyHide(tx, created, 'hide');
              if (applied.ok) {
                hiddenNow = true;
                await tx.report.update({ where: { id: created.id }, data: { autoActioned: true } });
                await tx.moderationAudit.create({ data: { actorId: null, action: 'auto.hide', targetType, targetId, reportId: created.id, note: `Ocultado automáticamente (${reason.code})` } });
              }
            }
            return created;
          });
        } catch (error) {
          if (error.code === 'P2002') {
            const target = JSON.stringify(error.meta?.target || '');
            if (target.includes('shortCode')) continue;
            return res.status(409).json({ success: false, message: 'Ya enviaste este reporte' });
          }
          throw error;
        }
      }
      if (!report) throw new Error('No se pudo generar el código del reporte');
      for (const task of afterCommit) task().catch((error) => console.error('Error after report:', error.message));

      if (reason.severity === 'S1') notifyAdminsOfCritical(report, `${REPORT_TARGETS[targetType].label} — ${reason.label}`).catch(() => {});
      // Respuesta mínima: nada del contenido ni de otras personas
      res.status(201).json({ success: true, shortCode: report.shortCode, hidden: hiddenNow, reportId: report.id, allowEvidence: Boolean(reason.evidence) });
    } catch (error) {
      console.error('Error creating report:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // "Mis reportes": estado simplificado y mensaje genérico; nunca la medida que se aplicó a otra persona
  app.get('/api/reports/mine', authenticateToken, async (req, res) => {
    try {
      const userId = await currentUserId(req);
      if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      const rows = await prisma.report.findMany({ where: { reporterId: userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { shortCode: true, targetType: true, reasonCode: true, status: true, createdAt: true } });
      res.json({
        success: true,
        reports: rows.map((row) => ({
          shortCode: row.shortCode,
          about: REPORT_TARGETS[row.targetType]?.label || 'contenido',
          reason: findReason(row.targetType, row.reasonCode)?.label || 'Otro motivo',
          status: row.status === 'open' ? 'received' : 'resolved',
          createdAt: row.createdAt
        }))
      });
    } catch (error) {
      console.error('Error loading own reports:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // ============ Panel de moderación (solo administradores) ============
  const reportSummary = (row) => ({
    id: row.id,
    shortCode: row.shortCode,
    targetType: row.targetType,
    targetLabel: REPORT_TARGETS[row.targetType]?.label || row.targetType,
    targetId: row.targetId,
    reasonCode: row.reasonCode,
    reasonLabel: findReason(row.targetType, row.reasonCode)?.label || row.reasonCode,
    severity: row.severity,
    status: row.status,
    decision: row.decision,
    autoActioned: row.autoActioned,
    automatic: row.reporterId === null,
    weight: row.weight,
    comment: row.comment ? row.comment.slice(0, 160) : null,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt
  });

  const ownerCache = async (ids) => {
    const unique = [...new Set(ids.filter(Boolean))];
    const users = unique.length ? await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, username: true, name: true } }) : [];
    return new Map(users.map((user) => [user.id, user]));
  };

  app.get('/api/admin/reports', authenticateToken, requireStaff(1), async (req, res) => {
    try {
      const status = ['open', 'dismissed', 'actioned', 'all'].includes(req.query.status) ? req.query.status : 'open';
      const severity = ['S1', 'S2', 'S3', 'S4'].includes(req.query.severity) ? req.query.severity : null;
      const type = REPORT_TARGET_TYPES.includes(req.query.targetType) ? req.query.targetType : null;
      const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 40) : '';
      const page = Math.max(1, Math.min(100, Number.parseInt(req.query.page, 10) || 1));
      const where = {
        ...(status !== 'all' ? { status } : {}),
        ...(severity ? { severity } : {}),
        ...(type ? { targetType: type } : {})
      };
      if (search) {
        const owners = await prisma.user.findMany({ where: { username: { equals: search, mode: 'insensitive' } }, select: { id: true } });
        where.OR = [{ shortCode: search.toUpperCase() }, ...(owners.length ? [{ targetOwnerId: { in: owners.map((owner) => owner.id) } }] : [])];
      }
      const [rows, total, counts] = await Promise.all([
        prisma.report.findMany({ where, orderBy: [{ createdAt: 'asc' }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: { id: true, shortCode: true, targetType: true, targetId: true, targetOwnerId: true, reporterId: true, weight: true, reasonCode: true, severity: true, status: true, decision: true, autoActioned: true, comment: true, createdAt: true, decidedAt: true } }),
        prisma.report.count({ where }),
        prisma.report.groupBy({ by: ['status'], _count: { _all: true } })
      ]);
      // Más grave primero; dentro de cada gravedad, el más antiguo
      rows.sort((a, b) => (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) || (b.weight - a.weight) || (new Date(a.createdAt) - new Date(b.createdAt)));
      const owners = await ownerCache(rows.map((row) => row.targetOwnerId));
      const sameTarget = rows.length ? await prisma.report.groupBy({ by: ['targetType', 'targetId'], where: { OR: rows.map((row) => ({ targetType: row.targetType, targetId: row.targetId })), status: 'open' }, _count: { _all: true } }) : [];
      const sameMap = new Map(sameTarget.map((row) => [`${row.targetType}:${row.targetId}`, row._count._all]));
      res.json({
        success: true,
        page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), total,
        counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
        reports: rows.map((row) => ({ ...reportSummary(row), owner: owners.get(row.targetOwnerId) ? { username: owners.get(row.targetOwnerId).username, name: owners.get(row.targetOwnerId).name } : null, openForSameTarget: sameMap.get(`${row.targetType}:${row.targetId}`) || 0 }))
      });
    } catch (error) {
      console.error('Error loading reports:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  app.get('/api/admin/reports/:id', authenticateToken, requireStaff(1), async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Reporte no encontrado' });
      const report = await prisma.report.findUnique({ where: { id: req.params.id }, include: { reporter: { select: { id: true, username: true, name: true, createdAt: true } } } });
      if (!report) return res.status(404).json({ success: false, message: 'Reporte no encontrado' });
      const [related, audit, owner, reporterStats, ownerStats, evidence] = await Promise.all([
        prisma.report.findMany({ where: { targetType: report.targetType, targetId: report.targetId, id: { not: report.id } }, orderBy: { createdAt: 'desc' }, take: 20, select: { shortCode: true, reasonCode: true, targetType: true, severity: true, status: true, comment: true, createdAt: true, reporter: { select: { username: true } } } }),
        prisma.moderationAudit.findMany({ where: { OR: [{ reportId: report.id }, { targetType: report.targetType, targetId: report.targetId }] }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, actorId: true, action: true, note: true, createdAt: true, reportId: true } }),
        report.targetOwnerId ? prisma.user.findUnique({ where: { id: report.targetOwnerId }, select: { id: true, username: true, name: true, createdAt: true, moderationHidden: true } }) : null,
        report.reporterId ? prisma.report.groupBy({ by: ['status'], where: { reporterId: report.reporterId }, _count: { _all: true } }) : [],
        report.targetOwnerId ? prisma.report.groupBy({ by: ['status'], where: { targetOwnerId: report.targetOwnerId }, _count: { _all: true } }) : [],
        prisma.evidence.findMany({ where: { reportId: report.id }, orderBy: { createdAt: 'asc' }, select: { id: true, mime: true, size: true } })
      ]);
      const actors = await ownerCache(audit.map((entry) => entry.actorId));
      const asCounts = (groups) => Object.fromEntries(groups.map((group) => [group.status, group._count._all]));
      res.json({
        success: true,
        report: {
          ...reportSummary(report), comment: report.comment, extra: report.extra, snapshot: report.snapshot, decisionNote: report.decisionNote,
          caseId: report.caseId,
          reporterRole: report.reporterRole,
          evidence: req.staffLevel >= 2 ? evidence : [],
          reporter: report.reporter && req.staffLevel >= 2 ? { username: report.reporter.username, name: report.reporter.name, createdAt: report.reporter.createdAt } : null,
          allowedActions: req.staffLevel < 2 ? [] : ['user', 'order'].includes(report.targetType) ? ['dismiss'] : ADMIN_ACTIONS,
          isImage: IMAGE_TYPES.includes(report.targetType)
        },
        owner: owner ? { username: owner.username, name: owner.name, createdAt: owner.createdAt, moderationHidden: owner.moderationHidden } : null,
        ownerReports: asCounts(ownerStats),
        reporterReports: asCounts(reporterStats),
        related: related.map((row) => ({ shortCode: row.shortCode, reasonLabel: findReason(row.targetType, row.reasonCode)?.label || row.reasonCode, severity: row.severity, status: row.status, comment: row.comment, createdAt: row.createdAt, reporter: row.reporter?.username || null })),
        timeline: audit.map((entry) => ({ id: entry.id, action: entry.action, note: entry.note, createdAt: entry.createdAt, actor: entry.actorId ? (actors.get(entry.actorId)?.username || 'administrador') : 'sistema' }))
      });
    } catch (error) {
      console.error('Error loading report:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  app.post('/api/admin/reports/:id/decision', authenticateToken, requireStaff(2), async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Reporte no encontrado' });
      const action = req.body?.action;
      const note = cleanText(req.body?.note, NOTE_MAX);
      const publicMessage = cleanText(req.body?.publicMessage, 500);
      if (req.body?.publicMessage !== undefined && req.body?.publicMessage !== null && (typeof req.body.publicMessage !== 'string' || hasBadControlChars(req.body.publicMessage))) return badRequest(res, 'Mensaje inválido');
      if (!ADMIN_ACTIONS.includes(action)) return badRequest(res, 'Acción inválida');
      if (req.body?.note !== undefined && req.body?.note !== null && (typeof req.body.note !== 'string' || hasBadControlChars(req.body.note))) return badRequest(res, 'Nota inválida');
      if (action !== 'dismiss' && note.length < 5) return badRequest(res, 'Escribe el motivo de la decisión (mínimo 5 caracteres)');
      const actorId = await currentUserId(req);
      const report = await prisma.report.findUnique({ where: { id: req.params.id } });
      if (!report) return res.status(404).json({ success: false, message: 'Reporte no encontrado' });
      if (['user', 'order'].includes(report.targetType) && action !== 'dismiss') return badRequest(res, 'Las medidas sobre cuentas y pedidos se aplican como sanción desde la ficha de la persona o desde el caso.');
      if (report.status !== 'open' && action !== 'restore') return res.status(409).json({ success: false, message: 'Este reporte ya fue resuelto' });

      const outcome = await prisma.$transaction(async (tx) => {
        // Reclamo atómico: la decisión se aplica una sola vez aunque se envíe dos veces
        const open = action === 'restore' ? { status: { in: ['open', 'actioned', 'dismissed'] } } : { status: 'open' };
        const siblings = await tx.report.findMany({ where: { targetType: report.targetType, targetId: report.targetId, ...open }, select: { id: true } });
        if (siblings.length === 0 || !siblings.some((row) => row.id === report.id)) return { conflict: true };
        if (action === 'hide' || action === 'remove') {
          const applied = await applyHide(tx, report, action);
          if (!applied.ok) return { failed: applied.message };
        } else if (action === 'restore') {
          const applied = await applyRestore(tx, report);
          if (!applied.ok) return { failed: applied.message };
        }
        const status = action === 'hide' || action === 'remove' ? 'actioned' : 'dismissed';
        const claimed = await tx.report.updateMany({ where: { id: { in: siblings.map((row) => row.id) }, ...open }, data: { status, decision: action, decisionNote: note || null, decidedById: actorId, decidedAt: new Date() } });
        await tx.moderationAudit.create({ data: { actorId, action: `decision.${action}`, targetType: report.targetType, targetId: report.targetId, reportId: report.id, note: note || null, meta: { reportsAffected: claimed.count } } });
        return { affected: claimed.count };
      });
      if (outcome.conflict) return res.status(409).json({ success: false, message: 'Este reporte ya fue resuelto' });
      if (outcome.failed) return res.status(409).json({ success: false, message: outcome.failed });

      if ((action === 'hide' || action === 'remove') && IMAGE_TYPES.includes(report.targetType) && hooks.banImage) {
        // Imagen confirmada como infracción: su huella visual queda prohibida
        hooks.banImage(report).catch((error) => console.error('Error banning image hash:', error.message));
      }
      if (action === 'hide' || action === 'remove') {
        notifyOwnerOfAction(report.targetOwnerId, report.targetType, findReason(report.targetType, report.reasonCode)?.label || 'Otro motivo', action, publicMessage).catch((error) => console.error('Error notifying owner:', error.message));
      }
      res.json({ success: true, affected: outcome.affected });
    } catch (error) {
      console.error('Error deciding report:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // Nota interna: queda en la línea de tiempo y la ve solo el equipo
  app.post('/api/admin/reports/:id/note', authenticateToken, requireStaff(2), async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Reporte no encontrado' });
      const raw = req.body?.note;
      const note = cleanText(raw, NOTE_MAX);
      if (typeof raw !== 'string' || note.length < 2 || hasBadControlChars(raw)) return badRequest(res, 'Nota inválida');
      const report = await prisma.report.findUnique({ where: { id: req.params.id }, select: { id: true, targetType: true, targetId: true } });
      if (!report) return res.status(404).json({ success: false, message: 'Reporte no encontrado' });
      const actorId = await currentUserId(req);
      await prisma.moderationAudit.create({ data: { actorId, action: 'note', targetType: report.targetType, targetId: report.targetId, reportId: report.id, note } });
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving note:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  app.get('/api/admin/audit', authenticateToken, requireStaff(3), async (req, res) => {
    try {
      const page = Math.max(1, Math.min(200, Number.parseInt(req.query.page, 10) || 1));
      const [rows, total] = await Promise.all([
        prisma.moderationAudit.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: { id: true, actorId: true, action: true, targetType: true, targetId: true, reportId: true, note: true, createdAt: true } }),
        prisma.moderationAudit.count()
      ]);
      const actors = await ownerCache(rows.map((row) => row.actorId));
      res.json({ success: true, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), entries: rows.map((row) => ({ ...row, actorId: undefined, actor: row.actorId ? (actors.get(row.actorId)?.username || 'administrador') : 'sistema' })) });
    } catch (error) {
      console.error('Error loading audit:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  return { applyHide, applyRestore, cleanText, hasBadControlChars, newShortCode, notifyAdminsOfCritical, resolveTarget: (type, id, viewer) => resolvers[type](id, viewer, type) };
};
