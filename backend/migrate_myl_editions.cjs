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
  
  // Create New Groups
  for (const [name, data] of Object.entries(groupsData)) {
    let maxBlockId = 3;
    let maxCount = 0;
    for (const [bId, count] of Object.entries(data.blockIds)) {
      if (count > maxCount) {
        maxCount = count;
        maxBlockId = parseInt(bId);
      }
    }
    
    const newGroupId = nextGroupId++;
    await prisma.tcgGroup.create({
      data: {
        groupId: newGroupId,
        categoryId: 99,
        blockId: maxBlockId,
        name: name,
        publishedOn: new Date(),
        modifiedOn: new Date()
      }
    });
    
    // Update products
    const productIds = data.products.map(p => p.productId);
    await prisma.tcgProduct.updateMany({
      where: { productId: { in: productIds } },
      data: { groupId: newGroupId }
    });
    
    // Update physical products
    await prisma.tcgPhysicalProduct.updateMany({
      where: { categoryId: 99, groupId: { in: Object.keys(data.blockIds).map(Number) } },
      data: { groupId: newGroupId }
    });
    
    console.log(`Migrated ${name} (Block ${maxBlockId}) -> ${productIds.length} cards`);
  }
  
  // Delete Old Groups
  const oldGroups = groups.filter(g => g.groupId < 999000).map(g => g.groupId);
  await prisma.tcgGroup.deleteMany({
    where: { groupId: { in: oldGroups } }
  });
  console.log(`Deleted ${oldGroups.length} old product-based groups.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
