// Imagen de las cartas a la venta en los listados públicos. La carta guarda la imagen que tenía al publicarse; si el catálogo la recibió
// después (TCGplayer o una foto de la comunidad aprobada por Moderación) se toma de ahí al leer, igual que en la carpeta.
import { isMylTcg } from './mylIdentity.js';
import { r2PublicUrl } from './tcgCatalogImport.js';
import { hasRealImage } from './catalogPhotos.js';

const OWN_CARD_PHOTO = /\/Usuarios\/[^/]+\/card\/[0-9a-f]{32}\.webp$/;
const SPANISH_CARD_IMAGE = /^https:\/\/assets\.tcgdex\.net\/|\/Pokemon_Espanol\//;

// `cards` necesita imageUrl, tcgId, language y folder.tcg. Devuelve las mismas cartas con imageUrl resuelta.
export async function withCatalogImages(db, cards) {
  const productIds = [...new Set(cards.filter((card) => !isMylTcg(card.folder?.tcg)).map((card) => Number(card.tcgId)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!productIds.length) return cards;
  const rows = await db.catalogCard.findMany({ where: { productId: { in: productIds }, kind: 'card' }, select: { productId: true, imageKey: true, spanishImageKey: true } });
  const byId = new Map(rows.map((row) => [row.productId, row]));
  return cards.map((card) => {
    if (isMylTcg(card.folder?.tcg)) return card;
    if (card.imageUrl && (OWN_CARD_PHOTO.test(card.imageUrl) || (card.language === 'Spanish' && SPANISH_CARD_IMAGE.test(card.imageUrl)))) return card;
    const row = byId.get(Number(card.tcgId));
    if (!row) return card;
    const key = card.language === 'Spanish' && hasRealImage(row.spanishImageKey) ? row.spanishImageKey : hasRealImage(row.imageKey) ? row.imageKey : null;
    return key ? { ...card, imageUrl: r2PublicUrl(key) } : card;
  });
}
