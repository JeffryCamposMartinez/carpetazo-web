const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main(){ 
    const c = await prisma.tcgProduct.findFirst({
        where:{ categoryId: 99, name: 'Aceite de Oliva' }
    }); 
    console.log("Aceite de Oliva:", c.extData); 
} 
main().finally(()=>prisma.$disconnect());
