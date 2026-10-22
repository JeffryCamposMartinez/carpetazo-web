// Ficha pública de una carta del catálogo de TCGplayer: la usan la página /catalogo/<id> (JSON para la web) y la página para buscadores.
// Solo datos públicos del catálogo y las ofertas visibles de carpetas públicas.
import { r2PublicUrl } from './tcgCatalogImport.js';
import { eligibleSales, loadLiveOffers, loadSales, offersAnchor } from './priceIntegrity.js';

// CatalogGame.name guarda el nombre de carpeta del juego; estas son las etiquetas que ve la gente
export const GAME_LABELS = { Pokemon: 'Pokémon', Pokemon_Japan: 'Pokémon Japón', One_Piece: 'One Piece', Magic: 'Magic: The Gathering', YuGiOh: 'Yu-Gi-Oh!', Riftbound: 'Riftbound', Disney_Lorcana: 'Disney Lorcana', Digimon_Card_Game: 'Digimon Card Game' };
export const gameLabel = (name) => GAME_LABELS[name] || String(name || '').replace(/_/g, ' ');
export const PRODUCT_ID = /^[1-9]\d{0,9}$/;
const OFFERS_SHOWN = 20;
const OTHERS_SHOWN = 12;
const TEXT_KEYS = ['OracleText', 'CardText', 'Description', 'Effect'];
const visibleOffer = { stock: { gt: 0 }, moderationState: 'visible', folder: { isPublic: true, moderationState: 'visible' } };

// "Pikachu VMAX - 044/185" -> "pikachu-vmax-044-185": la dirección dice de qué carta se trata
export const slugOf = (name) => String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'carta';
export const catalogPath = (card) => `/catalogo/${card.productId}/${slugOf(card.name)}`;

const cardText = (attributes) => {
  if (!attributes || typeof attributes !== 'object') return '';
  for (const key of TEXT_KEYS) {
    const value = attributes[key];
    if (typeof value === 'string' && value.trim()) return value.replace(/\s+/g, ' ').trim().slice(0, 600);
  }
  return '';
};

const SELECT = { productId: true, categoryId: true, name: true, cleanName: true, number: true, rarity: true, imageKey: true, thumbKey: true, attributes: true, set: { select: { name: true } }, game: { select: { name: true } } };
const view = (row) => ({
  productId: row.productId, name: row.name, number: row.number, rarity: row.rarity, set: row.set?.name || '', game: row.game?.name || '', gameLabel: gameLabel(row.game?.name),
  imageUrl: r2PublicUrl(row.imageKey || row.thumbKey), path: catalogPath(row),
});

// Historial público por carta de catálogo. Las ventas presenciales son declaradas
// por el vendedor: se muestra el precio publicado por unidad, nunca el total ajustado.
export const loadCatalogSales = async (db, productId, tcg, days = 730, limit = 10) => {
  const tcgId = String(productId);
  const [sales, offers, inPersonRows] = await Promise.all([
    loadSales({ tcg, tcgIds: [tcgId], days }),
    loadLiveOffers({ tcg, tcgIds: [tcgId] }),
    db.$queryRaw`
      SELECT s."createdAt" AS "at",
             (line->>'unitPrice')::float AS "price",
             CASE WHEN line->>'quantity' ~ '^[0-9]{1,4}$' THEN (line->>'quantity')::int ELSE 1 END AS "quantity"
      FROM "InPersonSale" s
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s."items"::jsonb) = 'array' THEN s."items"::jsonb ELSE '[]'::jsonb END) AS line
      WHERE s."createdAt" > now() - make_interval(days => ${days}::int)
        AND line->>'tcgId' = ${tcgId}
        AND COALESCE(line->>'tcg', ${tcg}) = ${tcg}
        AND line->>'unitPrice' ~ '^[0-9]+(\\.[0-9]+)?$'
    `,
  ]);
  const anchor = offersAnchor(offers);
  const confirmed = eligibleSales(sales, anchor).map((sale) => ({ at: sale.at, price: Math.round(sale.unit), quantity: sale.quantity, source: 'confirmada' }));
  const inPerson = inPersonRows.filter((sale) => Number(sale.price) > 0).map((sale) => ({ at: sale.at, price: Math.round(Number(sale.price)), quantity: Number(sale.quantity) || 1, source: 'presencial' }));
  return [...confirmed, ...inPerson].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit);
};

// null si la carta no existe en el catálogo (o no es una carta: los sobres y cajas no tienen ficha)
export async function loadCatalogCard(db, productId) {
  const row = await db.catalogCard.findFirst({ where: { productId, kind: 'card' }, select: SELECT });
  if (!row) return null;
  const [offers, others] = await Promise.all([
    db.card.findMany({
      where: { tcgId: String(productId), ...visibleOffer },
      orderBy: [{ price: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: OFFERS_SHOWN,
      select: { id: true, price: true, stock: true, language: true, folder: { select: { id: true, user: { select: { name: true, username: true, publicComuna: true } } } } },
    }),
    // Otras impresiones de la misma carta (otra edición): enlaces internos útiles para quien busca y para los buscadores
    db.catalogCard.findMany({
      where: { categoryId: row.categoryId, kind: 'card', cleanName: row.cleanName, productId: { not: productId } },
      orderBy: { productId: 'desc' }, take: OTHERS_SHOWN, select: SELECT,
    }),
  ]);
  const prices = offers.map((offer) => offer.price).filter((price) => Number.isFinite(price) && price > 0);
  return {
    card: { ...view(row), categoryId: row.categoryId, text: cardText(row.attributes) },
    offers: offers.map((offer) => ({
      id: offer.id, price: offer.price, stock: offer.stock, language: offer.language,
      seller: { name: offer.folder.user?.name || offer.folder.user?.username || null, username: offer.folder.user?.username || null, comuna: offer.folder.user?.publicComuna || null },
    })),
    low: prices.length ? Math.min(...prices) : null,
    high: prices.length ? Math.max(...prices) : null,
    others: others.map(view),
  };
}
