const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Analyzing blocks...");
  const blocks = await prisma.tcgBlock.findMany();
  console.log("Existing blocks:", blocks);
  
  // Ensure Imperio exists
  let imperioBlock = blocks.find(b => b.name === 'Imperio');
  if (!imperioBlock) {
    imperioBlock = await prisma.tcgBlock.create({
      data: {
        categoryId: 99,
        name: 'Imperio'
      }
    });
    console.log("Created Imperio block:", imperioBlock);
    blocks.push(imperioBlock);
  }

  const blockMap = {
    'Primer_Bloque_DB': blocks.find(b => b.name === 'Primer Bloque')?.id,
    'Primera_Era_DB': blocks.find(b => b.name === 'Primera Era')?.id,
    'Furia_Extendido_DB': blocks.find(b => b.name === 'Furia Extendido')?.id,
    'Imperio_DB': imperioBlock.id
  };

  console.log("Block map:", blockMap);

  const groups = await prisma.tcgGroup.findMany({
    where: { categoryId: 99, blockId: null },
    include: { products: { take: 1 } }
  });

  console.log(`Found ${groups.length} groups with null blockId.`);

  let updatedCount = 0;
  for (const group of groups) {
    if (group.products.length > 0) {
      const url = group.products[0].imageUrl;
      let matchedBlockId = null;
      for (const [dbName, bId] of Object.entries(blockMap)) {
        if (url.includes(dbName)) {
          matchedBlockId = bId;
          break;
        }
      }
      
      if (matchedBlockId) {
        await prisma.tcgGroup.update({
          where: { groupId: group.groupId },
          data: { blockId: matchedBlockId }
        });
        updatedCount++;
        console.log(`Updated group ${group.name} to blockId ${matchedBlockId}`);
      }
    }
  }

  console.log(`Done. Updated ${updatedCount} groups.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
