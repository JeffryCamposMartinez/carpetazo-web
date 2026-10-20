// Lista de cartas deseadas.
import express from 'express';
import { authenticateToken, currentUserId } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { PlanLimitError, PlanFeatureError, getEffectivePlan, sendPlanError } from '../core/entitlements.js';
import { badRequest, hasControlChars, isAllowedStoredImageUrl, isOptionalText, isShortText, isValidPrice } from '../core/validation.js';
import { rawMylId, storedMylId } from '../core/mylIdentity.js';

const router = express.Router();

// --- Lista de cartas deseadas ---
const WISHLIST_MAX_ITEMS = 300; // tope técnico por lista (el de cada plan está en core/plans.js)
const WISHLIST_MAX_LISTS = 10;
const DEFAULT_LIST_NAME = 'Mi lista';
const WISHLIST_PAGE_SIZE = 24;
const WISHLIST_GAMES = ['Pokémon', 'Mitos y Leyendas', 'One Piece', 'Magic', 'Yu-Gi-Oh!', 'Riftbound', 'Lorcana', 'Digimon'];
const WISHLIST_GAME_BY_CATEGORY = { 1: 'Pokémon', 99: 'Mitos y Leyendas', 68: 'One Piece', 89: 'Riftbound', 1001: 'Magic', 2: 'Yu-Gi-Oh!', 71: 'Lorcana', 63: 'Digimon' };
// Juegos que se buscan directo en TCGCSV: categoría de TCGCSV -> categoría guardada, juego y nombre con que se guardan las carpetas.
// (La categoría de Magic en TCGCSV es 1, igual que la que se guarda para Pokémon: por eso Magic se guarda como 1001.)
const WISHLIST_TCGCSV = {
  3: { stored: 1, game: 'Pokémon' },
  85: { stored: 1, game: 'Pokémon' },
  68: { stored: 68, game: 'One Piece' },
  1: { stored: 1001, game: 'Magic' },
  89: { stored: 89, game: 'Riftbound' },
  2: { stored: 2, game: 'Yu-Gi-Oh!' },
  71: { stored: 71, game: 'Lorcana' },
  63: { stored: 63, game: 'Digimon' },
};
const WISHLIST_OWN_SELECT = { id: true, wishlistId: true, categoryId: true, productId: true, name: true, game: true, detail: true, imageUrl: true, quantity: true, maxPrice: true, priceVisible: true, note: true, createdAt: true };

// Juego: solo los de la lista del sitio ("Pokemon" sin tilde se acepta). null = sin juego; undefined = inválido
const normalizeWishlistGame = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const GAME_ALIASES = { Pokemon: 'Pokémon', Pokemon_Japan: 'Pokémon', YuGiOh: 'Yu-Gi-Oh!', OnePiece: 'One Piece', One_Piece: 'One Piece', Disney_Lorcana: 'Lorcana', Digimon_Card_Game: 'Digimon' }; // nombres con que se guardan las carpetas y claves del índice del catálogo
  const game = GAME_ALIASES[value.trim()] || value.trim();
  return WISHLIST_GAMES.includes(game) ? game : undefined;
};

// Cantidad, precio máximo, visibilidad del precio y nota: se validan igual al crear y al editar
const parseWishlistFields = (body) => {
  const out = {};
  if (body.quantity !== undefined) {
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return { error: 'Cantidad inválida' };
    out.quantity = quantity;
  }
  if (body.maxPrice !== undefined) {
    if (body.maxPrice === null || body.maxPrice === '') out.maxPrice = null;
    else if (!isValidPrice(body.maxPrice)) return { error: 'Precio inválido' };
    else out.maxPrice = Number(body.maxPrice);
  }
  if (body.priceVisible !== undefined) {
    if (typeof body.priceVisible !== 'boolean') return { error: 'Dato inválido' };
    out.priceVisible = body.priceVisible;
  }
  if (body.note !== undefined) {
    if (body.note !== null && (!isOptionalText(body.note, 140) || hasControlChars(String(body.note).replace(/[\r\n]/g, ' ')))) return { error: 'Nota inválida' };
    out.note = body.note ? String(body.note).trim() || null : null;
  }
  return { data: out };
};

