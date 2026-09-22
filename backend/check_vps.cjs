const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function main() { 
    const count = await prisma.tcgProduct.count({ where: { imageUrl: { contains: 'api.carpetazo.cl/images' } } }); 
    console.log('Cartas apuntando al VPS: ' + count); 
} 
main().finally(() => prisma.$disconnect());
