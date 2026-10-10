// Historial de precios: cada pocas horas se guarda el precio más bajo publicado de cada carta con stock (uno por día; el último del día queda).
import { prisma } from './db.js';

const EVERY_MS = 3 * 60 * 60 * 1000;
const KEEP_DAYS = 400;

export const recordPriceSnapshots = async () => {
  const saved = await prisma.$executeRaw`
    INSERT INTO "CardPriceSnapshot" ("id", "tcg", "tcgId", "day", "lowest", "offers")
    SELECT gen_random_uuid()::text, f."tcg", c."tcgId", (now() AT TIME ZONE 'America/Santiago')::date, MIN(c."price"), COUNT(*)::int
    FROM "Card" c JOIN "Folder" f ON f."id" = c."folderId"
    WHERE c."stock" > 0 AND c."price" > 0 AND c."moderationState" = 'visible' AND f."isPublic" = true AND f."moderationState" = 'visible'
    GROUP BY f."tcg", c."tcgId"
    ON CONFLICT ("tcg", "tcgId", "day") DO UPDATE SET "lowest" = EXCLUDED."lowest", "offers" = EXCLUDED."offers"`;
  await prisma.cardPriceSnapshot.deleteMany({ where: { day: { lt: new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000) } } });
  return saved;
};

let running = false;
export const startPriceHistory = () => {
  if (process.env.TEST_AUTH_STUB) return; // las pruebas lo ejecutan a mano
  const tick = async () => {
    if (running) return;
    running = true;
    try { await recordPriceSnapshots(); } catch (error) { console.error('Error guardando el historial de precios:', error.message); } finally { running = false; }
  };
  setTimeout(tick, 45 * 1000).unref();
  setInterval(tick, EVERY_MS).unref();
};
