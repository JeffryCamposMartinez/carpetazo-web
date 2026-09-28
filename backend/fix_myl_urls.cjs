const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dbs = ['Furia_Extendido_DB', 'Primera_Era_DB', 'Imperio_DB'];
  
  for (const db of dbs) {
    const wrongSegment = `/Carpetazo.cl/Mitos_y_Leyendas/${db}_Images/`;
    const rightSegment = `/Carpetazo.cl/Mitos_y_Leyendas/${db}/${db.replace('_DB', '_Images')}/`;

    console.log(`Fixing URLs for ${db}...`);
    const cards = await prisma.tcgProduct.findMany({
      where: {
        categoryId: 99,
        imageUrl: { contains: wrongSegment }
      }
    });

    console.log(`Found ${cards.length} cards with bad URLs for ${db}.`);

    let count = 0;
    for (const card of cards) {
      const newUrl = card.imageUrl.replace(wrongSegment, rightSegment);
      await prisma.tcgProduct.update({
        where: { productId: card.productId },
        data: { imageUrl: newUrl }
      });
      count++;
    }
    console.log(`Fixed ${count} cards for ${db}.`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
