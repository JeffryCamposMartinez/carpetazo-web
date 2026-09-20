const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const blocks = await prisma.tcgBlock.findMany();
  console.log(JSON.stringify(blocks, null, 2));
}
main().finally(() => prisma.$disconnect());
