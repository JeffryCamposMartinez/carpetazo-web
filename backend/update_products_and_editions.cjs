const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function run() {
  console.log("Reading metadata...");
  const metadata = JSON.parse(fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/metadata_pb.json', 'utf8'));
  
  const metaMap = new Map();
  metadata.forEach(c => {
    metaMap.set(c.id, c);
  });

  console.log("Creating/Fetching core editions...");
  const editionNames = [
    { original: '💛 Dominios de RA', clean: 'Dominios de RA' },
    { original: '💚 Hijos de Daana', clean: 'Hijos de Daana' },
    { original: '♥️ Helénica', clean: 'Helénica' },
    { original: '🩵 Espada Sagrada', clean: 'Espada Sagrada' },
    { original: '🧛 Drácula e Inferno', clean: 'Drácula e Inferno' }
  ];

  const editionGroups = {};
  for (const ed of editionNames) {
    let group = await prisma.tcgGroup.findFirst({ where: { name: ed.clean, blockId: 2 } });
    if (!group) {
        const maxGroup = await prisma.tcgGroup.findFirst({ orderBy: { groupId: 'desc' } });
        const newId = maxGroup ? maxGroup.groupId + 1 : 999300;
        group = await prisma.tcgGroup.create({
            data: {
                groupId: newId,
                name: ed.clean,
                categoryId: 99,
                blockId: 2,
                publishedOn: new Date(),
                modifiedOn: new Date()
            }
        });
    }
    editionGroups[ed.original] = group.groupId;
  }

  console.log("Creating physical products...");
  const physicalProducts = {};
  const subtitles = new Set();
  metadata.forEach(c => {
    if (c.subtitle) subtitles.add(c.subtitle);
  });

  for (const sub of Array.from(subtitles)) {
    let pp = await prisma.tcgPhysicalProduct.findFirst({ where: { name: sub } });
    if (!pp) {
      pp = await prisma.tcgPhysicalProduct.create({ data: { name: sub } });
    }
    physicalProducts[sub] = pp.id;
  }

  console.log("Updating cards in DB...");
  const productsInDb = await prisma.tcgProduct.findMany({
    where: { categoryId: 99 } // Process all Mitos y Leyendas cards
  });
  console.log(`Found ${productsInDb.length} cards to process...`);

  let updatedCount = 0;
  for (const prod of productsInDb) {
    const meta = metaMap.get(prod.productId);
    if (meta) {
      const edOriginal = meta.edition?.name;
      const subtitle = meta.subtitle;
      
      const newGroupId = edOriginal ? editionGroups[edOriginal] : null;
      const newPhysicalId = subtitle ? physicalProducts[subtitle] : null;

      if (newGroupId) {
        await prisma.tcgProduct.update({
          where: { productId: prod.productId },
          data: {
            groupId: newGroupId,
            physicalProductId: newPhysicalId
          }
        });
        updatedCount++;
      }
    }
  }

  console.log(`Successfully updated ${updatedCount} cards.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
