const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TCGCSV_BASE = 'https://tcgcsv.com/tcgplayer';
const HEADERS = { 'User-Agent': 'CarpetazoApp/1.0' };

// IDs to sync (3 = Pokemon, 62 = One Piece, 1 = Magic, 2 = YuGiOh, 71 = Lorcana)
const TARGET_CATEGORIES = [3, 62, 1, 2, 71]; 

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function sync() {
  console.log('Starting TCGCSV Sync...');

  try {
    // 1. Sync Categories
    console.log('Fetching categories...');
    const catRes = await fetch(`${TCGCSV_BASE}/categories`, { headers: HEADERS });
    const catData = await catRes.json();
    
    let categories = catData.results;
    if (TARGET_CATEGORIES.length > 0) {
      categories = categories.filter(c => TARGET_CATEGORIES.includes(c.categoryId));
    }

    for (const cat of categories) {
      await prisma.tcgCategory.upsert({
        where: { categoryId: cat.categoryId },
        update: { name: cat.name, modifiedOn: new Date(cat.modifiedOn) },
        create: { categoryId: cat.categoryId, name: cat.name, modifiedOn: new Date(cat.modifiedOn) }
      });
    }
    console.log(`Synced ${categories.length} categories.`);

    // 2. Sync Groups for each target category
    for (const cat of categories) {
      console.log(`Fetching groups for ${cat.name}...`);
      const groupRes = await fetch(`${TCGCSV_BASE}/${cat.categoryId}/groups`, { headers: HEADERS });
      const groupData = await groupRes.json();
      
      let count = 0;
      for (const grp of groupData.results) {
        await prisma.tcgGroup.upsert({
          where: { groupId: grp.groupId },
          update: { name: grp.name, publishedOn: new Date(grp.publishedOn), modifiedOn: new Date(grp.modifiedOn) },
          create: { 
            groupId: grp.groupId, 
            categoryId: cat.categoryId,
            name: grp.name, 
            publishedOn: new Date(grp.publishedOn),
            modifiedOn: new Date(grp.modifiedOn)
          }
        });
        count++;
      }
      console.log(`Synced ${count} groups for ${cat.name}.`);

      // 3. Sync Products for each group in this category
      // To avoid massive memory/time usage, we will just sync the 10 most recent groups for each category in this demo.
      // In production, you would sync all of them.
      const recentGroups = groupData.results
        .sort((a,b) => new Date(b.publishedOn) - new Date(a.publishedOn))
        .slice(0, 15); // limit to 15 newest sets for now

      for (const grp of recentGroups) {
        console.log(`  Fetching products for group: ${grp.name}...`);
        try {
          const prodRes = await fetch(`${TCGCSV_BASE}/${cat.categoryId}/${grp.groupId}/products`, { headers: HEADERS });
          const prodData = await prodRes.json();
          
          if (!prodData.results) continue;
          
          let pCount = 0;
          for (const prod of prodData.results) {
             const cleanName = prod.cleanName || prod.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
             await prisma.tcgProduct.upsert({
               where: { productId: prod.productId },
               update: {
                 name: prod.name,
                 cleanName: cleanName,
                 imageUrl: prod.imageUrl || '',
                 extData: prod.extData || {}
               },
               create: {
                 productId: prod.productId,
                 groupId: grp.groupId,
                 categoryId: cat.categoryId,
                 name: prod.name,
                 cleanName: cleanName,
                 imageUrl: prod.imageUrl || '',
                 extData: prod.extData || {}
               }
             });
             pCount++;
          }
          console.log(`    Synced ${pCount} products.`);
        } catch (err) {
          console.error(`    Error syncing group ${grp.name}:`, err.message);
        }
        await delay(500); // Respect rate limits
      }
    }
    
    console.log('Sync Complete!');
  } catch (error) {
    console.error('Fatal Sync Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

sync();
