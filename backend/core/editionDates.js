import { prisma } from './db.js';

// TCGplayer pone el mismo día de carga (con horas distintas) a decenas de ediciones sueltas: promos, «Miscellaneous», cajas especiales…
// Esa fecha no dice cuándo salió la edición y las deja como «las más nuevas». Se reconocen porque un día de lanzamiento real
// trae a lo sumo una docena de ediciones: desde BULK_SETS ediciones en el mismo día (UTC), ese día se trata como «sin fecha» (va al final).
const BULK_SETS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

// Una sola consulta pequeña (agrupa unas 2.000 ediciones): sin caché, así un cambio en el catálogo se nota de inmediato
export const bulkPublishedRanges = async () => {
  const rows = await prisma.$queryRaw`SELECT to_char("publishedOn", 'YYYY-MM-DD') AS day FROM "CatalogSet" WHERE "publishedOn" IS NOT NULL GROUP BY 1 HAVING count(*) >= ${BULK_SETS}`;
  return rows.map((row) => { const from = new Date(`${row.day}T00:00:00Z`); return { from, to: new Date(from.getTime() + DAY_MS) }; });
};

// La fecha de la edición si es confiable; null si falta o cae en un día de carga masiva
export const reliablePublishedOn = (date, ranges) => (date && !ranges.some((range) => date >= range.from && date < range.to) ? date : null);
