const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const card = await prisma.card.findFirst();
    console.log("Card example:", card);
}
run();
