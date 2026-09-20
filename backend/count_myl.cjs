const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function count() {
    const total = await prisma.tcgProduct.count({ where: { categoryId: 99 }});
    console.log("Total MYL products:", total);
}
count().catch(console.error).finally(() => prisma.$disconnect());
