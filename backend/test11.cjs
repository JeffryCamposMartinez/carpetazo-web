const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main(){ 
    const p = await prisma.tcgPhysicalProduct.findUnique({where:{id: 153}}); 
    console.log(p); 
} 
main().finally(()=>prisma.$disconnect());
