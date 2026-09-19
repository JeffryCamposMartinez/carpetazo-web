const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const MYL_CATEGORY_ID = 99;
const MYL_ID_OFFSET = 9900000;
const MYL_GROUP_OFFSET = 99000;

async function run() {
    // 1. Create Category
    await prisma.tcgCategory.upsert({
        where: { categoryId: MYL_CATEGORY_ID },
        update: { name: "Mitos y Leyendas", modifiedOn: new Date() },
        create: { categoryId: MYL_CATEGORY_ID, name: "Mitos y Leyendas", modifiedOn: new Date() }
    });

    const baseDir = "C:\\Users\\Jeffry\\Desktop\\mitos y leyendas";
    const blocks = fs.readdirSync(baseDir).filter(f => fs.statSync(path.join(baseDir, f)).isDirectory());

    let groupCache = {}; // { "Edition Name": groupId }
    let productCache = {}; // { "Product Name": physicalProductId }

    let nextGroupId = MYL_GROUP_OFFSET;

    for (const blockName of blocks) {
        // 2. Create Block
        let block = await prisma.tcgBlock.findFirst({ where: { name: blockName, categoryId: MYL_CATEGORY_ID } });
        if (!block) {
            block = await prisma.tcgBlock.create({ data: { name: blockName, categoryId: MYL_CATEGORY_ID } });
        }

        const blockPath = path.join(baseDir, blockName);
        for (const typeFolder of fs.readdirSync(blockPath)) {
            const typePath = path.join(blockPath, typeFolder);
            if (!fs.statSync(typePath).isDirectory()) continue;

            for (const file of fs.readdirSync(typePath)) {
                if (!file.endsWith(".json")) continue;
                const filePath = path.join(typePath, file);
                const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

                // Parse Edition
                const rawProd = data.product || 'Otros';
                let editionName = rawProd;
                if (!editionName || editionName.includes('.webp') || editionName === 'uploads') editionName = 'Otros';
                if (editionName === 'ElReto') editionName = 'El Reto';
                if (editionName === 'primer bloque') editionName = 'Otros';
                
                // Extract block from URL
                let parsedBlockId = 3;
                const match = data.imageUrl?.match(/https:\/\/cdn\.mazos\.cl\/([^\/]+)\//);
                if (match) {
                    if (match[1] === 'FURIA_EXT') parsedBlockId = 1;
                    else if (match[1] === 'PRIMER_BLOQUE') parsedBlockId = 2;
                    else if (match[1] === 'PRIMERA_ERA') parsedBlockId = 3;
                    else if (match[1] === 'cards' && data.imageUrl.includes('primer-bloque')) parsedBlockId = 2;
                }
                
                const groupKey = `${parsedBlockId}|${editionName}`;
                
                if (!groupCache[groupKey]) {
                    let group = await prisma.tcgGroup.findFirst({ where: { name: editionName, blockId: parsedBlockId, categoryId: MYL_CATEGORY_ID } });
                    if (!group) {
                        group = await prisma.tcgGroup.create({
                            data: {
                                groupId: nextGroupId++,
                                categoryId: MYL_CATEGORY_ID,
                                blockId: parsedBlockId,
                                name: editionName,
                                publishedOn: new Date(),
                                modifiedOn: new Date()
                            }
                        });
                    }
                    groupCache[groupKey] = group.groupId;
                }

                // Parse Physical Product
                let physProdId = null;
                if (data.product) {
                    if (!productCache[data.product]) {
                        let phys = await prisma.tcgPhysicalProduct.findFirst({ where: { name: data.product } });
                        if (!phys) {
                            phys = await prisma.tcgPhysicalProduct.create({ data: { name: data.product } });
                        }
                        productCache[data.product] = phys.id;
                    }
                    physProdId = productCache[data.product];
                }

                // Insert Card
                const cardId = MYL_ID_OFFSET + data.id;
                // Save WebP image URL
                let imageUrl = data.imageUrl; // Original URL
                // Actually, the user wants us to upload the images to the VPS.
                // We will serve them from /images/myl/
                // So the image path in the DB should be the local path
                const localImageUrl = `https://api.carpetazo.cl/images/myl/${blockName}/${typeFolder}/${data.id}.webp`.replace(/ /g, "%20");

                // Clean name
                const cleanName = data.name.toLowerCase().replace(/[^a-z0-9]/g, '');

                await prisma.tcgProduct.upsert({
                    where: { productId: cardId },
                    update: {
                        groupId: groupCache[groupKey],
                        physicalProductId: physProdId,
                        extData: data,
                        imageUrl: localImageUrl
                    },
                    create: {
                        productId: cardId,
                        groupId: groupCache[editionName],
                        categoryId: MYL_CATEGORY_ID,
                        physicalProductId: physProdId,
                        name: data.name,
                        cleanName: cleanName,
                        imageUrl: localImageUrl,
                        extData: data
                    }
                });
            }
        }
        console.log(`Finished Block: ${blockName}`);
    }
    console.log("Done inserting Mitos y Leyendas!");
}

run().catch(console.error).finally(() => prisma.$disconnect());
