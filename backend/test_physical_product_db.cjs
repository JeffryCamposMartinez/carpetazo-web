const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const cards = await prisma.tcgProduct.findMany({
    where: { physicalProductId: { not: null } },
    take: 5
  });
  console.log("Cards with physicalProductId:", cards.length);
  
  const allCards = await prisma.tcgProduct.count();
  console.log("Total cards:", allCards);
}
run().finally(() => prisma.$disconnect());
