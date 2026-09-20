const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log("Fetching all products from Mazos...");
  const allProducts = [];
  let page = 1;
  const totalPages = 15;
  
  while (page <= totalPages) {
    const query = `
      query {
        products(page: ${page}) {
          products {
            name
            createdAt
          }
        }
      }
    `;
    try {
      const res = await fetch('https://api.mazos.cl/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer 4mqbmG_TfeaE_yiboPkhgk9-AM2SmFD20K8fiZi4cB0' },
          body: JSON.stringify({ query })
      });
      const data = await res.json();
      if (data.data?.products?.products) {
        allProducts.push(...data.data.products.products);
      } else {
        break;
      }
    } catch(e) {
      console.error(e);
      break;
    }
    page++;
  }

  const productMap = new Map();
  allProducts.forEach(p => {
    if (!productMap.has(p.name) || new Date(p.createdAt) < new Date(productMap.get(p.name).createdAt)) {
      productMap.set(p.name, p);
    }
  });

  const dbProducts = await prisma.tcgPhysicalProduct.findMany();
  let updatedCount = 0;
  
  for (const dbp of dbProducts) {
    const mazosProd = productMap.get(dbp.name);
    if (mazosProd && mazosProd.createdAt) {
      await prisma.tcgPhysicalProduct.update({
        where: { id: dbp.id },
        data: { releaseDate: new Date(mazosProd.createdAt) }
      });
      updatedCount++;
    } else {
      // For those missing in Mazos API (like promos), give them a fake old date or leave null?
      // Leaving them null is fine, they will sort at the end.
    }
  }

  console.log(`Updated release dates for ${updatedCount} physical products in DB.`);
}

run().finally(() => prisma.$disconnect());
