const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const users = await prisma.user.findMany({ take: 5 });
  console.log(users);
}
run().finally(() => prisma.$disconnect());
