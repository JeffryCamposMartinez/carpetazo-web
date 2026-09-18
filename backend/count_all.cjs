const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  const folders = await prisma.folder.count();
  const cards = await prisma.card.count();
  const messages = await prisma.message.count();
  const orders = await prisma.order.count();
  const tcgCategories = await prisma.tcgCategory.count();
  const tcgGroups = await prisma.tcgGroup.count();
  const tcgProducts = await prisma.tcgProduct.count();

  console.log(`Users: ${users}`);
  console.log(`Folders: ${folders}`);
  console.log(`Cards: ${cards}`);
  console.log(`Messages: ${messages}`);
  console.log(`Orders: ${orders}`);
  console.log(`TCG Categories: ${tcgCategories}`);
  console.log(`TCG Groups: ${tcgGroups}`);
  console.log(`TCG Products: ${tcgProducts}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
