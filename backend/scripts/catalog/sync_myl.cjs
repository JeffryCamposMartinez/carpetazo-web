// Mitos y Leyendas: compara mazos.cl con la base y dice qué haría la sincronización. NO escribe nada (etapa 1: solo simulación).
//   node scripts/catalog/sync_myl.cjs                      los 4 bloques (Primer Bloque, Furia Extendido, Primera Era e Imperio)
//   --only=imperio,primer-bloque                           solo esos bloques (clave de mazos.cl)
//   --limit-products=5                                     solo los primeros N productos de cada bloque (para pruebas rápidas)
//   --check-images=300                                     revisa en R2 una muestra de N imágenes de cartas ya guardadas
//   --report=informe.json                                  guarda el informe completo (cartas nuevas, correcciones…)
const fs = require('fs');

const args = process.argv.slice(2);
const opt = (name) => { const hit = args.find((arg) => arg.startsWith(`--${name}=`)); return hit ? hit.slice(name.length + 3) : undefined; };
const CHUNK = 5000;

(async () => {
  await import('../../core/env.js');
  const { prisma } = await import('../../core/db.js');
  const { MazosClient } = await import('../../core/mylSync/mazos.js');
  const { MYL_BLOCKS, MYL_CATEGORY, cleanName, collectBlock, planBlock } = await import('../../core/mylSync/plan.js');
  const only = opt('only') ? opt('only').split(',') : null;
  const limitProducts = Number(opt('limit-products')) || 0;
  const checkImages = Number(opt('check-images')) || 0;
  const client = new MazosClient();
  const reports = [];
  try {
    for (const block of MYL_BLOCKS.filter((item) => !only || only.includes(item.key))) {
      const dbBlock = await prisma.tcgBlock.findFirst({ where: { categoryId: MYL_CATEGORY, name: block.name } });
      if (!dbBlock) { console.log(`\n${block.name}: no existe en la base, se omite`); continue; }
      console.log(`\n== ${block.name}`);

      let products = await client.products(block.key);
      if (limitProducts) products = products.slice(0, limitProducts);
      const productCards = [];
      for (const [index, product] of products.entries()) {
        productCards.push({ name: product.name, cards: await client.productCards(product.id) });
        if ((index + 1) % 20 === 0) console.log(`   productos ${index + 1}/${products.length}`);
      }
      const catalogCards = [];
      if (!limitProducts) {
        for await (const { page, pages, cards } of client.catalog(block.key)) {
          catalogCards.push(...cards);
          if (page % 10 === 0 || page === pages) console.log(`   catálogo ${page}/${pages}`);
        }
      }
      const cards = collectBlock({ productCards, catalogCards });

      const ids = [...cards.keys()];
      const existing = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        existing.push(...await prisma.tcgProduct.findMany({ where: { productId: { in: ids.slice(i, i + CHUNK) } }, select: { productId: true, name: true, imageUrl: true, extData: true, group: { select: { blockId: true } } } }));
      }
      const groups = await prisma.tcgGroup.findMany({ where: { blockId: dbBlock.id }, select: { name: true } });
      const physical = await prisma.tcgPhysicalProduct.findMany({ where: { categoryId: MYL_CATEGORY, blockId: dbBlock.id }, select: { name: true } });
      const blockCards = await prisma.tcgProduct.findMany({ where: { group: { blockId: dbBlock.id } }, select: { productId: true } });
      const report = planBlock({ ...block, id: dbBlock.id }, cards, {
        existingById: new Map(existing.map((card) => [card.productId, { ...card, blockId: card.group?.blockId }])),
        groupNames: new Set(groups.map((group) => cleanName(group.name))),
        productNames: new Set(physical.map((product) => product.name)),
        blockCardIds: new Set(blockCards.map((card) => card.productId)),
      });

      if (checkImages) {
        const sample = existing.filter((card) => card.imageUrl).sort(() => Math.random() - 0.5).slice(0, checkImages);
        let broken = 0;
        for (const card of sample) {
          try { const response = await fetch(card.imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(15000) }); if (!response.ok) broken++; } catch (_) { broken++; }
        }
        report.imagenesRevisadas = sample.length;
        report.imagenesRotas = broken;
      }

      const { nuevas, correcciones, enOtroBloque } = report;
      console.log(JSON.stringify({ ...report, nuevas: nuevas.length, correcciones: correcciones.length, enOtroBloque: enOtroBloque.length }, null, 1));
      reports.push(report);
    }
    if (opt('report')) fs.writeFileSync(opt('report'), JSON.stringify(reports, null, 1));
    console.log('\nSIMULACIÓN: no se escribió nada.');
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => { console.error('ERROR:', error.message); process.exit(1); });
