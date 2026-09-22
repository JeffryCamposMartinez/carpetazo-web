const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main(){ 
    const count = await prisma.tcgProduct.count({ 
        where: { 
            categoryId: 99, 
            groupId: { notIn: [999991, 999992, 999993, 999994, 999995] } 
        } 
    }); 
    console.log("Cartas restantes por clasificar: " + count); 
} 
main().finally(()=>prisma.$disconnect());
