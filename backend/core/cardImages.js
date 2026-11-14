// Imagen de las cartas a la venta en los listados públicos. La carta guarda la imagen que tenía al publicarse; si el catálogo la recibió
// después (TCGplayer o una foto de la comunidad aprobada por Moderación) se toma de ahí al leer, igual que en la carpeta.
import { isMylTcg } from './mylIdentity.js';
import { r2PublicUrl } from './tcgCatalogImport.js';
import { hasRealImage } from './catalogPhotos.js';

const OWN_CARD_PHOTO = /\/Usuarios\/[^/]+\/card\/[0-9a-f]{32}\.webp$/;
const SPANISH_CARD_IMAGE = /^https:\/\/assets\.tcgdex\.net\/|\/Pokemon_Espanol\//;

// Una carta con foto propia se guarda con «-custom-<hora>» detrás del id del catálogo
const baseId = (tcgId) => Number(String(tcgId ?? '').replace(/-custom-\d{1,16}$/, ''));

// `cards` necesita imageUrl, tcgId, language y folder.tcg. Devuelve las mismas cartas con imageUrl resuelta.
// Con foto propia se conserva, y la imagen del catálogo (la aprobada por Moderación) va en `fallbackImageUrl` por si esa foto ya no existe.
export async function withCatalogImages(db, cards) {
  const productIds = [...new Set(cards.filter((card) => !isMylTcg(card.folder?.tcg)).map((card) => baseId(card.tcgId)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!productIds.length) return cards;
  const rows = await db.catalogCard.findMany({ where: { productId: { in: productIds }, kind: 'card' }, select: { productId: true, imageKey: true, spanishImageKey: true } });
  const byId = new Map(rows.map((row) => [row.productId, row]));
  return cards.map((card) => {
    if (isMylTcg(card.folder?.tcg)) return card;
    const row = byId.get(baseId(card.tcgId));
    const language = card.language || (card.data && typeof card.data === 'object' ? card.data.language : null); // en el listado el idioma viene dentro de `data`
    const key = row ? (language === 'Spanish' && hasRealImage(row.spanishImageKey) ? row.spanishImageKey : hasRealImage(row.imageKey) ? row.imageKey : null) : null;
    if (card.imageUrl && OWN_CARD_PHOTO.test(card.imageUrl)) return key ? { ...card, fallbackImageUrl: r2PublicUrl(key) } : card;
    if (card.imageUrl && language === 'Spanish' && SPANISH_CARD_IMAGE.test(card.imageUrl)) return card;
    return key ? { ...card, imageUrl: r2PublicUrl(key) } : card;
  });
}
