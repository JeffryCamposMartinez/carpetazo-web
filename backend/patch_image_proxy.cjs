const fs = require('fs');
const path = require('path');

let serverPath = path.join(__dirname, 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

const imageProxyCode = `
// --- Image Cache Proxy ---
const sharp = require('sharp');
app.use('/images', express.static(path.join(__dirname, 'public/images')));

app.get('/api/images/proxy', async (req, res) => {
  const { id, url } = req.query;
  if (!id || !url) return res.status(400).send('Missing id or url');

  const publicDir = path.join(__dirname, 'public/images/cards');
  const imagePath = path.join(publicDir, id + '.webp');

  // Si ya existe localmente, devolvemos la url local estática para que sirva desde cache del browser
  if (fs.existsSync(imagePath)) {
    return res.redirect('/images/cards/' + id + '.webp');
  }

  try {
    // Si no existe, la descargamos
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch from TCGCSV');
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Convertimos a WebP
    const webpBuffer = await sharp(buffer)
      .webp({ quality: 80 })
      .toBuffer();

    // Guardamos en disco
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    fs.writeFileSync(imagePath, webpBuffer);

    // Enviamos el WebP generado
    res.type('image/webp');
    res.send(webpBuffer);
  } catch (err) {
    console.error('Image Proxy Error:', err);
    // Fallback: redirigir a la URL original si algo falla
    res.redirect(url);
  }
});
// --- End Image Cache Proxy ---

`;

if (!serverContent.includes('/api/images/proxy')) {
    serverContent = serverContent.replace(
        "app.get('/api/tcg/search', async (req, res) => {",
        imageProxyCode + "app.get('/api/tcg/search', async (req, res) => {"
    );
    fs.writeFileSync(serverPath, serverContent, 'utf8');
    console.log('Injected Image Proxy into server.js');
} else {
    console.log('Proxy already exists');
}
