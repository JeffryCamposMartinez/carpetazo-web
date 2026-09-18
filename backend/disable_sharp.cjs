const fs = require('fs');
const path = require('path');

let serverPath = path.join(__dirname, 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Disable proxy
serverContent = serverContent.replace("import sharp from 'sharp';", "// import sharp from 'sharp';");
serverContent = serverContent.replace("const webpBuffer = await sharp(buffer)", "// const webpBuffer = await sharp(buffer)");
serverContent = serverContent.replace(".webp({ quality: 80 })", "");
serverContent = serverContent.replace(".toBuffer();", "const webpBuffer = buffer; // bypass sharp");

fs.writeFileSync(serverPath, serverContent, 'utf8');
console.log('Disabled sharp temporarily to test if it is crashing the server');
