const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    await prisma.tcgGroup.deleteMany({
        where: {
            categoryId: 99,
            name: { in: ['🩵 Espada Sagrada', '🧛 Drácula e Inferno', '♥️ Helénica', '💛 Dominios de RA', '💚 Hijos de Daana'] }
        }
    });
    console.log('Deleted emoji groups.');
}
main().finally(() => prisma.$disconnect());
