const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "TcgProduct" ALTER COLUMN "productId" TYPE TEXT USING "productId"::text;');
    console.log("Success altering TcgProduct");
  } catch (e) { console.error(e); }
  finally { await prisma.$disconnect(); }
}
run();
