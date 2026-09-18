const fs = require('fs');
const path = require('path');

let serverPath = path.join(__dirname, 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Remove proxy route
const regex = /app\.get\('\/api\/images\/proxy'[\s\S]*?\}\);/m;
serverContent = serverContent.replace(regex, '');
serverContent = serverContent.replace("import webp from 'webp-converter';\nwebp.grant_permission();\n", "");

fs.writeFileSync(serverPath, serverContent, 'utf8');
console.log('Removed proxy from server.js');
