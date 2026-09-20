const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const products = await prisma.tcgProduct.findMany({
    where: { categoryId: 99 },
    take: 10,
    orderBy: [
      { physicalProduct: { releaseDate: 'desc' } },
      { name: 'asc' }
    ],
    include: { physicalProduct: true }
  });
  console.log(products.map(p => `${p.name} - ${p.physicalProduct ? p.physicalProduct.name : 'null'} - ${p.physicalProduct ? p.physicalProduct.releaseDate : 'null'}`));
}
run().finally(() => prisma.$disconnect());
