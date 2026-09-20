const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const products = await prisma.tcgPhysicalProduct.findMany({
    include: {
      products: { include: { group: true } }
    }
  });
  
  let updates = 0;
  for (const p of products) {
    const counts = {};
    p.products.forEach(card => {
      if (card.group && card.group.blockId) {
        counts[card.group.blockId] = (counts[card.group.blockId] || 0) + 1;
      }
    });
    
    if (Object.keys(counts).length > 0) {
      let maxBlockId = null;
      let maxCount = -1;
      for (const [bId, count] of Object.entries(counts)) {
        if (count > maxCount) {
          maxCount = count;
          maxBlockId = parseInt(bId);
        }
      }
      console.log(`${p.name} -> Block ${maxBlockId} (${maxCount} cards)`);
    }
  }
}
run().finally(() => prisma.$disconnect());
