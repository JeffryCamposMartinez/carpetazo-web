const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main(){ 
    const p = await prisma.tcgPhysicalProduct.findMany(); 
    console.log(p.map(x => ({ id: x.id, name: x.name }))); 
} 
main().finally(()=>prisma.$disconnect());
