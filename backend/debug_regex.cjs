const fs = require('fs');
const file = 'C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/Dashboard.jsx';
let code = fs.readFileSync(file, 'utf8');

const match = code.match(/<button[^>]*title="Renombrar carpeta"[^>]*>[\s\S]*?<\/button>/);
if (match) {
  console.log("MATCH FOUND:");
  console.log(match[0]);
} else {
  console.log("NO MATCH FOUND!");
}
