const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const prods = await prisma.tcgPhysicalProduct.findMany({
    orderBy: { releaseDate: 'asc' },
    take: 10
  });
  console.log(prods.map(p => `${p.name}: ${p.releaseDate}`));
}
run().finally(() => prisma.$disconnect());
