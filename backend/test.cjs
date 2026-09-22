const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main(){ 
    const prods = await prisma.tcgPhysicalProduct.findMany({ take: 5 }); 
    console.log(prods); 
} 
main().finally(()=>prisma.$disconnect());
