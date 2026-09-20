const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const baseDir = "C:\\Users\\Jeffry\\Desktop\\mitos y leyendas";

const blockMap = {
    "primer-bloque": 2,
    "primera-era": 3,
    "furia-extendido": 1
};

async function main() {
    console.log("Starting MYL sync to DB...");
    const blocks = fs.readdirSync(baseDir).filter(f => fs.statSync(path.join(baseDir, f)).isDirectory());
    
    let addedGroups = 0;
    let addedProducts = 0;
    
    // Group Cache mapping product_name -> groupId
    const groupCache = {};
    const existingGroups = await prisma.tcgGroup.findMany({ where: { categoryId: 99 } });
    
    let maxGroupId = 999200;
    for (const g of existingGroups) {
        groupCache[g.name] = g.groupId;
        if (g.groupId > maxGroupId) maxGroupId = g.groupId;
    }
    
    const existingProducts = await prisma.tcgProduct.findMany({ select: { productId: true } });
    const productIds = new Set(existingProducts.map(p => p.productId));

    for (const blockName of blocks) {
        const blockId = blockMap[blockName] || null;
        const blockPath = path.join(baseDir, blockName);
        for (const typeFolder of fs.readdirSync(blockPath)) {
            const typePath = path.join(blockPath, typeFolder);
            if (!fs.statSync(typePath).isDirectory()) continue;
            
            const files = fs.readdirSync(typePath).filter(f => f.endsWith(".json"));
            for (const file of files) {
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(typePath, file), "utf8"));
                    const productId = data.id;
                    
                    if (productIds.has(productId)) continue; // Already in DB
                    
                    let groupName = data.product || blockName;
                    let groupId = groupCache[groupName];
                    
                    if (!groupId) {
                        maxGroupId++;
                        const newGroup = await prisma.tcgGroup.create({
                            data: {
                                groupId: maxGroupId,
                                categoryId: 99,
                                name: groupName,
                                blockId: blockId,
                                publishedOn: new Date(),
                                modifiedOn: new Date()
                            }
                        });
                        groupId = newGroup.groupId;
                        groupCache[groupName] = groupId;
                        addedGroups++;
                        console.log(`Created new group: ${groupName} (groupId: ${groupId})`);
                    }
                    
                    const cleanName = data.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "");
                    const extData = [];
                    if (data.type) extData.push({ name: 'Type', value: data.type });
                    if (data.cost !== undefined && data.cost !== null) extData.push({ name: 'Cost', value: data.cost.toString() });
                    if (data.attack !== undefined && data.attack !== null) extData.push({ name: 'Fuerza', value: data.attack.toString() });
                    if (data.race && data.race.length > 0) extData.push({ name: 'Race', value: data.race.join(", ") });
                    if (data.effect) extData.push({ name: 'Effect', value: data.effect });
                    
                    await prisma.tcgProduct.create({
                        data: {
                            productId: productId,
                            categoryId: 99,
                            name: data.name,
                            cleanName: cleanName,
                            imageUrl: data.imageUrl || '',
                            extData: extData,
                            groupId: groupId
                        }
                    });
                    
                    productIds.add(productId);
                    addedProducts++;
                    if (addedProducts % 500 === 0) console.log(`Added ${addedProducts} new variants...`);
                    
                } catch (e) {
                    console.error(`Error processing ${file}: ${e.message}`);
                }
            }
        }
    }
    
    console.log(`Sync complete! Added ${addedGroups} new groups and ${addedProducts} new variant products.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
