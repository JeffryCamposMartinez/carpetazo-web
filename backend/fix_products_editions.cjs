const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getNextGroupId() {
    const lastGroup = await prisma.tcgGroup.findFirst({
        orderBy: { groupId: 'desc' },
        select: { groupId: true }
    });
    return (lastGroup?.groupId || 0) + 1;
}

async function main() {
    console.log("Migrando y limpiando Groups/Products para todos los bloques...");

    // 1. Limpiar sub-ediciones sueltas
    console.log("Consolidando sub-ediciones...");
    const badGroups = await prisma.tcgGroup.findMany({
        where: {
            OR: [
                { name: { startsWith: 'XS-' } },
                { name: { startsWith: 'AG-' } },
                { name: { startsWith: 'SU-' } },
                { name: { startsWith: 'MD-' } }
            ]
        }
    });

    for (const bad of badGroups) {
        const prefix = bad.name.split('-')[0]; // Ej: 'XS'
        
        let masterGroup = await prisma.tcgGroup.findFirst({
            where: { name: prefix, blockId: bad.blockId }
        });
        if (!masterGroup) {
            masterGroup = await prisma.tcgGroup.create({
                data: { 
                    groupId: await getNextGroupId(),
                    name: prefix, 
                    blockId: bad.blockId,
                    categoryId: 99,
                    publishedOn: new Date(),
                    modifiedOn: new Date()
                }
            });
        }
        
        await prisma.tcgProduct.updateMany({
            where: { groupId: bad.groupId },
            data: { groupId: masterGroup.groupId }
        });
        
        await prisma.tcgGroup.delete({ where: { groupId: bad.groupId } });
        console.log(`Consolidado ${bad.name} -> ${masterGroup.name}`);
    }

    // 2. Migrar "Groups" que en realidad son "Products"
    const productKeywords = [
        'Kit', 'Display', 'Mazo', 'Colección', 'Lootbox', 'Mystery Box', 
        'Toolkit', 'Relatos', 'Reinos Perdidos', 'Promocionales', 'Aniversario', 'Cartas', 'Pack', 'Caja', 'Premium'
    ];

    const allGroups = await prisma.tcgGroup.findMany({
        where: { blockId: { not: 2 } }
    });

    for (const group of allGroups) {
        if (group.name === 'Colección Básica' || group.name === 'Colección Blanca' || group.name === 'Colección Negra') continue;

        const isProduct = productKeywords.some(kw => group.name.toLowerCase().includes(kw.toLowerCase()));
        const isLongName = group.name.length > 25 && !group.name.includes("Sumeria");

        if (isProduct || isLongName) {
            console.log(`Migrando producto: ${group.name}`);
            let product = await prisma.tcgPhysicalProduct.findFirst({
                where: { name: group.name, blockId: group.blockId }
            });
            if (!product) {
                product = await prisma.tcgPhysicalProduct.create({
                    data: { name: group.name, blockId: group.blockId }
                });
            }

            let catchAllGroup = await prisma.tcgGroup.findFirst({
                where: { name: 'Productos Especiales', blockId: group.blockId }
            });
            if (!catchAllGroup) {
                catchAllGroup = await prisma.tcgGroup.create({
                    data: { 
                        groupId: await getNextGroupId(),
                        name: 'Productos Especiales', 
                        blockId: group.blockId,
                        categoryId: 99,
                        publishedOn: new Date(),
                        modifiedOn: new Date()
                    }
                });
            }
            
            await prisma.tcgProduct.updateMany({
                where: { groupId: group.groupId },
                data: { physicalProductId: product.id, groupId: catchAllGroup.groupId }
            });
            
            try {
                await prisma.tcgGroup.delete({ where: { groupId: group.groupId } });
            } catch(e) {
                console.log(`No se pudo borrar ${group.name}`);
            }
        }
    }
    
    console.log("¡Migración y limpieza completa!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
