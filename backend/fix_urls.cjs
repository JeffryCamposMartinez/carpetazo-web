const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const baseDir = "C:\\Users\\Jeffry\\Desktop\\mitos y leyendas";

async function main() {
    console.log("Updating image URLs in DB...");
    const blocks = fs.readdirSync(baseDir).filter(f => fs.statSync(path.join(baseDir, f)).isDirectory());
    
    let updated = 0;

    for (const blockName of blocks) {
        const blockPath = path.join(baseDir, blockName);
        for (const typeFolder of fs.readdirSync(blockPath)) {
            const typePath = path.join(blockPath, typeFolder);
            if (!fs.statSync(typePath).isDirectory()) continue;
            
            const files = fs.readdirSync(typePath).filter(f => f.endsWith(".json"));
            for (const file of files) {
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(typePath, file), "utf8"));
                    const productId = data.id;
                    
                    const imgFile = file.replace('.json', '.webp');
                    const newUrl = `https://api.carpetazo.cl/images/myl/${encodeURIComponent(blockName)}/${encodeURIComponent(typeFolder)}/${encodeURIComponent(imgFile)}`;
                    
                    await prisma.tcgProduct.update({
                        where: { productId: productId },
                        data: { imageUrl: newUrl }
                    });
                    
                    updated++;
                    if (updated % 500 === 0) console.log(`Updated ${updated} URLs...`);
                } catch (e) {
                    // Ignore cards that might not exist in DB or other errors
                }
            }
        }
    }
    
    console.log(`Finished updating ${updated} image URLs to api.carpetazo.cl!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
