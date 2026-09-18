const fs = require('fs');
const path = require('path');

let serverPath = path.join(__dirname, 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Add import
if (!serverContent.includes("import webp from 'webp-converter';")) {
    serverContent = "import webp from 'webp-converter';\n" + serverContent;
    serverContent = serverContent.replace("import webp from 'webp-converter';\n", "import webp from 'webp-converter';\nwebp.grant_permission();\n");
}

const newProxyLogic = `
  try {
    // Si no existe, la descargamos
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch from TCGCSV');
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Usar webp-converter (seguro en Docker sin dependencias nativas complejas)
    const tempPath = path.join(publicDir, 'temp_' + id + '.img');
    fs.writeFileSync(tempPath, buffer);

    try {
      await webp.cwebp(tempPath, imagePath, '-q 80');
      // Enviar la imagen WebP optimizada
      res.type('image/webp');
      res.sendFile(imagePath);
    } catch (conversionError) {
      console.error('WebP conversion failed, falling back to original', conversionError);
      fs.writeFileSync(imagePath, buffer); // Fallback to original
      res.type(response.headers.get('content-type') || 'image/png');
      res.send(buffer);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }

`;

serverContent = serverContent.replace(/  try \{\r?\n    \/\/ Si no existe, la descargamos[\s\S]*?res\.send\(buffer\);\r?\n/m, newProxyLogic);

fs.writeFileSync(serverPath, serverContent, 'utf8');
console.log('Injected safe webp-converter into server.js');
