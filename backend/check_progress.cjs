const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const count = await prisma.tcgProduct.count({ where: { categoryId: 99, physicalProductId: { not: null } } }); 
    console.log('Updated:', count); 
}
run().finally(() => prisma.$disconnect());
