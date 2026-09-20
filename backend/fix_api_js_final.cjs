const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/utils/api.js', 'utf8');

// Fix getTcgProducts duplicates
code = code.replace(
  /if \(mylFilters\.physicalProductId\) qs\.append\('physicalProductId', mylFilters\.physicalProductId\);\n        if \(mylFilters\.physicalProductId\) qs\.append\('physicalProductId', mylFilters\.physicalProductId\);/,
  "if (mylFilters.physicalProductId) qs.append('physicalProductId', mylFilters.physicalProductId);"
);

// Fix searchTcgProducts
const target = `    searchTcgProducts: (query, categoryId, searchSet, mylFilters = {}) => {
      let qs = new URLSearchParams();
      if (query) qs.append('q', query);
      if (categoryId) qs.append('categoryId', categoryId);
      if (searchSet) qs.append('groupId', searchSet);
      if (mylFilters.blockId) qs.append('blockId', mylFilters.blockId);
      if (mylFilters.type) qs.append('mylType', mylFilters.type);
      if (mylFilters.race) qs.append('mylRace', mylFilters.race);
      if (mylFilters.frequency) qs.append('mylFrequency', mylFilters.frequency);
      if (mylFilters.cost) qs.append('mylCost', mylFilters.cost);
      return apiFetch('/tcg/search?' + qs.toString());
    },`;

const replacement = `    searchTcgProducts: (query, categoryId, searchSet, mylFilters = {}) => {
      let qs = new URLSearchParams();
      if (query) qs.append('q', query);
      if (categoryId) qs.append('categoryId', categoryId);
      if (searchSet) qs.append('groupId', searchSet);
      if (mylFilters.blockId) qs.append('blockId', mylFilters.blockId);
      if (mylFilters.type) qs.append('mylType', mylFilters.type);
      if (mylFilters.race) qs.append('mylRace', mylFilters.race);
      if (mylFilters.frequency) qs.append('mylFrequency', mylFilters.frequency);
      if (mylFilters.cost) qs.append('mylCost', mylFilters.cost);
      if (mylFilters.physicalProductId) qs.append('physicalProductId', mylFilters.physicalProductId);
      return apiFetch('/tcg/search?' + qs.toString());
    },`;

code = code.replace(target, replacement);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/utils/api.js', code);
console.log("Fixed api.js perfectly");
