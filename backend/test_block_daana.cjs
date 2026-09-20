const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const groups = await prisma.tcgGroup.findMany({
    where: { 
      categoryId: 99,
      name: { contains: 'Colección Hijos de Daana', mode: 'insensitive' }
    }
  });
  console.log(JSON.stringify(groups, null, 2));
}
main().finally(() => prisma.$disconnect());
