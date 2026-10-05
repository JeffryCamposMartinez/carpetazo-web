// Listados públicos paginados (carpetas y vendedores): filtros y orden en la base.
import { Prisma } from '@prisma/client';
import { prisma } from './db.js';

const currentWeekNumber = () => Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
// Texto de búsqueda seguro para ILIKE (se escapan \, % y _)
export const likePattern = (text) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;
// Un juego puede estar guardado con otro nombre en las carpetas (Pokemon / Pokémon, YuGiOh / Yu-Gi-Oh!, OnePiece / One Piece)
export const tcgVariants = (name) => {
  const stored = CARD_SEARCH_TCG_ALIASES[name];
  const shown = Object.entries(CARD_SEARCH_TCG_ALIASES).find(([, value]) => value === name)?.[0];
  return [...new Set([name, stored, shown].filter(Boolean))];
};
export const validListText = (...texts) => texts.every((text) => text.length <= 80 && !/[\u0000-\u001f]/.test(text));

// Carpetas públicas con dueño y cantidad de cartas, en el orden de los ids recibidos
export const loadPublicFolders = async (ids) => {
  if (ids.length === 0) return [];
  const week = currentWeekNumber();
  const rows = await prisma.folder.findMany({
    where: { id: { in: ids }, isPublic: true },
    select: {
      id: true, name: true, tcg: true, color: true, createdAt: true, totalVisits: true, weeklyVisits: true, lastVisitWeek: true,
      user: { select: { name: true, username: true, photoURL: true } },
      _count: { select: { cards: true } }
    }
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.filter((id) => byId.has(id)).map((id) => {
    const row = byId.get(id);
    return { ...row, validWeeklyVisits: row.lastVisitWeek === week ? row.weeklyVisits : 0, validTotalVisits: row.totalVisits };
  });
};

export const folderFilterSql = ({ like, tcgs }) => Prisma.sql`f."isPublic" = true
  ${like ? Prisma.sql`AND (f."name" ILIKE ${like} OR u."name" ILIKE ${like} OR u."username" ILIKE ${like})` : Prisma.empty}
  ${tcgs ? Prisma.sql`AND f."tcg" = ANY(${tcgs})` : Prisma.empty}`;
export const folderOrderSql = (sort) => {
  if (sort === 'name') return Prisma.sql`LOWER(f."name") ASC, f."createdAt" DESC`;
  if (sort === 'total') return Prisma.sql`f."totalVisits" DESC, f."createdAt" DESC`;
  return Prisma.sql`(CASE WHEN f."lastVisitWeek" = ${currentWeekNumber()} THEN f."weeklyVisits" ELSE 0 END) DESC, f."totalVisits" DESC, f."createdAt" DESC`;
};
// Las carpetas guardan el juego como Pokemon / YuGiOh / OnePiece; el sitio lo muestra como Pokémon / Yu-Gi-Oh! / One Piece
export const CARD_SEARCH_TCG_ALIASES = { 'Pokémon': 'Pokemon', 'Yu-Gi-Oh!': 'YuGiOh', 'One Piece': 'OnePiece' };
