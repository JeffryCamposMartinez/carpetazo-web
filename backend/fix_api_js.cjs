const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/utils/api.js', 'utf8');

const targetStr = `      if (mylFilters.cost) qs.append('mylCost', mylFilters.cost);`;
const replaceStr = `      if (mylFilters.cost) qs.append('mylCost', mylFilters.cost);
      if (mylFilters.physicalProductId) qs.append('physicalProductId', mylFilters.physicalProductId);`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replaceStr);
    fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/utils/api.js', code);
    console.log("Updated api.js to pass physicalProductId in searchTcgProducts.");
} else {
    console.log("Could not find target in api.js");
}
