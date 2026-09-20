const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const physicalProductId = 141; // some valid id
  let whereClause = { categoryId: 99 };
  whereClause.physicalProductId = parseInt(physicalProductId);
  
  const cards = await prisma.tcgProduct.findMany({
    where: whereClause,
    take: 10
  });
  console.log("Found cards:", cards.length);
  if (cards.length > 0) {
    console.log("First card physicalProductId:", cards[0].physicalProductId);
  }
}
run().finally(() => prisma.$disconnect());
