// Carpetas y sus cartas.
import express from 'express';
import { authenticateToken, optionalAuth, optionalStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { isValidComuna } from '../core/chileData.js';
import { folderFilterSql, folderOrderSql, likePattern, loadPublicFolders, tcgVariants, validListText } from '../core/listing.js';
import { PUBLIC_SELLER_SELECT, getReviewSummary, toPublicSeller } from '../core/publicSeller.js';
import { badRequest, cleanCardData, isAllowedStoredImageUrl, isOptionalText, isShortText, isSmallObject, isUuid, isValidPrice, isValidStock } from '../core/validation.js';
import { r2PublicUrl } from '../core/tcgCatalogImport.js';
import { isMylTcg, storedCardId } from '../core/mylIdentity.js';
import { PlanLimitError, assertCanAddUniqueCard, assertCanCreateFolder, assertStockChange, getEffectivePlan, getPlanState, lockPlanUser, sendPlanError } from '../core/entitlements.js';

const router = express.Router();
const CARD_LANGUAGES = ['English', 'Spanish', 'Japanese'];
const normalizedLanguage = (tcg, value) => (isMylTcg(tcg) ? 'Spanish' : CARD_LANGUAGES.includes(value) ? value : 'English');

// PUT update card in folder
router.put('/api/folders/:id/cards/:cardId', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true, tcg: true } });
    
    if (!user || !folder || folder.userId !== user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    const { price, stock, data } = req.body || {};
    if (!isValidPrice(price) || !isValidStock(stock) || !isSmallObject(data)) {
      return badRequest(res, 'Datos de carta inválidos');
    }
    if (data?.language !== undefined && !CARD_LANGUAGES.includes(data.language)) {
      return badRequest(res, 'Idioma de carta inválido');
    }
    const card = await prisma.$transaction(async (tx) => {
      await lockPlanUser(tx, user.id);
      const current = await tx.card.findFirst({ where: { id: req.params.cardId, folderId: folder.id } });
      if (!current) return null;
      if (current.moderationState === 'hidden') throw Object.assign(new Error('Esta carta fue ocultada por moderación.'), { status: 403 });
      const { plan } = await getEffectivePlan(tx, user.id);
      const dataToUpdate = {};
      if (price !== undefined) dataToUpdate.price = price === '' || price === null ? null : parseFloat(price);
      if (stock !== undefined) {
        const nextStock = parseInt(stock, 10);
        assertStockChange(plan, current.stock, nextStock);
        dataToUpdate.stock = nextStock;
      }
      if (data !== undefined) {
        const merged = cleanCardData({ ...(current.data && typeof current.data === 'object' ? current.data : {}), ...data });
        const nextLanguage = normalizedLanguage(folder.tcg, merged?.language || current.language);
        if (nextLanguage !== current.language) {
          const conflict = await tx.card.findFirst({ where: { folderId: folder.id, tcgId: current.tcgId, language: nextLanguage, id: { not: current.id } }, select: { id: true } });
          if (conflict) throw new PlanLimitError('card_identity_conflict', { planKey: plan.key });
        }
        dataToUpdate.language = nextLanguage;
        dataToUpdate.data = { ...(merged || {}), language: nextLanguage };
      }
      return tx.card.update({ where: { id: current.id }, data: dataToUpdate });
    });
    if (!card) return res.status(404).json({ success: false, message: 'Carta no encontrada' });
    res.json({ success: true, card });
  } catch (error) {
    if (error instanceof PlanLimitError) return sendPlanError(res, error);
    if (error.status === 403) return res.status(403).json({ success: false, message: error.message });
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
const isCleanId = (value) => typeof value === 'string' && isUuid(value);
const hasUniqueIds = (ids) => Array.isArray(ids) && ids.length > 0 && ids.length <= BULK_MAX && ids.every(isCleanId) && new Set(ids).size === ids.length;
const isStrictPrice = (value) => value === undefined || (value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100000000);

// Carpeta propia (404 si no existe o es ajena)
const loadOwnFolder = async (req, res) => {
  if (!isUuid(req.params.id)) { res.status(404).json({ success: false, message: 'Carpeta no encontrada' }); return null; }
  const owner = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
  const folder = await prisma.folder.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true, tcg: true, moderationState: true } });
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

    const result = await prisma.$transaction(async (tx) => {
      await lockPlanUser(tx, own.owner.id);
      const [cards, allCards, effective] = await Promise.all([
        tx.card.findMany({ where: { folderId: own.folder.id, id: { in: updates.map((item) => item.id) } }, select: { id: true, tcgId: true, language: true, stock: true, data: true, moderationState: true } }),
        tx.card.findMany({ where: { folderId: own.folder.id }, select: { id: true, tcgId: true, language: true } }),
        getEffectivePlan(tx, own.owner.id)
      ]);
      if (cards.length !== updates.length) throw Object.assign(new Error('La selección incluye cartas que no son de esta carpeta'), { status: 400 });
      const byId = new Map(cards.map((card) => [card.id, card]));
      const editable = updates.filter((item) => byId.get(item.id).moderationState !== 'hidden');
      const editableIds = new Set(editable.map((item) => item.id));
      const occupied = new Set(allCards.filter((card) => !editableIds.has(card.id)).map((card) => `${card.tcgId}\u0000${card.language}`));
      for (const item of editable) {
        const current = byId.get(item.id);
        const nextLanguage = normalizedLanguage(own.folder.tcg, item.language || current.language);
        const identity = `${current.tcgId}\u0000${nextLanguage}`;
        if (occupied.has(identity)) throw new PlanLimitError('card_identity_conflict', { planKey: effective.plan.key });
        occupied.add(identity);
        const data = {};
        if (item.price !== undefined) data.price = parseFloat(item.price);
        if (item.stock !== undefined) {
          const nextStock = parseInt(item.stock, 10);
          assertStockChange(effective.plan, current.stock, nextStock);
          data.stock = nextStock;
        }
        if (item.language !== undefined) {
          data.language = nextLanguage;
          data.data = cleanCardData({ ...(current.data && typeof current.data === 'object' ? current.data : {}), language: nextLanguage });
        }
        await tx.card.update({ where: { id: item.id }, data });
      }
      return { count: editable.length, skipped: updates.length - editable.length };
    });
    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof PlanLimitError) return sendPlanError(res, error);
    if (error.status === 400) return badRequest(res, error.message);
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
    // Las cartas de una carpeta ocultada por moderación no se pueden sacar a otra carpeta (volverían a estar a la venta)
    if (own.folder.moderationState !== 'visible') return res.status(403).json({ success: false, message: 'Esta carpeta fue ocultada por moderación: sus cartas no se pueden mover. Escríbenos a carpetazo.soporte@gmail.com si crees que fue un error.' });
    const { ids, targetFolderId } = req.body || {};
    if (!hasUniqueIds(ids) || !isCleanId(targetFolderId) || targetFolderId === own.folder.id) return badRequest(res, 'Selección inválida');
    const target = await prisma.folder.findUnique({ where: { id: targetFolderId }, select: { id: true, userId: true, tcg: true } });
    if (!target || target.userId !== own.owner.id) return res.status(404).json({ success: false, message: 'Carpeta de destino no encontrada' });
    if (target.tcg !== own.folder.tcg) return badRequest(res, 'Solo puedes mover cartas a una carpeta del mismo juego');

    const count = await prisma.$transaction(async (tx) => {
      await lockPlanUser(tx, own.owner.id);
      const [cards, targetCards, effective] = await Promise.all([
        tx.card.findMany({ where: { folderId: own.folder.id, id: { in: ids } }, select: { id: true, tcgId: true, language: true, stock: true, data: true } }),
        tx.card.findMany({ where: { folderId: target.id }, select: { id: true, tcgId: true, language: true, stock: true } }),
        getEffectivePlan(tx, own.owner.id)
      ]);
      if (cards.length !== ids.length) throw Object.assign(new Error('La selección incluye cartas que no son de esta carpeta'), { status: 400 });
      const targetByIdentity = new Map(targetCards.map((card) => [`${card.tcgId}\u0000${card.language}`, card]));
      const newIdentities = new Set(cards.map((card) => `${card.tcgId}\u0000${card.language}`).filter((identity) => !targetByIdentity.has(identity)));
      if (effective.plan.uniqueCardsPerFolder !== null && targetCards.length + newIdentities.size > effective.plan.uniqueCardsPerFolder) {
        throw new PlanLimitError('plan_unique_card_limit', { current: targetCards.length, limit: effective.plan.uniqueCardsPerFolder, planKey: effective.plan.key, details: { requested: targetCards.length + newIdentities.size } });
      }
      for (const card of cards) {
        const identity = `${card.tcgId}\u0000${card.language}`;
        const existing = targetByIdentity.get(identity);
        if (existing) {
          const nextStock = existing.stock + card.stock;
          assertStockChange(effective.plan, existing.stock, nextStock);
          await tx.card.update({ where: { id: existing.id }, data: { stock: nextStock } });
          await tx.card.delete({ where: { id: card.id } });
          existing.stock = nextStock;
        } else {
          assertStockChange(effective.plan, 0, card.stock);
          const { catalogOrder: _discarded, ...rest } = card.data && typeof card.data === 'object' ? card.data : {};
          await tx.card.update({ where: { id: card.id }, data: { folderId: target.id, data: rest } });
          targetByIdentity.set(identity, card);
        }
      }
      return cards.length;
    });
    res.json({ success: true, count });
  } catch (error) {
    if (error instanceof PlanLimitError) return sendPlanError(res, error);
    if (error.status === 400) return badRequest(res, error.message);
    console.error('Error al mover cartas en bloque:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// PUT update folder
router.put('/api/folders/:id', authenticateToken, async (req, res) => {
  try {
    const { name, color, tcg, isPublic } = req.body || {};

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
    res.json({ success: true, folders, planState: await getPlanState(prisma, user.id) });
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

// Juegos válidos de una carpeta nueva (así se guardan en Folder.tcg)
// Juegos con los que se pueden crear carpetas nuevas (las carpetas que ya existen de otros juegos siguen funcionando)
const CREATABLE_TCGS = ['Pokemon', 'Mitos y Leyendas', 'OnePiece', 'Magic', 'Riftbound', 'YuGiOh'];

// Crear carpeta
router.post('/api/folders', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const { name, description, isPublic, tcg, color } = req.body || {};
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    if (!isShortText(name, 100) || !isOptionalText(description, 1000) || !isOptionalText(tcg, 60) || !isOptionalText(color, 40)
      || (tcg !== undefined && tcg !== null && !CREATABLE_TCGS.includes(tcg))
      || (isPublic !== undefined && typeof isPublic !== 'boolean')) {
      return badRequest(res, 'Datos de carpeta inválidos');
    }
    
    const folderTcg = tcg || 'Pokemon';
    const folder = await prisma.$transaction(async (tx) => {
      await lockPlanUser(tx, user.id);
      await assertCanCreateFolder(tx, user.id);
      return tx.folder.create({
        data: {
          name,
          description,
          isPublic: isPublic !== undefined ? isPublic : false,
          userId: user.id,
          tcg: folderTcg,
          color: color || 'red'
        }
      });
    });
    res.json({ success: true, folder });
  } catch (error) {
    if (error instanceof PlanLimitError) return sendPlanError(res, error);
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
    const comuna = typeof req.query.comuna === 'string' ? req.query.comuna.trim() : '';
    if (!validListText(q, tcgRaw) || !['weekly', 'total', 'name'].includes(sort) || page < 1 || page > 1000 || (comuna && !isValidComuna(comuna))) return badRequest(res, 'Búsqueda inválida');

    const filter = folderFilterSql({ like: q ? likePattern(q) : null, tcgs: tcgRaw ? tcgVariants(tcgRaw) : null, comuna: comuna || null });
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

router.get('/api/folders/:id', optionalAuth, optionalStaff, async (req, res) => {
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
    // Una carpeta privada no existe para visitantes; el dueño y el equipo de moderación pueden revisarla.
    const isFolderOwner = Boolean(req.user?.sub && folder?.user?.firebaseUid && folder.user.firebaseUid === req.user.sub);
    const isStaffViewer = req.staffLevel >= 2;
    if (!folder || (!folder.isPublic && !isFolderOwner && !isStaffViewer)) return res.status(404).json({ success: false, message: 'Folder not found' });
    // El estado de moderación solo lo ve el dueño; para los demás no se serializa
    const { moderationState: _folderState, ...publicFolder } = folder;
    const visibleCards = isFolderOwner ? folder.cards : folder.cards.map(({ moderationState: _cardState, ...card }) => card);
    // Los ids de Mitos son propios del catálogo de Mitos. No deben buscarse
    // en CatalogCard, porque allí viven los ids de TCGplayer y pueden coincidir.
    const productIds = isMylTcg(folder.tcg)
      ? []
      : [...new Set(visibleCards.map((card) => Number(card.tcgId)).filter((id) => Number.isInteger(id) && id > 0))];
    const catalogRows = productIds.length
      ? await prisma.catalogCard.findMany({ where: { productId: { in: productIds }, kind: 'card' }, select: { productId: true, imageKey: true, set: { select: { publishedOn: true } } } })
      : [];
    const imageByProductId = new Map(catalogRows.filter((row) => row.imageKey).map((row) => [row.productId, r2PublicUrl(row.imageKey)]));
    // Fecha de la edición de cada carta (para ordenar por «Última edición»): el catálogo importado, o TcgProduct en Mitos y Leyendas
    const editionByTcgId = new Map(catalogRows.filter((row) => row.set?.publishedOn).map((row) => [String(row.productId), row.set.publishedOn]));
    if (isMylTcg(folder.tcg)) {
      const mylIds = [...new Set(visibleCards.map((card) => String(card.tcgId || '')).filter((id) => id.startsWith('myl:')))];
      const mylProducts = mylIds.length ? await prisma.tcgProduct.findMany({ where: { productId: { in: mylIds.map((id) => id.slice(4)) } }, select: { productId: true, group: { select: { publishedOn: true } } } }) : [];
      mylProducts.filter((row) => row.group?.publishedOn).forEach((row) => editionByTcgId.set(`myl:${row.productId}`, row.group.publishedOn));
    }
    // Unidades vendidas de cada carta (pedidos confirmados de este vendedor): solo las ve el dueño, para ordenar por «Más vendidos»
    const soldByTcgId = new Map();
    if (isFolderOwner) {
      const tcgIds = [...new Set(visibleCards.map((card) => card.tcgId).filter(Boolean))];
      const rows = tcgIds.length ? await prisma.$queryRaw`
        SELECT elem->>'tcgId' AS "tcgId", SUM(GREATEST(1, COALESCE(NULLIF(elem->>'quantity', '')::numeric, 1)))::int AS "sold"
        FROM "Order" o, jsonb_array_elements(CASE WHEN jsonb_typeof(o."items") = 'array' THEN o."items" ELSE '[]'::jsonb END) AS elem
        WHERE o."sellerId" = ${folder.userId} AND o."status" = 'completed' AND elem->>'tcgId' = ANY(${tcgIds}::text[])
        GROUP BY 1` : [];
      rows.forEach((row) => soldByTcgId.set(row.tcgId, Number(row.sold)));
    }
    const cards = visibleCards.map((card) => ({
      ...card,
      imageUrl: imageByProductId.get(Number(card.tcgId)) || card.imageUrl,
      editionDate: editionByTcgId.get(String(card.tcgId)) || null,
      ...(isFolderOwner ? { soldUnits: soldByTcgId.get(card.tcgId) || 0 } : {}),
      data: cleanCardData(card.data),
    }));
    // `isOwner` deja que la pantalla de edición no se muestre a quien no es el dueño (la API ya rechaza sus cambios)
    res.json({ success: true, folder: { ...(isFolderOwner ? folder : publicFolder), isOwner: isFolderOwner, cards, user: toPublicSeller(folder.user, req.user?.sub, await getReviewSummary(folder.user.id)) } });
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

      // Solo cuentan las visitas a carpetas públicas
      const folder = await prisma.folder.findUnique({ where: { id: folderId }, select: { isPublic: true, lastVisitWeek: true } });
      if (!folder || !folder.isPublic) return res.status(404).json({ success: false });

      // Una visita por conexión y carpeta al día, y solo desde un navegador (programas y bots no cuentan): así no se infla el contador
      const userAgent = String(req.headers['user-agent'] || '');
      if (!/Mozilla\//.test(userAgent) || /bot|crawler|spider|curl|wget|python|node-fetch|axios|headless|preview/i.test(userAgent)) return res.json({ success: true });
      const visitKey = `${req.ip}|${folderId}`;
      const now = Date.now();
      const VISIT_WINDOW_MS = 24 * 60 * 60 * 1000;
      if ((recentVisits.get(visitKey) || 0) > now - VISIT_WINDOW_MS) return res.json({ success: true });
      recentVisits.set(visitKey, now);
      if (recentVisits.size > 20000) {
        for (const [key, time] of recentVisits) if (time < now - VISIT_WINDOW_MS) recentVisits.delete(key);
      }

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
    
    const { tcgId, name, imageUrl, price, stock, data } = req.body || {};
    if (!isShortText(String(tcgId ?? ''), 100) || !isShortText(name, 300) || !isValidPrice(price) || !isValidStock(stock) || !isSmallObject(data)) {
      return badRequest(res, 'Datos de carta inválidos');
    }
    if (data?.language !== undefined && !CARD_LANGUAGES.includes(data.language)) {
      return badRequest(res, 'Idioma de carta inválido');
    }
    if (imageUrl && !isAllowedStoredImageUrl(imageUrl)) {
      return res.status(400).json({ success: false, error: 'URL de imagen no permitida' });
    }

    const normalizedTcgId = storedCardId(folder.tcg, tcgId);
    if (!normalizedTcgId) return badRequest(res, 'Identificador de carta inválido');
      
    const cardLanguage = normalizedLanguage(folder.tcg, data?.language);
    const requestedStock = stock !== undefined ? parseInt(stock, 10) : 1;
    const card = await prisma.$transaction(async (tx) => {
      await lockPlanUser(tx, user.id);
      const stillOwned = await tx.folder.findFirst({ where: { id: folder.id, userId: user.id }, select: { id: true } });
      if (!stillOwned) throw Object.assign(new Error('Not authorized'), { status: 403 });
      const existing = await tx.card.findFirst({ where: { folderId: folder.id, tcgId: normalizedTcgId, language: cardLanguage }, select: { id: true } });
      if (existing) {
        const { plan } = await getEffectivePlan(tx, user.id);
        throw new PlanLimitError('card_identity_conflict', { planKey: plan.key, details: { existingCardId: existing.id } });
      }
      await assertCanAddUniqueCard(tx, user.id, folder.id, requestedStock);
      return tx.card.create({
        data: {
          tcgId: normalizedTcgId,
          name,
          imageUrl,
          price: parseFloat(price) || null,
          stock: requestedStock,
          language: cardLanguage,
          data: { ...(cleanCardData(data) || {}), language: cardLanguage },
          folderId: folder.id
        }
      });
    });
    res.json({ success: true, card });
  } catch (error) {
    if (error instanceof PlanLimitError) return sendPlanError(res, error);
    if (error.status === 403) return res.status(403).json({ success: false, message: error.message });
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Listado simple de carpetas públicas (la web usa /api/folders/search, paginado). Se mantiene la forma de la respuesta para
// integraciones externas, pero con tope: sin él, con miles de carpetas sería una consulta pesada que cualquiera puede repetir.
const PUBLIC_FOLDERS_MAX = 200;
router.get('/api/folders', async (req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      where: {
        isPublic: true,
        moderationState: 'visible',
        cards: { some: { moderationState: { in: ['visible', 'image_hidden'] } } }
      },
      include: {
        user: { select: { name: true, username: true, photoURL: true } },
        _count: { select: { cards: { where: { moderationState: { in: ['visible', 'image_hidden'] } } } } }
      },
      orderBy: { createdAt: 'desc' },
      take: PUBLIC_FOLDERS_MAX
    });
    res.json({ success: true, folders });
  } catch (error) {
    console.error('Error en la ruta:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
