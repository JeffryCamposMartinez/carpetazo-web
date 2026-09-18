const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const groups = await prisma.tcgGroup.count();
  const products = await prisma.tcgProduct.count();
  console.log(`Groups in DB: ${groups}`);
  console.log(`Products in DB: ${products}`);
  await prisma.$disconnect();
}

check();
