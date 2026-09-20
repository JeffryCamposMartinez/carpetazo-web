const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.tcgProduct.findFirst({
    where: { categoryId: 99 }
  });
  console.log(p.extData);
}
main().finally(() => prisma.$disconnect());
