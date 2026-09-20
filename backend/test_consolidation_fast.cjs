const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const cleanProductName = (prod) => {
  if (!prod || prod.includes('.webp') || prod === 'uploads') return 'Otros';
  if (prod === 'Daana' || prod === 'AniversarioHD') return 'Hijos de Daana';
  if (prod === 'AniversarioES') return 'Espada Sagrada';
  if (prod === 'AniversarioHE') return 'Helenica';
  if (prod === 'AniversarioRA') return 'Dominios de RA';
  if (prod === 'ElReto') return 'El Reto';
  if (prod === 'Leyendas1PB' || prod === 'Leyendas3PB') return 'Leyendas Primer Bloque';
  if (prod === 'MundosPerdidos2026 2' || prod === 'MundosPerdidos') return 'Mundos Perdidos';
  if (prod === 'primer bloque') return 'Primer Bloque';
  return prod;
};

async function main() {
  const groups = await prisma.tcgGroup.findMany({ where: { categoryId: 99 } });
  const groupBlockMap = new Map();
  for (const g of groups) groupBlockMap.set(g.groupId, g.blockId);

  const products = await prisma.tcgProduct.findMany({
    where: { categoryId: 99 }
  });
  
  const groupsData = {}; 
  
  for (const p of products) {
    const rawProd = p.extData?.product || 'Otros';
    const cleanName = cleanProductName(rawProd);
    
    if (!groupsData[cleanName]) {
      groupsData[cleanName] = { blockIds: {}, products: [] };
    }
    
    const blockId = groupBlockMap.get(p.groupId) || 3; 
    
    groupsData[cleanName].blockIds[blockId] = (groupsData[cleanName].blockIds[blockId] || 0) + 1;
    groupsData[cleanName].products.push(p);
  }
  
  let nextGroupId = 999000;
  for (const [name, data] of Object.entries(groupsData)) {
    let maxBlockId = 3;
    let maxCount = 0;
    for (const [bId, count] of Object.entries(data.blockIds)) {
      if (count > maxCount) {
        maxCount = count;
        maxBlockId = parseInt(bId);
      }
    }
    console.log(`Edition: ${name.padEnd(25)} | Block: ${maxBlockId} | Cards: ${data.products.length}`);
  }
}
main().finally(() => prisma.$disconnect());
