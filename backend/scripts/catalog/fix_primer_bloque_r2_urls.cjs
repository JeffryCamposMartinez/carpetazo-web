const path = require('path');
const { PrismaClient } = require('@prisma/client');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
} catch (_) {
  // dotenv is optional when the environment is already loaded.
}

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const CATEGORY_ID = 99;

const OLD_SEGMENT = '/Carpetazo.cl/Mitos_y_Leyendas/Primer_Bloque_Images/';
const NEW_SEGMENT = '/Carpetazo.cl/Mitos_y_Leyendas/Primer_Bloque_DB/Primer_Bloque_Images/';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bold: '\x1b[1m'
};

const log = {
  title: (message) => console.log(`\n${colors.bold}${colors.cyan}${message}${colors.reset}`),
  ok: (message) => console.log(`${colors.green}✓${colors.reset} ${message}`),
  warn: (message) => console.log(`${colors.yellow}⚠${colors.reset} ${message}`),
  error: (message) => console.log(`${colors.red}✗${colors.reset} ${message}`)
};

const main = async () => {
  log.title('🔧 Migración URLs R2 · Primer Bloque');
  console.log(`Modo: ${DRY_RUN ? 'dry-run, no escribe en DB' : 'actualiza DB'}`);

  const products = await prisma.tcgProduct.findMany({
    where: {
      categoryId: CATEGORY_ID,
      imageUrl: {
        contains: OLD_SEGMENT
      }
    },
    select: {
      productId: true,
      name: true,
      imageUrl: true
    }
  });

  const pending = products
    .filter((product) => !product.imageUrl.includes(NEW_SEGMENT))
    .map((product) => ({
      ...product,
      nextImageUrl: product.imageUrl.replace(OLD_SEGMENT, NEW_SEGMENT)
    }));

  if (pending.length === 0) {
    log.ok('No hay URLs antiguas pendientes de migrar.');
    return;
  }

  log.warn(`Productos a actualizar: ${pending.length}`);
  pending.slice(0, 5).forEach((product) => {
    console.log(`- ${product.productId} · ${product.name}`);
    console.log(`  ${product.imageUrl}`);
    console.log(`  ${product.nextImageUrl}`);
  });

  if (DRY_RUN) {
    log.warn('Dry-run terminado. Ejecuta sin --dry-run para actualizar.');
    return;
  }

  let updated = 0;
  for (const product of pending) {
    await prisma.tcgProduct.update({
      where: { productId: product.productId },
      data: { imageUrl: product.nextImageUrl }
    });
    updated += 1;

    if (updated % 50 === 0 || updated === pending.length) {
      log.ok(`Actualizadas ${updated}/${pending.length}`);
    }
  }

  log.ok(`Migración lista: ${updated} URLs actualizadas.`);
};

main()
  .catch((error) => {
    log.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
