const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  const oseye = await p.tcgProduct.findMany({ where: { cleanName: "oseye" } });
  console.log(oseye.map(o => `ID: ${o.productId}, categoryId: ${o.categoryId}`));
}
run().finally(() => p.$disconnect());
