const fs = require('fs');
const path = 'C:/Users/Jeffry/Desktop/Publicar mis cartas/backend/server.js';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('PrismaClient')) {
  content = content.replace("import cors from 'cors';", "import cors from 'cors';\nimport { PrismaClient } from '@prisma/client';\nconst prisma = new PrismaClient();");
}

const proxyRegex = /\/\/ --- TCGCSV PROXY ---[\s\S]*?app\.listen\(/;

const newEndpoints = `// --- TCGCSV LOCAL DB ---
app.get('/api/tcg/categories', async (req, res) => {
  try {
    const categories = await prisma.tcgCategory.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tcg/:categoryId/groups', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const groups = await prisma.tcgGroup.findMany({
      where: { categoryId: parseInt(categoryId) },
      orderBy: { publishedOn: 'desc' }
    });
    res.json({ success: true, data: groups });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tcg/:categoryId/:groupId/products', async (req, res) => {
  try {
    const { categoryId, groupId } = req.params;
    const products = await prisma.tcgProduct.findMany({
      where: { categoryId: parseInt(categoryId), groupId: parseInt(groupId) },
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tcg/search', async (req, res) => {
  try {
    const { q, categoryId, groupId } = req.query;
    if (!q) return res.json({ success: true, data: [] });
    
    let whereClause = {
       name: { contains: q, mode: 'insensitive' }
    };
    if (categoryId) whereClause.categoryId = parseInt(categoryId);
    if (groupId) whereClause.groupId = parseInt(groupId);

    const products = await prisma.tcgProduct.findMany({
      where: whereClause,
      take: 50,
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(`;

content = content.replace(proxyRegex, newEndpoints);
fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated server.js with Prisma endpoints');
