const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function count() {
    const total = await prisma.tcgProduct.count();
    console.log(`Total products in DB: ${total}`);
}
count().catch(console.error).finally(() => prisma.$disconnect());
