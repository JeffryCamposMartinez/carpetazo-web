import { ONE_PIECE_CATEGORY } from './tcgcsvOnePiece';
import { MAGIC_CATEGORY, MAGIC_MARKER } from './tcgcsvMagic';
import { RIFTBOUND_CATEGORY, RIFTBOUND_MARKER } from './tcgcsvRiftbound';

// Juegos que se buscan directo en TCGCSV. `searchCategory` es el valor de la carpeta: '1' = Pokémon, '68' = One Piece, 'magic' = Magic, 'riftbound' = Riftbound.
// Devuelve la categoría de TCGCSV (Pokémon: 3 en inglés y 85 en japonés) o null si el juego se busca en la base de Carpetazo.
export const tcgcsvCategoryId = (searchCategory, lang) => {
  if (searchCategory === '1') return lang === 'ja' ? 85 : 3;
  if (searchCategory === String(ONE_PIECE_CATEGORY)) return ONE_PIECE_CATEGORY;
  if (searchCategory === MAGIC_MARKER) return MAGIC_CATEGORY;
  if (searchCategory === RIFTBOUND_MARKER) return RIFTBOUND_CATEGORY;
  return null;
};
