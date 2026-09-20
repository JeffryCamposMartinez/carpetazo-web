const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const products = await prisma.tcgPhysicalProduct.findMany({
    orderBy: { name: 'asc' },
    take: 20
  });
  console.log(products.map(p => p.name));
}
run().finally(() => prisma.$disconnect());
