const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/server.js', 'utf8');

code = code.replace("orderBy: { name: 'asc' }", "orderBy: [ { releaseDate: 'desc' }, { name: 'asc' } ]");
fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/server.js', code);
console.log("Updated server.js physical-products sorting");
