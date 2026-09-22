const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main(){ 
    const cards = await prisma.tcgProduct.findMany({ 
        where: { physicalProductId: 168 },
        include: { group: true }
    }); 
    for(const c of cards) {
        console.log(c.name + " -> " + c.group.name);
    }
} 
main().finally(()=>prisma.$disconnect());
