const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const result = await prisma.tcgProduct.updateMany({
    where: { group: { blockId: 2 } },
    data: { categoryId: 99 }
  });
  console.log(`Updated ${result.count} products to categoryId 99.`);
}
run().finally(() => prisma.$disconnect());
