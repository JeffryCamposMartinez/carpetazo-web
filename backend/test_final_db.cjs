const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const groups = await prisma.tcgGroup.findMany({ where: { categoryId: 99 } });
  console.log(`Total MYL groups remaining: ${groups.length}`);
  const products = await prisma.tcgProduct.findMany({ where: { categoryId: 99 } });
  console.log(`Total MYL products: ${products.length}`);
}
main().finally(() => prisma.$disconnect());
