// Sincroniza Card.imageUrl con TcgProduct.imageUrl (por tcgId) cuando las URLs de los productos se migraron
// y las cartas ya guardadas en carpetas quedaron con la ruta vieja.
// Uso: node scripts/pokemon/sync_card_image_urls.cjs [--dry-run] [--backup=ruta.json]
// Solo modifica Card.imageUrl; antes de escribir guarda un respaldo (id -> URL vieja) y verifica que la URL nueva responda 200.
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
} catch (_) {
  // dotenv es opcional si el entorno ya está cargado
}

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const backupArg = process.argv.find(a => a.startsWith('--backup='));
const BACKUP_PATH = backupArg
  ? backupArg.slice('--backup='.length)
  : path.join(__dirname, `card-image-urls-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

const urlExists = async (url) => {
  try {
    return (await fetch(url, { method: 'HEAD' })).ok;
  } catch {
    return false;
  }
};

const main = async () => {
  console.log(`Modo: ${DRY_RUN ? 'dry-run (no escribe)' : 'actualiza la base de datos'}`);

  const cards = await prisma.card.findMany({ select: { id: true, tcgId: true, name: true, imageUrl: true } });
  const products = await prisma.tcgProduct.findMany({
    where: { productId: { in: [...new Set(cards.map(c => String(c.tcgId)))] } },
    select: { productId: true, imageUrl: true },
  });
  const productUrl = new Map(products.map(p => [p.productId, p.imageUrl]));

  const stale = cards.filter(c => {
    const next = productUrl.get(String(c.tcgId));
    return next && c.imageUrl !== next;
  });
  console.log(`Cartas: ${cards.length} · desactualizadas: ${stale.length}`);

  // La URL nueva debe existir en R2; si no, se omite la carta
  const okUrls = new Map();
  for (const url of new Set(stale.map(c => productUrl.get(String(c.tcgId))))) okUrls.set(url, await urlExists(url));
  const toUpdate = stale.filter(c => okUrls.get(productUrl.get(String(c.tcgId))));
  const skipped = stale.length - toUpdate.length;
  if (skipped) console.log(`Omitidas (la URL nueva no responde): ${skipped}`);

  if (DRY_RUN || toUpdate.length === 0) {
    console.log(`Se actualizarían ${toUpdate.length} cartas.`);
    return;
  }

  fs.writeFileSync(
    BACKUP_PATH,
    JSON.stringify(toUpdate.map(c => ({ id: c.id, tcgId: c.tcgId, name: c.name, oldImageUrl: c.imageUrl })), null, 2)
  );
  console.log(`Respaldo guardado en ${BACKUP_PATH}`);

  const result = await prisma.$transaction(
    toUpdate.map(c => prisma.card.update({ where: { id: c.id }, data: { imageUrl: productUrl.get(String(c.tcgId)) } }))
  );
  console.log(`Actualizadas: ${result.length}`);
};

main()
  .catch(err => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
