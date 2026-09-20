const fs = require('fs');

async function run() {
  console.log("Fetching all products from Mazos...");
  const allProducts = [];
  let page = 1;
  const totalPages = 15; // 272 / 20 = 14 pages
  
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

  // Read our PB metadata to filter only PB products
  const metadata = JSON.parse(fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/metadata_pb.json', 'utf8'));
  const pbProductNames = new Set();
  metadata.forEach(c => {
    if (c.subtitle) pbProductNames.add(c.subtitle);
  });

  // Filter and sort
  const pbProducts = allProducts.filter(p => pbProductNames.has(p.name));
  
  // Create a map to deduplicate by name (taking the earliest createdAt)
  const productMap = new Map();
  pbProducts.forEach(p => {
    if (!productMap.has(p.name) || new Date(p.createdAt) < new Date(productMap.get(p.name).createdAt)) {
      productMap.set(p.name, p);
    }
  });

  const sortedProducts = Array.from(productMap.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  console.log(`\nFound ${sortedProducts.length} Primer Bloque products (out of ${pbProductNames.size} total scraped PB products).`);
  console.log("Here is the chronological order (oldest to newest):");
  sortedProducts.forEach((p, idx) => {
    const date = new Date(p.createdAt).toISOString().split('T')[0];
    console.log(`${idx + 1}. [${date}] ${p.name}`);
  });
  
  // Find missing
  const foundNames = new Set(sortedProducts.map(p => p.name));
  const missing = Array.from(pbProductNames).filter(name => !foundNames.has(name));
  if (missing.length > 0) {
    console.log(`\nWarning: ${missing.length} PB products were not found in the global products endpoint (possibly because they are marked as different categories in Mazos):`);
    missing.slice(0, 10).forEach(m => console.log("- " + m));
    if (missing.length > 10) console.log("... and more.");
  }
}
run();
