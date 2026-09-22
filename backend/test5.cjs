const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main(){ 
    const groups = await prisma.tcgGroup.findMany({ 
        where: { 
            categoryId: 99, 
            name: { in: ['Hijos de Daana', 'Espada Sagrada', 'Helénica', 'Dominios de RA', 'Drácula e Inferno'] } 
        } 
    }); 
    console.log(groups); 
} 
main().finally(()=>prisma.$disconnect());
