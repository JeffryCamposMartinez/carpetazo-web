const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const cards = await prisma.tcgProduct.findMany({
    where: { name: { contains: 'Apolonio' } },
    select: { name: true, physicalProductId: true }
  });
  console.log(cards);
}
run().finally(() => prisma.$disconnect());
