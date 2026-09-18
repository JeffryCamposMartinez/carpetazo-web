const fs = require('fs');
const path = require('path');
let indexPath = path.join(__dirname, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');

// Add gstatic.com to img-src
indexContent = indexContent.replace(
    /img-src 'self' data: https:\/\/\*\.pokemontcg\.io https:\/\/lh3\.googleusercontent\.com https:\/\/firebasestorage\.googleapis\.com;/,
    "img-src 'self' data: https://*.pokemontcg.io https://lh3.googleusercontent.com https://firebasestorage.googleapis.com https://www.gstatic.com;"
);

// Add frame-src
indexContent = indexContent.replace(
    /font-src 'self' https:\/\/fonts\.gstatic\.com;" \/>/,
    "font-src 'self' https://fonts.gstatic.com; frame-src 'self' https://*.firebaseapp.com;\" />"
);

fs.writeFileSync(indexPath, indexContent, 'utf8');
console.log('Fixed index.html CSP cleanly');
