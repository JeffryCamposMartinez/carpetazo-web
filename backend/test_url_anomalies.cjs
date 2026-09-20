const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const products = await prisma.tcgProduct.findMany({ where: { categoryId: 99 } });
  
  for (const p of products) {
    const url = p.extData?.imageUrl || '';
    const match = url.match(/https:\/\/cdn\.mazos\.cl\/([^\/]+)\/([^\/]+)\//);
    if (!match) {
      console.log("Anomaly:", url);
    } else if (match[1] === 'cards') {
      console.log("Cards block:", url);
    }
  }
}
main().finally(() => prisma.$disconnect());
