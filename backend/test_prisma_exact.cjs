const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const categoryId = '99';
  const blockId = '2';
  const physicalProductId = '6'; // Aniversario Espada Sagrada Kit Morgana

  let whereClause = {};
  whereClause.categoryId = parseInt(categoryId);
  whereClause.physicalProductId = parseInt(physicalProductId);

  const groups = await prisma.tcgGroup.findMany({ where: { blockId: parseInt(blockId) }, select: { groupId: true } });
  const groupIds = groups.map(g => g.groupId);
  whereClause.groupId = { in: groupIds };

  const cards = await prisma.tcgProduct.findMany({
    where: whereClause,
    orderBy: [
      { physicalProduct: { releaseDate: { sort: 'desc', nulls: 'last' } } },
      { name: 'asc' }
    ]
  });
  console.log("Returned cards count:", cards.length);
  if (cards.length > 0) {
    console.log("First card:", cards[0].name, "physicalProductId:", cards[0].physicalProductId);
  }
}
run().finally(() => prisma.$disconnect());
