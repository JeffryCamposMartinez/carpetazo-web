// Carpetas y sus cartas.
import express from 'express';
import { authenticateToken, optionalAuth } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { folderFilterSql, folderOrderSql, likePattern, loadPublicFolders, tcgVariants, validListText } from '../core/listing.js';
import { PUBLIC_SELLER_SELECT, getReviewSummary, toPublicSeller } from '../core/publicSeller.js';
import { badRequest, cleanCardData, isAllowedStoredImageUrl, isOptionalText, isShortText, isSmallObject, isUuid, isValidPrice, isValidStock } from '../core/validation.js';

const router = express.Router();

// PUT update card in folder
router.put('/api/folders/:id/cards/:cardId', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
    
    if (!user || !folder || folder.userId !== user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    const { price, stock, data } = req.body;
    if (!isValidPrice(price) || !isValidStock(stock) || !isSmallObject(data)) {
      return badRequest(res, 'Datos de carta inválidos');
    }
    const dataToUpdate = {};
    if (price !== undefined) dataToUpdate.price = parseFloat(price);
    if (stock !== undefined) dataToUpdate.stock = parseInt(stock);
    if (data !== undefined) {
      const existingCard = await prisma.card.findFirst({
        where: { id: req.params.cardId, folderId: req.params.id }
      });
      dataToUpdate.data = cleanCardData({
        ...(existingCard?.data && typeof existingCard.data === 'object' ? existingCard.data : {}),
        ...data
      });
    }
    
    const inFolder = await prisma.card.findFirst({ where: { id: req.params.cardId, folderId: req.params.id }, select: { id: true, moderationState: true } });
    if (!inFolder) return res.status(404).json({ success: false, message: 'Carta no encontrada' });
    if (inFolder.moderationState === 'hidden') return res.status(403).json({ success: false, message: 'Esta carta fue ocultada por moderación.' });

    const card = await prisma.card.update({
      where: { id: req.params.cardId, folderId: req.params.id },
      data: dataToUpdate
    });
    
    res.json({ success: true, card });
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// DELETE card from folder
router.delete('/api/folders/:id/cards/:cardId', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
    
    if (!user || !folder || folder.userId !== user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    const removed = await prisma.card.deleteMany({ where: { id: req.params.cardId, folderId: req.params.id } });
    if (removed.count === 0) return res.status(404).json({ success: false, message: 'Carta no encontrada' });
    
    res.json({ success: true, message: 'Card deleted' });
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// --- EDICIÓN EN BLOQUE DE CARTAS (el vendedor elige varias en su inventario) ---
// Rutas con prefijo propio ("cards-bulk") para no chocar con /cards/:cardId.
const BULK_MAX = 500;
const CARD_LANGUAGES = ['English', 'Spanish', 'Japanese'];
const isCleanId = (value) => typeof value === 'string' && isUuid(value);
const hasUniqueIds = (ids) => Array.isArray(ids) && ids.length > 0 && ids.length <= BULK_MAX && ids.every(isCleanId) && new Set(ids).size === ids.length;
const isStrictPrice = (value) => value === undefined || (value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100000000);

// Carpeta propia (404 si no existe o es ajena)
const loadOwnFolder = async (req, res) => {
  if (!isUuid(req.params.id)) { res.status(404).json({ success: false, message: 'Carpeta no encontrada' }); return null; }
  const owner = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
  const folder = await prisma.folder.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true, tcg: true } });
  if (!owner || !folder || folder.userId !== owner.id) { res.status(404).json({ success: false, message: 'Carpeta no encontrada' }); return null; }
  return { owner, folder };
};

// PUT precio, stock e idioma de varias cartas a la vez: { updates: [{ id, price?, stock?, language? }] }
router.put('/api/folders/:id/cards-bulk', authenticateToken, async (req, res) => {
  try {
    const own = await loadOwnFolder(req, res);
    if (!own) return;
    const updates = req.body?.updates;
    const valid = Array.isArray(updates) && hasUniqueIds(updates.map((item) => item?.id)) && updates.every((item) => (
      item && typeof item === 'object'
      && isStrictPrice(item.price) && isValidStock(item.stock) && (item.stock === undefined || item.stock !== null && item.stock !== '')
      && (item.language === undefined || CARD_LANGUAGES.includes(item.language))
      && (item.price !== undefined || item.stock !== undefined || item.language !== undefined)
    ));
    if (!valid) return badRequest(res, 'Datos de cartas inválidos');

    const cards = await prisma.card.findMany({ where: { folderId: own.folder.id, id: { in: updates.map((item) => item.id) } }, select: { id: true, data: true, moderationState: true } });
    if (cards.length !== updates.length) return badRequest(res, 'La selección incluye cartas que no son de esta carpeta');
    const byId = new Map(cards.map((card) => [card.id, card]));
    // Las cartas ocultadas por moderación no se pueden editar: se omiten y se avisa cuántas
    const editable = updates.filter((item) => byId.get(item.id).moderationState !== 'hidden');

    await prisma.$transaction(editable.map((item) => {
      const current = byId.get(item.id);
      const data = {};
      if (item.price !== undefined) data.price = parseFloat(item.price);
      if (item.stock !== undefined) data.stock = parseInt(item.stock, 10);
      if (item.language !== undefined) data.data = cleanCardData({ ...(current.data && typeof current.data === 'object' ? current.data : {}), language: item.language });
      return prisma.card.update({ where: { id: item.id }, data });
    }));
    res.json({ success: true, count: editable.length, skipped: updates.length - editable.length });
  } catch (error) {
    console.error('Error en edición en bloque:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// POST eliminar varias cartas: { ids }
router.post('/api/folders/:id/cards-bulk/delete', authenticateToken, async (req, res) => {
  try {
    const own = await loadOwnFolder(req, res);
    if (!own) return;
    const ids = req.body?.ids;
    if (!hasUniqueIds(ids)) return badRequest(res, 'Selección inválida');
    const removed = await prisma.card.deleteMany({ where: { folderId: own.folder.id, id: { in: ids } } });
    if (removed.count === 0) return res.status(404).json({ success: false, message: 'Cartas no encontradas' });
    res.json({ success: true, count: removed.count });
  } catch (error) {
    console.error('Error al eliminar cartas en bloque:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// POST mover varias cartas a otra carpeta propia del mismo juego: { ids, targetFolderId }
router.post('/api/folders/:id/cards-bulk/move', authenticateToken, async (req, res) => {
  try {
    const own = await loadOwnFolder(req, res);
    if (!own) return;
    const { ids, targetFolderId } = req.body || {};
    if (!hasUniqueIds(ids) || !isCleanId(targetFolderId) || targetFolderId === own.folder.id) return badRequest(res, 'Selección inválida');
    const target = await prisma.folder.findUnique({ where: { id: targetFolderId }, select: { id: true, userId: true, tcg: true } });
    if (!target || target.userId !== own.owner.id) return res.status(404).json({ success: false, message: 'Carpeta de destino no encontrada' });
    if (target.tcg !== own.folder.tcg) return badRequest(res, 'Solo puedes mover cartas a una carpeta del mismo juego');

    const cards = await prisma.card.findMany({ where: { folderId: own.folder.id, id: { in: ids } }, select: { id: true, data: true } });
    if (cards.length !== ids.length) return badRequest(res, 'La selección incluye cartas que no son de esta carpeta');
    // En la carpeta nueva quedan al final: se descarta la posición que tenían
    await prisma.$transaction(cards.map((card) => {
      const { catalogOrder: _discarded, ...rest } = card.data && typeof card.data === 'object' ? card.data : {};
      return prisma.card.update({ where: { id: card.id }, data: { folderId: target.id, data: rest } });
    }));
    res.json({ success: true, count: cards.length });
  } catch (error) {
    console.error('Error al mover cartas en bloque:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// PUT update folder
router.put('/api/folders/:id', authenticateToken, async (req, res) => {
  try {
    const { name, color, tcg, isPublic } = req.body;
    
    // Validar propiedad de la carpeta
    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id }
    });
    
    if (!folder) return res.status(404).json({ success: false, message: 'Carpeta no encontrada' });
    
    const owner = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
    if (!owner || folder.userId !== owner.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (name !== undefined && !isShortText(name, 100)) return badRequest(res, 'Nombre de carpeta inválido');
    if (!isOptionalText(color, 40) || !isOptionalText(tcg, 60)) return badRequest(res, 'Datos de carpeta inválidos');
    if (tcg !== undefined && tcg !== folder.tcg) return badRequest(res, 'El juego de una carpeta no se puede cambiar');
    if (isPublic === true && folder.moderationState !== 'visible') return res.status(403).json({ success: false, message: 'Esta carpeta fue ocultada por moderación. Escríbenos a carpetazo.soporte@gmail.com si crees que fue un error.' });
    if (isPublic !== undefined && typeof isPublic !== 'boolean') return badRequest(res, 'Datos de carpeta inválidos');

    // Actualizar
    const data = {};
    if (name !== undefined) data.name = name;
    if (color !== undefined) data.color = color;
    if (tcg !== undefined) data.tcg = tcg;
    if (isPublic !== undefined) data.isPublic = isPublic;

    const updated = await prisma.folder.update({
      where: { id: req.params.id },
      data
    });

    res.json({ success: true, folder: updated });
  } catch (error) {
    console.error('Error al actualizar carpeta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// PUT folder order: guarda el orden del álbum en una sola transacción (ids de sus cartas, en el orden deseado)
router.put('/api/folders/:id/order', authenticateToken, async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Carpeta no encontrada' });
    const owner = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true } });
    if (!folder || !owner || folder.userId !== owner.id) return res.status(404).json({ success: false, message: 'Carpeta no encontrada' });

    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 5000 || ids.some((id) => typeof id !== 'string' || !isUuid(id)) || new Set(ids).size !== ids.length) {
      return badRequest(res, 'Orden inválido');
    }
    const cards = await prisma.card.findMany({ where: { folderId: folder.id }, select: { id: true, data: true } });
    const byId = new Map(cards.map((card) => [card.id, card]));
    if (ids.some((id) => !byId.has(id))) return badRequest(res, 'El orden incluye cartas que no son de esta carpeta');

    // Las cartas que no vengan en la lista quedan al final, en su orden actual
    const listed = new Set(ids);
    const rest = cards.filter((card) => !listed.has(card.id)).sort((a, b) => Number(a.data?.catalogOrder ?? 1e9) - Number(b.data?.catalogOrder ?? 1e9)).map((card) => card.id);
    const finalOrder = [...ids, ...rest];
    await prisma.$transaction(finalOrder.map((id, index) => prisma.card.update({
      where: { id },
      data: { data: { ...(byId.get(id).data && typeof byId.get(id).data === 'object' ? byId.get(id).data : {}), catalogOrder: index } }
    })));
    res.json({ success: true, count: finalOrder.length });
  } catch (error) {
    console.error('Error saving folder order:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});


// ==========================================
// NUEVAS RUTAS PRISMA (REEMPLAZO FIRESTORE)
// ==========================================

// --- CARPETAS ---

// Obtener mis carpetas
router.get('/api/folders/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const folders = await prisma.folder.findMany({
      where: { userId: user.id },
      include: { _count: { select: { cards: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, folders });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Visitas de las carpetas del usuario: consulta liviana para el contador en tiempo real del panel
router.get('/api/folders/me/stats', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const folders = await prisma.folder.findMany({
      where: { userId: user.id },
      select: { id: true, weeklyVisits: true, lastVisitWeek: true, totalVisits: true }
    });
    // "no-cache" obliga a revalidar con ETag: sin cambios responde 304 sin cuerpo
    res.set('Cache-Control', 'private, no-cache');
    res.json({ success: true, week: Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7)), folders });
  } catch (error) {
    console.error('Error loading folder stats:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Juegos válidos de una carpeta (así se guardan en Folder.tcg)
const FOLDER_TCGS = ['Pokemon', 'Mitos y Leyendas', 'Magic', 'YuGiOh', 'OnePiece'];

// Crear carpeta
router.post('/api/folders', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const { name, description, isPublic, tcg, color } = req.body;
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (!isShortText(name, 100) || !isOptionalText(description, 1000) || !isOptionalText(tcg, 60) || !isOptionalText(color, 40)
      || (tcg !== undefined && tcg !== null && !FOLDER_TCGS.includes(tcg))
      || (isPublic !== undefined && typeof isPublic !== 'boolean')) {
      return badRequest(res, 'Datos de carpeta inválidos');
    }
    
    const folder = await prisma.folder.create({
      data: {
        name,
        description,
        isPublic: isPublic !== undefined ? isPublic : false,
        userId: user.id,
        tcg: tcg || 'Pokemon',
        color: color || 'red'
      }
    });
    res.json({ success: true, folder });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// --- Listados públicos paginados (carpetas, vendedores y destacados de Inicio): se filtran y ordenan en la base ---
const FOLDERS_PAGE_SIZE = 40;

router.get('/api/folders/search', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const tcgRaw = typeof req.query.tcg === 'string' ? req.query.tcg.trim() : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'weekly';
    const page = Number.parseInt(req.query.page, 10) || 1;
    if (!validListText(q, tcgRaw) || !['weekly', 'total', 'name'].includes(sort) || page < 1 || page > 1000) return badRequest(res, 'Búsqueda inválida');

    const filter = folderFilterSql({ like: q ? likePattern(q) : null, tcgs: tcgRaw ? tcgVariants(tcgRaw) : null });
    const [idRows, totalRows, tcgRows] = await Promise.all([
      prisma.$queryRaw`SELECT f."id" FROM "Folder" f JOIN "User" u ON u."id" = f."userId" WHERE ${filter} ORDER BY ${folderOrderSql(sort)} LIMIT ${FOLDERS_PAGE_SIZE} OFFSET ${(page - 1) * FOLDERS_PAGE_SIZE}`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM "Folder" f JOIN "User" u ON u."id" = f."userId" WHERE ${filter}`,
      prisma.$queryRaw`SELECT f."tcg", COUNT(*)::int AS n FROM "Folder" f WHERE f."isPublic" = true GROUP BY f."tcg"`
    ]);
    const total = totalRows[0]?.n || 0;
    res.json({
      success: true,
      folders: await loadPublicFolders(idRows.map((row) => row.id)),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / FOLDERS_PAGE_SIZE)),
      counts: tcgRows.map((row) => ({ tcg: row.tcg, count: row.n }))
    });
  } catch (error) {
    console.error('Error searching folders:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.get('/api/folders/:id', optionalAuth, async (req, res) => {
  try {
    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id },
      include: {
        cards: {
          where: { moderationState: { in: ['visible', 'image_hidden'] } },
          orderBy: { createdAt: 'asc' }
        },
        user: { select: PUBLIC_SELLER_SELECT }
      }
    });
    // Una carpeta privada no existe para nadie más que su dueño (mismo 404 que una carpeta inexistente)
    const isFolderOwner = Boolean(req.user?.sub && folder?.user?.firebaseUid && folder.user.firebaseUid === req.user.sub);
    if (!folder || (!folder.isPublic && !isFolderOwner)) return res.status(404).json({ success: false, message: 'Folder not found' });
    // El estado de moderación solo lo ve el dueño; para los demás no se serializa
    const { moderationState: _folderState, ...publicFolder } = folder;
    const cards = (isFolderOwner ? folder.cards : folder.cards.map(({ moderationState: _cardState, ...card }) => card))
      .map((card) => ({ ...card, data: cleanCardData(card.data) }));
    res.json({ success: true, folder: { ...(isFolderOwner ? folder : publicFolder), cards, user: toPublicSeller(folder.user, req.user?.sub, await getReviewSummary(folder.user.id)) } });
  } catch (error) {
    console.error('Error fetching folder:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

  // Registrar visita a carpeta
  const recentVisits = new Map();
  router.post('/api/folders/:id/visit', async (req, res) => {
    try {
      const folderId = req.params.id;
      const currentWeek = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));

      // Una visita por IP y carpeta cada 30 minutos (evita inflar el contador)
      const visitKey = `${req.ip}|${folderId}`;
      const now = Date.now();
      if ((recentVisits.get(visitKey) || 0) > now - 30 * 60 * 1000) return res.json({ success: true });
      recentVisits.set(visitKey, now);
      if (recentVisits.size > 5000) {
        for (const [key, time] of recentVisits) if (time < now - 30 * 60 * 1000) recentVisits.delete(key);
      }
      
      // Solo cuentan las visitas a carpetas públicas
      const folder = await prisma.folder.findUnique({ where: { id: folderId }, select: { isPublic: true, lastVisitWeek: true } });
      if (!folder || !folder.isPublic) return res.status(404).json({ success: false });

      if (folder.lastVisitWeek !== currentWeek) {
        await prisma.folder.update({
          where: { id: folderId },
          data: { weeklyVisits: 1, lastVisitWeek: currentWeek, totalVisits: { increment: 1 } }
        });
      } else {
        await prisma.folder.update({
          where: { id: folderId },
          data: { weeklyVisits: { increment: 1 }, totalVisits: { increment: 1 } }
        });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error registering visit:', error);
      res.status(500).json({ success: false });
    }
  });

  // Borrar carpeta
router.delete('/api/folders/:id', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
    
    if (!user || !folder || folder.userId !== user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    await prisma.folder.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Folder deleted' });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// --- CARTAS DE CARPETAS ---

// Agregar carta a una carpeta
router.post('/api/folders/:id/cards', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
    
    if (!user || !folder || folder.userId !== user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    const { tcgId, name, imageUrl, price, stock, data } = req.body;
    if (!isShortText(String(tcgId ?? ''), 100) || !isShortText(name, 300) || !isValidPrice(price) || !isValidStock(stock) || !isSmallObject(data)) {
      return badRequest(res, 'Datos de carta inválidos');
    }
    if (imageUrl && !isAllowedStoredImageUrl(imageUrl)) {
      return res.status(400).json({ success: false, error: 'URL de imagen no permitida' });
    }
      
      const card = await prisma.card.create({
        data: {
          tcgId,
          name,
          imageUrl,
          price: parseFloat(price) || null,
          stock: stock !== undefined ? parseInt(stock) : 1,
          data: cleanCardData(data) || null,
          folderId: folder.id
        }
      });
    res.json({ success: true, card });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.get('/api/folders', async (req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      where: { isPublic: true },
      include: { user: { select: { name: true, username: true, photoURL: true } }, _count: { select: { cards: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, folders });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
