const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const blocks = await prisma.tcgBlock.findMany({
        where: { name: { contains: 'Primer Bloque' } }
    });
    console.log(blocks);
}
check().catch(console.error).finally(() => prisma.$disconnect());
