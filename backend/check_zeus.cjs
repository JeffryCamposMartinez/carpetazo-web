const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
    const cards = await prisma.tcgProduct.findMany({ 
        where: { name: "El Gran Zeus" }
    });
    console.log("El Gran Zeus variants:");
    for (const c of cards) {
        console.log(`ID: ${c.productId}, Img: ${c.imageUrl}`);
    }
}
check().catch(console.error).finally(() => prisma.$disconnect());
