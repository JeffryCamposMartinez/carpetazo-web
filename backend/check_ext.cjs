const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const card = await prisma.tcgProduct.findFirst({
    where: { group: { name: 'Espada Sagrada' } }
  });
  console.log(JSON.stringify(card.extData, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
