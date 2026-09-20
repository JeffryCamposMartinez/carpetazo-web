const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const products = await prisma.tcgProduct.findMany({ where: { categoryId: 99 } });
  
  const blocks = new Set();
  const editions = new Set();
  
  let anomalies = 0;
  for (const p of products) {
    const url = p.extData?.imageUrl || '';
    const match = url.match(/https:\/\/cdn\.mazos\.cl\/([^\/]+)\/([^\/]+)\//);
    if (match) {
      blocks.add(match[1]);
      editions.add(match[2]);
    } else {
      anomalies++;
      // console.log(url);
    }
  }
  
  console.log("Blocks:", Array.from(blocks));
  console.log("Editions:", Array.from(editions));
  console.log("Anomalies:", anomalies);
}
main().finally(() => prisma.$disconnect());
