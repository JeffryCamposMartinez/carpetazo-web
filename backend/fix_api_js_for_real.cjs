const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/utils/api.js', 'utf8');

// Fix getTcgProducts duplicates
code = code.replace(
  /if \(mylFilters\.physicalProductId\) qs\.append\('physicalProductId', mylFilters\.physicalProductId\);[\r\n\s]+if \(mylFilters\.physicalProductId\) qs\.append\('physicalProductId', mylFilters\.physicalProductId\);/g,
  "if (mylFilters.physicalProductId) qs.append('physicalProductId', mylFilters.physicalProductId);"
);

// Fix searchTcgProducts
code = code.replace(
  /if \(mylFilters\.cost\) qs\.append\('mylCost', mylFilters\.cost\);[\r\n\s]+return apiFetch\('\/tcg\/search\?' \+ qs\.toString\(\)\);/g,
  "if (mylFilters.cost) qs.append('mylCost', mylFilters.cost);\n      if (mylFilters.physicalProductId) qs.append('physicalProductId', mylFilters.physicalProductId);\n      return apiFetch('/tcg/search?' + qs.toString());"
);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/utils/api.js', code);
console.log("Fixed api.js for real");
