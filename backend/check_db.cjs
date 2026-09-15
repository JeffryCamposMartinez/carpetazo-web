const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const products = await prisma.tcgProduct.findMany({
    take: 10
  });
  console.log(JSON.stringify(products, null, 2));
  
  const groups = await prisma.tcgGroup.findMany({
    take: 2
  });
  console.log(JSON.stringify(groups, null, 2));
  
  await prisma.$disconnect();
}

check();
