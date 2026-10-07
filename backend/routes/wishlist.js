// Lista de cartas deseadas.
import express from 'express';
import { authenticateToken, currentUserId } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { badRequest, hasControlChars, isAllowedStoredImageUrl, isOptionalText, isShortText, isValidPrice } from '../core/validation.js';

const router = express.Router();

// --- Lista de cartas deseadas ---
const WISHLIST_MAX_ITEMS = 200;
const WISHLIST_PAGE_SIZE = 24;
const WISHLIST_GAMES = ['Pokémon', 'Mitos y Leyendas', 'One Piece', 'Magic', 'Yu-Gi-Oh!', 'Riftbound'];
const WISHLIST_GAME_BY_CATEGORY = { 1: 'Pokémon', 99: 'Mitos y Leyendas', 68: 'One Piece', 89: 'Riftbound', 1001: 'Magic', 2: 'Yu-Gi-Oh!' };
// Juegos que se buscan directo en TCGCSV: categoría de TCGCSV -> categoría guardada, juego y nombre con que se guardan las carpetas.
// (La categoría de Magic en TCGCSV es 1, igual que la que se guarda para Pokémon: por eso Magic se guarda como 1001.)
const WISHLIST_TCGCSV = {
  3: { stored: 1, game: 'Pokémon' },
  85: { stored: 1, game: 'Pokémon' },
  68: { stored: 68, game: 'One Piece' },
  1: { stored: 1001, game: 'Magic' },
  89: { stored: 89, game: 'Riftbound' },
  2: { stored: 2, game: 'Yu-Gi-Oh!' },
};
const WISHLIST_OWN_SELECT = { id: true, categoryId: true, productId: true, name: true, game: true, detail: true, imageUrl: true, quantity: true, maxPrice: true, priceVisible: true, note: true, createdAt: true };

// Juego: solo los de la lista del sitio ("Pokemon" sin tilde se acepta). null = sin juego; undefined = inválido
const normalizeWishlistGame = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const GAME_ALIASES = { Pokemon: 'Pokémon', YuGiOh: 'Yu-Gi-Oh!', OnePiece: 'One Piece' }; // nombres con que se guardan las carpetas
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

router.get('/api/wishlist/me', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const items = await prisma.wishlistItem.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, take: WISHLIST_MAX_ITEMS, select: WISHLIST_OWN_SELECT });
    res.json({ success: true, items, limit: WISHLIST_MAX_ITEMS });
  } catch (error) {
    console.error('Error loading wishlist:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// Cartas de la lista que hoy tienen otros vendedores (catálogos públicos, con stock y dentro del precio máximo)
const WISHLIST_MATCH_TCG = { 1: 'Pokemon', 99: 'Mitos y Leyendas', 68: 'OnePiece', 89: 'Riftbound', 1001: 'Magic', 2: 'YuGiOh' };
const WISHLIST_MATCHES_PER_ITEM = 5;
router.get('/api/wishlist/matches', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    const items = await prisma.wishlistItem.findMany({ where: { userId, productId: { not: null } }, take: WISHLIST_MAX_ITEMS, select: { id: true, categoryId: true, productId: true, maxPrice: true } });
    // tcgId de la carta = id del producto (las del catálogo de Pokémon se guardan como `tcgcsv:<cat>:<id>`)
    const wanted = items.map((item) => ({ ...item, tcgId: String(item.productId).replace(/^tcgcsv:\d+:/, ''), tcg: WISHLIST_MATCH_TCG[item.categoryId] })).filter((item) => item.tcg && /^\d{1,12}$/.test(item.tcgId));
    if (wanted.length === 0) return res.json({ success: true, matches: {} });

    const cards = await prisma.card.findMany({
      where: { stock: { gt: 0 }, price: { not: null }, moderationState: 'visible', tcgId: { in: [...new Set(wanted.map((item) => item.tcgId))] }, folder: { isPublic: true, userId: { not: userId } } },
      orderBy: { price: 'asc' },
      take: 2000,
      select: { id: true, tcgId: true, price: true, stock: true, folder: { select: { id: true, name: true, tcg: true, user: { select: { name: true, username: true, photoURL: true } } } } },
    });
    const matches = {};
    wanted.forEach((item) => {
      const found = cards.filter((card) => card.tcgId === item.tcgId && card.folder.tcg === item.tcg && (item.maxPrice == null || card.price <= item.maxPrice));
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
    res.json({ success: true, matches });
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
    const catalog = productId
      ? await prisma.tcgProduct.findUnique({ where: { productId }, select: { productId: true, name: true, imageUrl: true, categoryId: true, group: { select: { name: true } } } })
      : null;
    let identity;
    if (catalog) {
      identity = { productId: catalog.productId, categoryId: catalog.categoryId, name: catalog.name, game: WISHLIST_GAME_BY_CATEGORY[catalog.categoryId] || game, detail: catalog.group?.name || detail, imageUrl: catalog.imageUrl || null };
    } else if (external !== undefined) {
      // Cartas de TCGCSV (Pokémon 3 y 85, One Piece 68, Magic 1, Riftbound 89, Yu-Gi-Oh! 2): el catálogo no está en la base, el identificador se valida por forma
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

    const item = await prisma.$transaction(async (tx) => {
      const existing = identity.productId
        ? await tx.wishlistItem.findUnique({ where: { userId_productId: { userId, productId: identity.productId } } })
        : await tx.wishlistItem.findFirst({ where: { userId, productId: null, detail: identity.detail, name: { equals: identity.name, mode: 'insensitive' } } });
      if (existing) {
        // La misma carta no se duplica: se suma a la cantidad que ya buscaba
        const quantity = Math.min(99, existing.quantity + (parsed.data.quantity ?? 1));
        return tx.wishlistItem.update({ where: { id: existing.id }, data: { ...parsed.data, quantity }, select: WISHLIST_OWN_SELECT });
      }
      if ((await tx.wishlistItem.count({ where: { userId } })) >= WISHLIST_MAX_ITEMS) return null;
      return tx.wishlistItem.create({ data: { userId, ...identity, ...parsed.data }, select: WISHLIST_OWN_SELECT });
    });
    if (!item) return badRequest(res, `Tu lista ya tiene ${WISHLIST_MAX_ITEMS} cartas. Quita alguna para agregar más.`);
    res.json({ success: true, item });
  } catch (error) {
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

// Lista pública de un jugador: solo si no la ocultó, y sin ningún dato privado
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
      prisma.wishlistItem.count({ where: { userId: user.id, moderationState: 'visible' } }),
      prisma.wishlistItem.findMany({
        where: { userId: user.id, moderationState: 'visible' },
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
