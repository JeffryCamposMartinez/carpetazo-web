const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const groups = await prisma.tcgGroup.findMany({
    where: { 
      categoryId: 99,
      name: { contains: 'Daana', mode: 'insensitive' }
    }
  });
  console.log('Daana:', groups.map(g => g.name));

  const groups2 = await prisma.tcgGroup.findMany({
    where: { 
      categoryId: 99,
      name: { contains: 'Tierras Altas', mode: 'insensitive' }
    }
  });
  console.log('Tierras Altas:', groups2.map(g => g.name));

  const groups3 = await prisma.tcgGroup.findMany({
    where: { 
      categoryId: 99,
      name: { contains: 'Encrucijada', mode: 'insensitive' }
    }
  });
  console.log('Encrucijada:', groups3.map(g => g.name));
  
  const allGroups = await prisma.tcgGroup.findMany({
    where: { categoryId: 99 }
  });
  console.log('Total MYL groups:', allGroups.length);
}
main().finally(() => prisma.$disconnect());
