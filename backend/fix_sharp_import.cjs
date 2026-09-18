const fs = require('fs');
const path = require('path');

let serverPath = path.join(__dirname, 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Remove require
serverContent = serverContent.replace("const sharp = require('sharp');", "");

// Add import at the top
if (!serverContent.includes("import sharp from 'sharp';")) {
    serverContent = "import sharp from 'sharp';\n" + serverContent;
}

fs.writeFileSync(serverPath, serverContent, 'utf8');
console.log('Fixed ES module import for sharp in server.js');
