const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

const MYL_ID_OFFSET = 9900000;

async function run() {
    const baseDir = "C:\\Users\\Jeffry\\Desktop\\mitos y leyendas";
    const blocks = fs.readdirSync(baseDir).filter(f => fs.statSync(path.join(baseDir, f)).isDirectory());

    for (const blockName of blocks) {
        const blockPath = path.join(baseDir, blockName);
        for (const typeFolder of fs.readdirSync(blockPath)) {
            const typePath = path.join(blockPath, typeFolder);
            if (!fs.statSync(typePath).isDirectory()) continue;

            for (const file of fs.readdirSync(typePath)) {
                if (!file.endsWith(".json")) continue;
                const filePath = path.join(typePath, file);
                const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

                const cardId = MYL_ID_OFFSET + data.id;
                // Fix: The image is named after the slug (or exactly file.replace('.json', '.webp'))
                const webpName = file.replace('.json', '.webp');
                const localImageUrl = `https://api.carpetazo.cl/images/myl/${blockName}/${typeFolder}/${webpName}`.replace(/ /g, "%20");

                await prisma.tcgProduct.update({
                    where: { productId: cardId },
                    data: { imageUrl: localImageUrl }
                });
            }
        }
        console.log(`Fixed URLs for: ${blockName}`);
    }
    console.log("Done fixing URLs!");
}

run().catch(console.error).finally(() => prisma.$disconnect());
