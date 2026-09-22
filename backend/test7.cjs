const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main(){ 
    const c = await prisma.tcgProduct.findFirst({where:{name:'Afrodita'}}); 
    console.log(c.extData); 
} 
main().finally(()=>prisma.$disconnect());
