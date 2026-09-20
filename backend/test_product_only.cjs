const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.tcgProduct.findMany({ where: { categoryId: 99 } });
  
  const editions = new Set();
  
  for (const p of products) {
    const rawProd = p.extData?.product || 'Otros';
    
    // Extract Block from URL
    const url = p.extData?.imageUrl || '';
    const match = url.match(/https:\/\/cdn\.mazos\.cl\/([^\/]+)\//);
    let blockId = 3;
    if (match) {
       if (match[1] === 'FURIA_EXT') blockId = 1;
       else if (match[1] === 'PRIMER_BLOQUE') blockId = 2;
       else if (match[1] === 'PRIMERA_ERA') blockId = 3;
       else if (match[1] === 'cards' && url.includes('primer-bloque')) blockId = 2;
    }
    
    editions.add(`${blockId} | ${rawProd}`);
  }
  
  console.log(Array.from(editions).sort());
}
main().finally(() => prisma.$disconnect());
