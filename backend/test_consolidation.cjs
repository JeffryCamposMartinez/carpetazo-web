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
  const products = await prisma.tcgProduct.findMany({
    where: { categoryId: 99 }
  });
  
  // 1. Group products by cleaned name
  const groupsData = {}; // { [cleanName]: { blockIds: {}, products: [] } }
  
  for (const p of products) {
    const rawProd = p.extData?.product || 'Otros';
    const cleanName = cleanProductName(rawProd);
    
    if (!groupsData[cleanName]) {
      groupsData[cleanName] = { blockIds: {}, products: [] };
    }
    
    // Find blockId by looking at its CURRENT tcgGroup
    const currGroup = await prisma.tcgGroup.findUnique({ where: { groupId: p.groupId } });
    const blockId = currGroup?.blockId || 3; // Default to Primera Era if null
    
    groupsData[cleanName].blockIds[blockId] = (groupsData[cleanName].blockIds[blockId] || 0) + 1;
    groupsData[cleanName].products.push(p);
  }
  
  // 2. Create new groups
  let nextGroupId = 999000;
  for (const [name, data] of Object.entries(groupsData)) {
    // Find most frequent blockId
    let maxBlockId = 3;
    let maxCount = 0;
    for (const [bId, count] of Object.entries(data.blockIds)) {
      if (count > maxCount) {
        maxCount = count;
        maxBlockId = parseInt(bId);
      }
    }
    
    console.log(`Creating ${name} in Block ${maxBlockId} with ${data.products.length} cards`);
  }
}
main().finally(() => prisma.$disconnect());
