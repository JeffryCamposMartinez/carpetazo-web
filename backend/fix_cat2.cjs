const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const result = await prisma.tcgGroup.updateMany({
    where: { blockId: 2 },
    data: { categoryId: 99 }
  });
  console.log(`Updated ${result.count} groups to categoryId 99.`);
}
run().finally(() => prisma.$disconnect());
