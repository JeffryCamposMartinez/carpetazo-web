const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Borrando cartas de la DB que apuntan al VPS...");
    const deleted = await prisma.tcgProduct.deleteMany({
        where: {
            categoryId: 99,
            imageUrl: { contains: 'api.carpetazo.cl/images' }
        }
    });
    console.log(`Eliminadas ${deleted.count} cartas de la base de datos.`);
    
    console.log("Limpiando grupos (ediciones) vacíos...");
    // Borrar grupos que ya no tienen productos
    const groups = await prisma.tcgGroup.findMany({
        where: { categoryId: 99 },
        include: { _count: { select: { products: true } } }
    });
    
    let deletedGroups = 0;
    for (const g of groups) {
        if (g._count.products === 0) {
            await prisma.tcgGroup.delete({ where: { groupId: g.groupId } });
            deletedGroups++;
        }
    }
    console.log(`Eliminadas ${deletedGroups} ediciones vacías.`);
}

main().finally(() => prisma.$disconnect());
