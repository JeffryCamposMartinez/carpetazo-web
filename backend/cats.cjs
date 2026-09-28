const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const cats = await prisma.tcgCategory.findMany();
    console.log(cats);
}

run().catch(console.error).finally(() => prisma.$disconnect());
