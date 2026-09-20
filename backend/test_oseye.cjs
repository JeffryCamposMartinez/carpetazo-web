const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const oseye = await prisma.tcgProduct.findMany({ 
    where: { cleanName: 'oseye' },
    include: { group: true }
  });
  console.log(oseye.map(o => `${o.name} - Group: ${o.group.name} - BlockId: ${o.group.blockId}`));
}
run().finally(() => prisma.$disconnect());
