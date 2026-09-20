const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const mylCat = await prisma.tcgCategory.findFirst({ where: { name: 'Mitos y Leyendas' }});
  const groups = await prisma.tcgGroup.findMany({
    where: { categoryId: mylCat.id },
    include: {
      _count: {
        select: { products: true }
      }
    }
  });
  console.log("All MYL Groups:");
  for (const g of groups) {
    if (g._count.products > 0) {
      console.log(`- ${g.name} (${g.id}): ${g._count.products} cards`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
