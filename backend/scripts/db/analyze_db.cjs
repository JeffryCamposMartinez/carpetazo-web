const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log("Analyzing DB...");
    // The user wants cards without ability. 
    // In Prisma, `extData` seems to hold the JSON?
    // Let's first fetch one product to see the shape.
    const p = await prisma.tcgProduct.findFirst();
    console.log(JSON.stringify(p, null, 2));

    // Mitos y Leyendas categoryId is probably something specific, but let's check extData.
    const products = await prisma.tcgProduct.findMany({
        where: {
            extData: {
                not: null
            }
        },
        take: 1000 // Just load some to inspect
    });

    let noAbility = [];
    for (const prod of products) {
        if (prod.extData && typeof prod.extData === 'object') {
            const effect = prod.extData.effect || prod.extData.habilidad || prod.extData.efecto;
            if (effect === undefined || effect === null || String(effect).trim() === '' || String(effect).trim().toLowerCase() === 'sin habilidad') {
                noAbility.push(prod);
            }
        }
    }
    console.log(`Found ${noAbility.length} products with no ability out of ${products.length} scanned.`);
    
    const fs = require('fs');
    fs.writeFileSync('db_no_ability.json', JSON.stringify(noAbility, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
