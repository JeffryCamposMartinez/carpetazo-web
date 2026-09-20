const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const baseDir = "C:\\Users\\Jeffry\\Desktop\\Definitivo cartas myl";

async function check() {
    const existingProducts = await prisma.tcgProduct.findMany({ select: { productId: true, groupId: true, group: { select: { name: true, blockId: true } } } });
    const productMap = new Map();
    for (const p of existingProducts) productMap.set(p.productId, p);
    
    const dirs = fs.readdirSync(baseDir);
    let skipped = 0;
    for (const d of dirs) {
        const p = path.join(baseDir, d);
        if (fs.statSync(p).isDirectory()) {
            for (const f of fs.readdirSync(p)) {
                if (f.endsWith('.json')) {
                    const data = JSON.parse(fs.readFileSync(path.join(p, f)));
                    if (productMap.has(data.id)) {
                        skipped++;
                        if (skipped === 1) {
                            console.log("Example skipped card:", data.name, data.id);
                            console.log("DB info:", productMap.get(data.id));
                        }
                    }
                }
            }
        }
    }
    console.log("Total skipped:", skipped);
}
check().catch(console.error).finally(() => prisma.$disconnect());
