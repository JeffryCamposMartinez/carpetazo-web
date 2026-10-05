const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dbs = ['Furia_Extendido_DB', 'Primera_Era_DB', 'Imperio_DB'];
  
  for (const db of dbs) {
    const wrongSegment = `/Carpetazo.cl/Mitos_y_Leyendas/${db}_Images/`;
    const rightSegment = `/Carpetazo.cl/Mitos_y_Leyendas/${db}/${db.replace('_DB', '_Images')}/`;

    console.log(`Fixing URLs for ${db} via raw SQL...`);
    const result = await prisma.$executeRawUnsafe(`
      UPDATE "TcgProduct"
      SET "imageUrl" = REPLACE("imageUrl", '${wrongSegment}', '${rightSegment}')
      WHERE "imageUrl" LIKE '%${wrongSegment}%' AND "categoryId" = 99
    `);
    console.log(`Fixed rows for ${db}:`, result);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
