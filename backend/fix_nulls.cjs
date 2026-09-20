const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/server.js', 'utf8');

// Replace standard desc sorting with nulls last object
const targetStr = `{ physicalProduct: { releaseDate: 'desc' } }`;
const replaceStr = `{ physicalProduct: { releaseDate: { sort: 'desc', nulls: 'last' } } }`;

if (code.includes(targetStr)) {
    code = code.split(targetStr).join(replaceStr);
    fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/server.js', code);
    console.log("Updated server.js to use nulls: 'last'");
} else {
    console.log("Could not find the target string.");
}
