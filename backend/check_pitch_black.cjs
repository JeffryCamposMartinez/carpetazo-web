const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const group = await prisma.tcgGroup.findFirst({
    where: { name: { contains: 'Pitch Black' } }
  });
  console.log('Group:', group);
  if (group) {
    const products = await prisma.tcgProduct.count({
      where: { groupId: group.groupId }
    });
    console.log('Product Count:', products);
  }
  await prisma.$disconnect();
}

check();
