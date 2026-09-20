const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function count() {
    const groups = await prisma.tcgGroup.findMany({ where: { blockId: 2 } });
    const groupIds = groups.map(g => g.groupId);
    const total = await prisma.tcgProduct.count({ where: { groupId: { in: groupIds } } });
    console.log("Primer Bloque cards:", total);
}
count().catch(console.error).finally(() => prisma.$disconnect());
