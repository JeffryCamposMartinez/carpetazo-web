const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const groups = await prisma.tcgGroup.findMany({ where: { categoryId: 99 }});
    console.log(groups);
}
run().finally(() => prisma.$disconnect());
