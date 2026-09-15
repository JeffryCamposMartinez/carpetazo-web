const fs = require('fs');
const path = 'C:/Users/Jeffry/Desktop/Publicar mis cartas/backend/server.js';
let content = fs.readFileSync(path, 'utf8');

const injection = `
// --- TCGCSV PROXY ---
const TCGCSV_BASE = 'https://tcgcsv.com/tcgplayer';
const tcgcsvCache = {};

app.get('/api/tcg/categories', async (req, res) => {
  try {
    if (tcgcsvCache['categories']) {
      return res.json({ success: true, data: tcgcsvCache['categories'] });
    }
    const response = await fetch(\`\${TCGCSV_BASE}/categories\`, { headers: { 'User-Agent': 'CarpetazoApp/1.0' } });
    const data = await response.json();
    tcgcsvCache['categories'] = data.results;
    res.json({ success: true, data: data.results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tcg/:categoryId/groups', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const cacheKey = \`groups_\${categoryId}\`;
    if (tcgcsvCache[cacheKey]) {
      return res.json({ success: true, data: tcgcsvCache[cacheKey] });
    }
    const response = await fetch(\`\${TCGCSV_BASE}/\${categoryId}/groups\`, { headers: { 'User-Agent': 'CarpetazoApp/1.0' } });
    const data = await response.json();
    tcgcsvCache[cacheKey] = data.results;
    res.json({ success: true, data: data.results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/tcg/:categoryId/:groupId/products', async (req, res) => {
  try {
    const { categoryId, groupId } = req.params;
    const cacheKey = \`products_\${categoryId}_\${groupId}\`;
    if (tcgcsvCache[cacheKey]) {
      return res.json({ success: true, data: tcgcsvCache[cacheKey] });
    }
    const response = await fetch(\`\${TCGCSV_BASE}/\${categoryId}/\${groupId}/products\`, { headers: { 'User-Agent': 'CarpetazoApp/1.0' } });
    const data = await response.json();
    tcgcsvCache[cacheKey] = data.results;
    res.json({ success: true, data: data.results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

`;

if (!content.includes('TCGCSV_BASE')) {
  content = content.replace('app.listen(', injection + 'app.listen(');
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully added TCGCSV endpoints to server.js');
} else {
  console.log('Endpoints already exist');
}
