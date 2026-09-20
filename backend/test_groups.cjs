const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const groups = await prisma.tcgGroup.findMany({
        where: { categoryId: 99 },
        orderBy: { groupId: 'desc' }
    });
    console.log("Max groupId:", groups[0]?.groupId);
    console.log(groups);
}
main().catch(console.error).finally(() => prisma.$disconnect());
