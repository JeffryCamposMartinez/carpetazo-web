const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/server.js', 'utf8');

const newRoute = `
app.get('/api/tcg/physical-products', async (req, res) => {
  try {
    const products = await prisma.tcgPhysicalProduct.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
`;

if (!code.includes('/api/tcg/physical-products')) {
  code = code.replace("app.get('/api/tcg/search'", newRoute + "\napp.get('/api/tcg/search'");
  fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/server.js', code);
  console.log("Added /api/tcg/physical-products route!");
} else {
  console.log("Route already exists.");
}

// Also update the search API to filter by physicalProductId
const searchFix1 = `const { q, categoryId, groupId, blockId, mylType, mylRace, mylFrequency, mylCost, physicalProductId } = req.query;`;
const searchFix2 = `
    if (physicalProductId) {
      whereClause.physicalProductId = parseInt(physicalProductId);
    }
`;

if (!code.includes('physicalProductId = parseInt(physicalProductId)')) {
  code = code.replace(/const \{ q, categoryId, groupId, blockId, mylType, mylRace, mylFrequency, mylCost \} = req\.query;/, searchFix1);
  code = code.replace(/if \(categoryId\) whereClause\.categoryId = parseInt\(categoryId\);/, `if (categoryId) whereClause.categoryId = parseInt(categoryId);` + searchFix2);
  fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/server.js', code);
  console.log("Updated /api/tcg/search to support physicalProductId filter!");
}
