const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const parseEdition = (url) => {
  const match = url.match(/https:\/\/cdn\.mazos\.cl\/([^\/]+)\/([^\/]+)\//);
  if (!match) {
    if (url.includes('FURIA_EXT')) return { blockId: 1, name: 'Especiales' };
    if (url.includes('PRIMER_BLOQUE')) return { blockId: 2, name: 'Especiales' };
    if (url.includes('PRIMERA_ERA')) return { blockId: 3, name: 'Especiales' };
    return { blockId: 3, name: 'Otros' };
  }
  
  const b = match[1];
  let blockId = 3;
  if (b === 'FURIA_EXT') blockId = 1;
  else if (b === 'PRIMER_BLOQUE') blockId = 2;
  else if (b === 'PRIMERA_ERA') blockId = 3;
  else if (b === 'cards') {
     const blockStr = match[2];
     if (blockStr === 'primer-bloque') return { blockId: 2, name: 'Otros' };
     return { blockId: 3, name: 'Otros' };
  }
  
  let name = match[2];
  name = name.replace(/^\d+-/, '').replace(/-/g, ' ');
  // Special overrides
  if (name === 'Leyendas3PB') name = 'Leyendas';
  if (name === 'Leyendas1PB') name = 'Leyendas';
  if (name === 'LBF2') name = 'Leyendas';
  if (name === 'uploads') name = 'Otros';
  
  return { blockId, name };
};

async function main() {
  const products = await prisma.tcgProduct.findMany({ where: { categoryId: 99 } });
  
  const editions = new Set();
  
  for (const p of products) {
    const url = p.extData?.imageUrl || '';
    const { blockId, name } = parseEdition(url);
    editions.add(`${blockId} | ${name}`);
  }
  
  console.log(Array.from(editions).sort());
}
main().finally(() => prisma.$disconnect());
