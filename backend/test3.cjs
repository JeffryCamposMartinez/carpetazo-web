const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main(){ 
    const count = await prisma.tcgProduct.count({ where: { physicalProductId: 168 } }); 
    console.log("Cartas en Eterno: " + count); 
} 
main().finally(()=>prisma.$disconnect());
