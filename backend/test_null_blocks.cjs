const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const groupsWithoutBlock = await prisma.tcgGroup.findMany({
    where: { categoryId: 99, blockId: null }
  });
  console.log('Groups without block:', groupsWithoutBlock.length);
  
  const groupsWithBlock = await prisma.tcgGroup.findMany({
    where: { categoryId: 99, blockId: { not: null } }
  });
  console.log('Groups with block:', groupsWithBlock.length);
}
main().finally(() => prisma.$disconnect());
