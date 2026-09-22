const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main(){ 
    const prod = await prisma.tcgPhysicalProduct.findFirst({ where: { name: { contains: 'Eterno' } } }); 
    console.log(prod); 
} 
main().finally(()=>prisma.$disconnect());