// Listas de la persona con la cantidad de cartas de cada una; si aún no tiene ninguna, se crea la primera (activa)
const WISHLIST_LIST_SELECT = { id: true, name: true, isActive: true, _count: { select: { items: true } } };
const publicList = (list) => ({ id: list.id, name: list.name, isActive: list.isActive, count: list._count.items });
const ensureLists = async (userId) => {
  const lists = await prisma.wishlist.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: WISHLIST_LIST_SELECT });
  if (lists.length > 0) return lists;
  try {
    await prisma.wishlist.create({ data: { userId, name: DEFAULT_LIST_NAME, isActive: true } });
  } catch (error) {
    if (error?.code !== 'P2002') throw error; // otra petición la creó al mismo tiempo (índice único de la lista activa)
  }
  return prisma.wishlist.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: WISHLIST_LIST_SELECT });
};
const listName = (value) => (typeof value === 'string' && isShortText(value, 40) && !hasControlChars(value) ? value.trim() : null);

router.get('/api/wishlist/me', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const lists = await ensureLists(userId);
    const { plan } = await getEffectivePlan(prisma, userId);
    const items = await prisma.wishlistItem.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, take: WISHLIST_MAX_ITEMS * WISHLIST_MAX_LISTS, select: WISHLIST_OWN_SELECT });
    res.json({ success: true, lists: lists.map(publicList), items, limit: plan.wishlistItems, maxLists: plan.wishlistLists });
  } catch (error) {
    console.error('Error loading wishlist:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Cartas de la lista que hoy tienen otros vendedores (catálogos públicos, con stock y dentro del precio máximo)
const WISHLIST_MATCH_TCG = { 1: 'Pokemon', 99: 'Mitos y Leyendas', 68: 'OnePiece', 89: 'Riftbound', 1001: 'Magic', 2: 'YuGiOh', 71: 'Lorcana', 63: 'Digimon' };
const WISHLIST_MATCHES_PER_ITEM = 5;
router.get('/api/wishlist/matches', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const items = await prisma.wishlistItem.findMany({ where: { userId, productId: { not: null } }, take: WISHLIST_MAX_ITEMS * WISHLIST_MAX_LISTS, select: { id: true, categoryId: true, productId: true, maxPrice: true } });
    // tcgId de la carta = id del producto (las del catálogo de Pokémon se guardan como `tcgcsv:<cat>:<id>`)
    const wanted = items.map((item) => ({
      ...item,
      tcgId: item.categoryId === 99 ? storedMylId(item.productId) : String(item.productId).replace(/^tcgcsv:\d+:/, ''),
      tcg: WISHLIST_MATCH_TCG[item.categoryId]
    })).filter((item) => item.tcg && (item.categoryId === 99 ? /^myl:\d{1,12}$/.test(item.tcgId) : /^\d{1,12}$/.test(item.tcgId)));
    if (wanted.length === 0) return res.json({ success: true, matches: {}, prices: {} });

    const cards = await prisma.card.findMany({
      where: { stock: { gt: 0 }, price: { not: null }, moderationState: 'visible', tcgId: { in: [...new Set(wanted.map((item) => item.tcgId))] }, folder: { isPublic: true, userId: { not: userId } } },
      orderBy: { price: 'asc' },
      take: 2000,
      select: { id: true, tcgId: true, price: true, stock: true, folder: { select: { id: true, name: true, tcg: true, user: { select: { name: true, username: true, photoURL: true } } } } },
    });
    const matches = {};
    const prices = {}; // precio más bajo publicado de cada carta, sin mirar el precio máximo de la lista
    wanted.forEach((item) => {
      const published = cards.filter((card) => card.tcgId === item.tcgId && card.folder.tcg === item.tcg);
      if (published.length > 0) prices[item.id] = { lowest: published[0].price, cardId: published[0].id, total: published.length };
      const found = item.maxPrice == null ? published : published.filter((card) => card.price <= item.maxPrice);
      if (found.length === 0) return;
      matches[item.id] = {
        count: found.length,
        offers: found.slice(0, WISHLIST_MATCHES_PER_ITEM).map((card) => ({
          cardId: card.id, price: card.price, stock: card.stock,
          folder: { id: card.folder.id, name: card.folder.name },
          seller: { name: card.folder.user.name, username: card.folder.user.username, photoURL: card.folder.user.photoURL },
        })),
      };
    });
    res.json({ success: true, matches, prices });
  } catch (error) {
    console.error('Error loading wishlist matches:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.post('/api/wishlist', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const { productId, name, imageUrl, external } = req.body || {};
    const parsed = parseWishlistFields(req.body || {});
    if (parsed.error) return badRequest(res, parsed.error);
    if (productId !== undefined && productId !== null && (typeof productId !== 'string' || productId.length > 40 || hasControlChars(productId))) return badRequest(res, 'Carta inválida');
    const game = normalizeWishlistGame(req.body?.game);
    if (game === undefined) return badRequest(res, 'Juego inválido');
    const rawDetail = req.body?.detail;
    if (rawDetail !== undefined && rawDetail !== null && (!isOptionalText(rawDetail, 100) || hasControlChars(String(rawDetail)))) return badRequest(res, 'Detalle inválido');
    const detail = rawDetail ? String(rawDetail).trim() || null : null;

    // Carta del catálogo propio (Mitos y Leyendas, Pokémon del catálogo): nombre, imagen, juego y edición salen de la base
    const catalogLookupId = productId && String(productId).startsWith('myl:') ? rawMylId(productId) : productId;
    const catalog = catalogLookupId
      ? await prisma.tcgProduct.findUnique({ where: { productId: catalogLookupId }, select: { productId: true, name: true, imageUrl: true, categoryId: true, group: { select: { name: true } } } })
      : null;
    let identity;
    if (catalog) {
      identity = { productId: catalog.categoryId === 99 ? storedMylId(catalog.productId) : catalog.productId, categoryId: catalog.categoryId, name: catalog.name, game: WISHLIST_GAME_BY_CATEGORY[catalog.categoryId] || game, detail: catalog.group?.name || detail, imageUrl: catalog.imageUrl || null };
    } else if (external !== undefined) {
      // Cartas de TCGCSV (Pokémon 3 y 85, One Piece 68, Magic 1, Riftbound 89, Yu-Gi-Oh! 2, Lorcana 71, Digimon 63): el catálogo no está en la base, el identificador se valida por forma
      const externalCategory = Number(external?.categoryId);
      const externalGame = WISHLIST_TCGCSV[externalCategory];
      const externalId = typeof external?.productId === 'string' || typeof external?.productId === 'number' ? String(external.productId) : '';
      if (!externalGame || !/^\d{1,12}$/.test(externalId)) return badRequest(res, 'Carta inválida');
      if (!isShortText(name, 100) || hasControlChars(name)) return badRequest(res, 'Carta inválida');
      identity = { productId: `tcgcsv:${externalCategory}:${externalId}`, categoryId: externalGame.stored, name: name.trim(), game: externalGame.game, detail, imageUrl: imageUrl && isAllowedStoredImageUrl(imageUrl) ? imageUrl : null };
    } else {
      if (!isShortText(name, 100) || hasControlChars(name)) return badRequest(res, 'Escribe el nombre de la carta');
      identity = { productId: null, categoryId: null, name: name.trim(), game, detail, imageUrl: imageUrl && isAllowedStoredImageUrl(imageUrl) ? imageUrl : null };
    }

    // Lista de destino: la elegida (debe ser suya) o, si no se indica, la activa
    const requestedList = req.body?.wishlistId;
    if (requestedList !== undefined && (typeof requestedList !== 'string' || requestedList.length > 40)) return badRequest(res, 'Lista inválida');
    const lists = await ensureLists(userId);
    const target = requestedList !== undefined ? lists.find((list) => list.id === requestedList) : lists.find((list) => list.isActive) || lists[0];
    if (!target) return res.status(404).json({ success: false, message: 'Lista no encontrada' });
    const wishlistId = target.id;
    // El máximo de cartas por lista lo fija el plan; quien ya tiene más (de un plan anterior) las conserva, pero no agrega otra
    const { plan } = await getEffectivePlan(prisma, userId);

    const item = await prisma.$transaction(async (tx) => {
      const existing = identity.productId
        ? await tx.wishlistItem.findUnique({ where: { wishlistId_productId: { wishlistId, productId: identity.productId } } })
        : await tx.wishlistItem.findFirst({ where: { wishlistId, productId: null, detail: identity.detail, name: { equals: identity.name, mode: 'insensitive' } } });
      if (existing) {
        // La misma carta no se duplica: se suma a la cantidad que ya buscaba
        const quantity = Math.min(99, existing.quantity + (parsed.data.quantity ?? 1));
        return tx.wishlistItem.update({ where: { id: existing.id }, data: { ...parsed.data, quantity }, select: WISHLIST_OWN_SELECT });
      }
      const current = await tx.wishlistItem.count({ where: { wishlistId } });
      if (current >= plan.wishlistItems) return { full: current };
      return tx.wishlistItem.create({ data: { userId, wishlistId, ...identity, ...parsed.data }, select: WISHLIST_OWN_SELECT });
    });
    if (item.full !== undefined) return sendPlanError(res, new PlanFeatureError('wishlistItems', plan.key, { current: item.full, limit: plan.wishlistItems }));
    res.json({ success: true, item });
  } catch (error) {
    if (error instanceof PlanLimitError) return sendPlanError(res, error);
    console.error('Error adding wishlist item:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.put('/api/wishlist/:id', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const parsed = parseWishlistFields(req.body || {});
    if (parsed.error) return badRequest(res, parsed.error);
    const owned = await prisma.wishlistItem.findFirst({ where: { id: req.params.id, userId }, select: { id: true } });
    if (!owned) return res.status(404).json({ success: false, message: 'Carta no encontrada' });
    const item = await prisma.wishlistItem.update({ where: { id: owned.id }, data: parsed.data, select: WISHLIST_OWN_SELECT });
    res.json({ success: true, item });
  } catch (error) {
    console.error('Error updating wishlist item:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.delete('/api/wishlist/:id', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const removed = await prisma.wishlistItem.deleteMany({ where: { id: req.params.id, userId } });
    if (removed.count === 0) return res.status(404).json({ success: false, message: 'Carta no encontrada' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting wishlist item:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// --- Listas ---
router.post('/api/wishlists', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const name = listName(req.body?.name);
    if (!name) return badRequest(res, 'Escribe un nombre de hasta 40 caracteres');
    const lists = await ensureLists(userId);
    // El máximo lo fija el plan; quien ya tiene más listas (de un plan anterior) las conserva, pero no crea otra
    const { plan } = await getEffectivePlan(prisma, userId);
    if (lists.length >= plan.wishlistLists) return sendPlanError(res, new PlanFeatureError('wishlistLists', plan.key, { current: lists.length, limit: plan.wishlistLists }));
    const list = await prisma.wishlist.create({ data: { userId, name, isActive: false }, select: WISHLIST_LIST_SELECT });
    res.json({ success: true, list: publicList(list) });
  } catch (error) {
    console.error('Error creating wishlist:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Cambia el nombre y/o la deja como la lista activa (la que se muestra en el perfil)
router.put('/api/wishlists/:id', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const { name, isActive } = req.body || {};
    if (name === undefined && isActive === undefined) return badRequest(res, 'Nada que cambiar');
    const newName = name === undefined ? undefined : listName(name);
    if (name !== undefined && !newName) return badRequest(res, 'Escribe un nombre de hasta 40 caracteres');
    if (isActive !== undefined && isActive !== true) return badRequest(res, 'Dato inválido'); // una lista deja de ser activa al activar otra
    const owned = await prisma.wishlist.findFirst({ where: { id: req.params.id, userId }, select: { id: true } });
    if (!owned) return res.status(404).json({ success: false, message: 'Lista no encontrada' });
    await prisma.$transaction(async (tx) => {
      if (isActive) await tx.wishlist.updateMany({ where: { userId, isActive: true, id: { not: owned.id } }, data: { isActive: false } });
      await tx.wishlist.update({ where: { id: owned.id }, data: { ...(newName ? { name: newName } : {}), ...(isActive ? { isActive: true } : {}) } });
    });
    const lists = await prisma.wishlist.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: WISHLIST_LIST_SELECT });
    res.json({ success: true, lists: lists.map(publicList) });
  } catch (error) {
    console.error('Error updating wishlist:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Borra una lista con sus cartas; siempre queda al menos una, y si era la activa pasa a serlo la más antigua que quede
router.delete('/api/wishlists/:id', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const owned = await prisma.wishlist.findFirst({ where: { id: req.params.id, userId }, select: { id: true, isActive: true } });
    if (!owned) return res.status(404).json({ success: false, message: 'Lista no encontrada' });
    const done = await prisma.$transaction(async (tx) => {
      const rest = await tx.wishlist.findMany({ where: { userId, id: { not: owned.id } }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      if (rest.length === 0) return false;
      await tx.wishlist.delete({ where: { id: owned.id } });
      if (owned.isActive) await tx.wishlist.update({ where: { id: rest[0].id }, data: { isActive: true } });
      return true;
    });
    if (!done) return badRequest(res, 'Debes tener al menos una lista.');
    const lists = await prisma.wishlist.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: WISHLIST_LIST_SELECT });
    res.json({ success: true, lists: lists.map(publicList) });
  } catch (error) {
    console.error('Error deleting wishlist:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Lista pública de un jugador: solo si no la ocultó, y sin ningún dato privado. Muestra solo su lista activa
router.get('/api/users/:username/wishlist', async (req, res) => {
  try {
    const username = typeof req.params.username === 'string' ? req.params.username.trim() : '';
    const page = Number.parseInt(req.query.page, 10) || 1;
    if (!username || username.length > 60 || page < 1 || page > 100) return badRequest(res, 'Consulta inválida');
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true, publicTheme: true } });
    if (!user) return res.status(404).json({ success: false, message: 'Vendedor no encontrado' });
    const theme = user.publicTheme && typeof user.publicTheme === 'object' ? user.publicTheme : {};
    if (theme.showWishlist === 'off') return res.json({ success: true, hidden: true, total: 0, page: 1, pages: 1, items: [] });

    const [total, rows] = await prisma.$transaction([
      prisma.wishlistItem.count({ where: { userId: user.id, wishlist: { isActive: true }, moderationState: 'visible' } }),
      prisma.wishlistItem.findMany({
        where: { userId: user.id, wishlist: { isActive: true }, moderationState: 'visible' },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * WISHLIST_PAGE_SIZE,
        take: WISHLIST_PAGE_SIZE,
        select: WISHLIST_OWN_SELECT,
      }),
    ]);
    res.json({
      success: true,
      hidden: false,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / WISHLIST_PAGE_SIZE)),
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        imageUrl: row.imageUrl,
        quantity: row.quantity,
        note: row.note,
        maxPrice: row.priceVisible ? row.maxPrice : null,
        tcg: row.game || WISHLIST_GAME_BY_CATEGORY[row.categoryId] || null,
        detail: row.detail,
      })),
    });
  } catch (error) {
    console.error('Error loading public wishlist:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
