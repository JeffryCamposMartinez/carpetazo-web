const fs = require('fs');
const path = require('path');

// Fix api.js
let apiPath = path.join(__dirname, 'src/utils/api.js');
let apiContent = fs.readFileSync(apiPath, 'utf8');
apiContent = apiContent.replace(
    /const API_BASE_URL = import\.meta\.env\.VITE_API_URL \|\| 'http:\/\/localhost:8000\/api';/,
    "const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.carpetazo.cl/api';"
);
fs.writeFileSync(apiPath, apiContent, 'utf8');

// Fix index.html
let indexPath = path.join(__dirname, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');
indexContent = indexContent.replace(/ngmero/g, 'número');
indexContent = indexContent.replace(/lder/g, 'líder');
indexContent = indexContent.replace(/Pok?mon/g, 'Pokémon');
indexContent = indexContent.replace(/mos/g, 'más');
indexContent = indexContent.replace(/coleccin/g, 'colección');
fs.writeFileSync(indexPath, indexContent, 'utf8');
console.log('Fixed api.js and index.html natively via node');
