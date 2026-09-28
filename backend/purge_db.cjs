const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log("Iniciando purga de base de datos...");
    
    // Contar cuántos productos hay antes
    const totalBefore = await prisma.tcgProduct.count();
    console.log(`Productos totales antes de la purga: ${totalBefore}`);
    
    // Ejecutar la eliminación
    const deleted = await prisma.tcgProduct.deleteMany({
        where: {
            categoryId: {
                not: 99 // 99 es Mitos y Leyendas
            }
        }
    });
    
    console.log(`Se eliminaron exitosamente ${deleted.count} cartas que no eran de Mitos y Leyendas.`);
    
    // Contar cuántos productos quedan
    const totalAfter = await prisma.tcgProduct.count();
    console.log(`Productos restantes (solo MyL): ${totalAfter}`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
