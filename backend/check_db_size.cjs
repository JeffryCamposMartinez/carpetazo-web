const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSize() {
  try {
    const result = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size;`;
    const count = await prisma.tcgProduct.count();
    console.log(`Database Size: ${result[0].size}`);
    console.log(`Products in DB: ${count}`);
    await prisma.$disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkSize();
