const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const products = await prisma.tcgPhysicalProduct.findMany({
    take: 1
  });
  console.log("Returned from Prisma Client:", Object.keys(products[0]));
}
run().finally(() => prisma.$disconnect());
