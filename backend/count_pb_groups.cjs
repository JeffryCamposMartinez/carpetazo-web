const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function count() {
    const groups = await prisma.tcgGroup.findMany({ where: { blockId: 2 } });
    console.log("Groups in blockId 2:");
    for (const g of groups) {
        const c = await prisma.tcgProduct.count({ where: { groupId: g.groupId } });
        console.log(`- ${g.name}: ${c} cards`);
    }
}
count().catch(console.error).finally(() => prisma.$disconnect());
