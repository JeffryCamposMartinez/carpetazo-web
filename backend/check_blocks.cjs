const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const products = await prisma.tcgPhysicalProduct.findMany({
    include: {
      products: {
        include: {
          group: true
        }
      }
    }
  });
  
  // See if any products have cards from multiple blocks
  const multiBlock = [];
  products.forEach(p => {
    const blocks = new Set(p.products.map(card => card.group ? card.group.blockId : null).filter(b => b != null));
    if (blocks.size > 1) {
      multiBlock.push(`${p.name} (${[...blocks].join(', ')})`);
    }
  });
  console.log("Multi-block products:", multiBlock.length > 0 ? multiBlock : "None!");
}
run().finally(() => prisma.$disconnect());
