const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  const oseye = await p.tcgProduct.findMany({ where: { cleanName: 'oseye' }, include: { group: true, physicalProduct: true } });
  console.log(oseye.map(o => `${o.name} -> Group: ${o.group.name}, Product: ${o.physicalProduct ? o.physicalProduct.name : 'null'}`));
}
run().finally(() => p.$disconnect());
