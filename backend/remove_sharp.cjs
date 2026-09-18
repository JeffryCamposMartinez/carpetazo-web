const fs = require('fs');
const path = require('path');

let serverPath = path.join(__dirname, 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Remove sharp import completely
serverContent = serverContent.replace(/\/\/ import sharp from 'sharp';\r?\n/g, "");
serverContent = serverContent.replace(/import sharp from 'sharp';\r?\n/g, "");

// Modify the proxy logic
const newProxyLogic = `
  try {
    // Si no existe, la descargamos
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch from TCGCSV');
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Guardamos en disco la imagen ORIGINAL
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    fs.writeFileSync(imagePath, buffer);

    // Enviamos la imagen
    res.type(response.headers.get('content-type') || 'image/png');
    res.send(buffer);
`;

serverContent = serverContent.replace(/  try \{\r?\n    \/\/ Si no existe, la descargamos[\s\S]*?res\.send\(webpBuffer\);\r?\n/m, newProxyLogic);

fs.writeFileSync(serverPath, serverContent, 'utf8');
console.log('Removed sharp and simplified the proxy to save original images');
