const fs = require('fs');
const path = require('path');

let indexPath = path.join(__dirname, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');

indexContent = indexContent.replace(
    /img-src 'self' data: https:\/\/\*\.pokemontcg\.io/,
    "img-src 'self' data: https://*.pokemontcg.io https://*.tcgcsv.com https://tcgcsv.com"
);

fs.writeFileSync(indexPath, indexContent, 'utf8');
console.log('Added tcgcsv to img-src natively via node');
