const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log("Analyzing MyL (Category 99) in PostgreSQL DB...");
    const prods = await prisma.tcgProduct.findMany({
        where: { categoryId: 99 } 
    });

    let noAbility = [];
    for (const p of prods) {
        if (!p.extData || !Array.isArray(p.extData)) {
            noAbility.push(p);
            continue;
        }
        
        const effectObj = p.extData.find(e => e.name && e.name.toLowerCase() === 'effect');
        const effect = effectObj ? effectObj.value : '';

        if (!effect || String(effect).trim() === '' || String(effect).trim().toLowerCase() === 'sin habilidad' || String(effect).trim().toLowerCase() === 'n/a') {
            noAbility.push(p);
        }
    }

    console.log(`Total MyL products scanned: ${prods.length}`);
    console.log(`Missing effect count: ${noAbility.length}`);

    const fs = require('fs');
    const outputPath = 'reporte_db_myl_sin_habilidad.json';
    fs.writeFileSync(outputPath, JSON.stringify(noAbility, null, 2));
    console.log(`Saved report to ${outputPath}`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
