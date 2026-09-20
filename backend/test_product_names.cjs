const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const products = await prisma.tcgProduct.findMany({
    where: { categoryId: 99 },
    select: { extData: true }
  });
  const productsSet = new Set();
  for (const p of products) {
    if (p.extData && p.extData.product) {
      productsSet.add(p.extData.product);
    }
  }
  console.log(Array.from(productsSet).sort());
}
main().finally(() => prisma.$disconnect());
