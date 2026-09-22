const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main(){ 
    const c = await prisma.tcgProduct.findFirst({where:{categoryId: 99, groupId: 999993}}); 
    console.log(c); 
} 
main().finally(()=>prisma.$disconnect());
