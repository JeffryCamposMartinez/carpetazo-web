const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const cleanProductName = (prod) => {
  if (!prod || prod.includes('.webp') || prod === 'uploads') return 'Otros';
  if (prod === 'ElReto') return 'El Reto';
  if (prod === 'primer bloque') return 'Otros'; // They are just random uploads
  return prod;
};

async function main() {
  await prisma.tcgGroup.deleteMany({
    where: { groupId: { gte: 999000 } }
  });

  const products = await prisma.tcgProduct.findMany({
    where: { categoryId: 99 }
  });
  
  const groupsData = {}; // { "1|Hijos de Daana": { products: [] } }
  
  for (const p of products) {
    const rawProd = p.extData?.product || 'Otros';
    const cleanName = cleanProductName(rawProd);
    
    // Extract Block from URL
    const url = p.extData?.imageUrl || '';
    const match = url.match(/https:\/\/cdn\.mazos\.cl\/([^\/]+)\//);
    let blockId = 3; // Default Primera Era
    if (match) {
       if (match[1] === 'FURIA_EXT') blockId = 1;
       else if (match[1] === 'PRIMER_BLOQUE') blockId = 2;
       else if (match[1] === 'PRIMERA_ERA') blockId = 3;
       else if (match[1] === 'cards' && url.includes('primer-bloque')) blockId = 2;
    }
    
    const key = `${blockId}|${cleanName}`;
    
    if (!groupsData[key]) {
      groupsData[key] = { blockId, name: cleanName, products: [] };
    }
    
    groupsData[key].products.push(p);
  }
  
  let nextGroupId = 999000;
  
  // Create New Groups
  for (const [key, data] of Object.entries(groupsData)) {
    const newGroupId = nextGroupId++;
    
    await prisma.tcgGroup.create({
      data: {
        groupId: newGroupId,
        categoryId: 99,
        blockId: data.blockId,
        name: data.name,
        publishedOn: new Date(),
        modifiedOn: new Date()
      }
    });
    
    // Update products
    const productIds = data.products.map(p => p.productId);
    for (let i = 0; i < productIds.length; i += 500) {
      const batch = productIds.slice(i, i + 500);
      await prisma.tcgProduct.updateMany({
        where: { productId: { in: batch } },
        data: { groupId: newGroupId }
      });
    }
    console.log(`Migrated ${data.name} (Block ${data.blockId}) -> ${productIds.length} cards`);
  }
  
  // Delete Old Groups
  const oldGroups = await prisma.tcgGroup.findMany({ where: { categoryId: 99, groupId: { lt: 999000 } } });
  for (const g of oldGroups) {
     try {
       await prisma.tcgGroup.delete({ where: { groupId: g.groupId } });
     } catch (e) {
       console.log(`Could not delete group ${g.groupId}`);
     }
  }
  console.log(`Migration finished.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
