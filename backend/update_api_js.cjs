const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/utils/api.js', 'utf8');

if (!code.includes('mylFilters.physicalProductId')) {
  code = code.replace(/if \(mylFilters\.cost\) qs\.append\('mylCost', mylFilters\.cost\);/, `if (mylFilters.cost) qs.append('mylCost', mylFilters.cost);
      if (mylFilters.physicalProductId) qs.append('physicalProductId', mylFilters.physicalProductId);`);
  fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/utils/api.js', code);
  console.log("Updated api.js!");
}
