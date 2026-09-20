const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const products = await prisma.tcgPhysicalProduct.findMany({
    orderBy: { name: 'asc' }
  });
  console.log(products.map(p => p.name).filter(n => n.includes('.webp') || n.includes('Aniversario') || n.includes('MazosCL')));
}
run().finally(() => prisma.$disconnect());
