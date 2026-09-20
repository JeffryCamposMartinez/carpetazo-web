const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function wipe() {
    console.log("Wiping Primer Bloque products...");
    const res = await prisma.tcgProduct.deleteMany({
        where: { group: { blockId: 2 } }
    });
    console.log(`Deleted ${res.count} products.`);
    
    // Wipe groups too?
    const groups = await prisma.tcgGroup.deleteMany({
        where: { blockId: 2 }
    });
    console.log(`Deleted ${groups.count} groups.`);
}

wipe().catch(console.error).finally(() => prisma.$disconnect());
