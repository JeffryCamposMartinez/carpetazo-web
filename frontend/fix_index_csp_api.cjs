const fs = require('fs');
const path = require('path');

let indexPath = path.join(__dirname, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');

indexContent = indexContent.replace(
    /connect-src 'self' https:\/\/carpetazo\.cl http:\/\/192\.168\.1\.15:8000/,
    "connect-src 'self' https://carpetazo.cl https://api.carpetazo.cl http://192.168.1.15:8000"
);

fs.writeFileSync(indexPath, indexContent, 'utf8');
console.log('Added api.carpetazo.cl to connect-src natively via node');
