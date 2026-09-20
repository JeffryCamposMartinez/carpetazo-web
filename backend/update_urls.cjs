const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const baseDir = "C:\\Users\\Jeffry\\Desktop\\Definitivo cartas myl";

async function update() {
    console.log("Updating existing cards to new Definitivo URLs...");
    const dirs = fs.readdirSync(baseDir);
    let updated = 0;
    for (const d of dirs) {
        const p = path.join(baseDir, d);
        if (fs.statSync(p).isDirectory()) {
            for (const f of fs.readdirSync(p)) {
                if (f.endsWith('.json')) {
                    const data = JSON.parse(fs.readFileSync(path.join(p, f)));
                    const imgFileName = f.replace('.json', '.webp');
                    const newUrl = `https://api.carpetazo.cl/images/myl/Definitivo/${encodeURIComponent(d)}/${encodeURIComponent(imgFileName)}`;
                    
                    await prisma.tcgProduct.updateMany({
                        where: { productId: data.id },
                        data: { imageUrl: newUrl }
                    });
                    updated++;
                    if (updated % 500 === 0) console.log(`Updated ${updated} URLs...`);
                }
            }
        }
    }
    console.log("Total updated:", updated);
}
update().catch(console.error).finally(() => prisma.$disconnect());
