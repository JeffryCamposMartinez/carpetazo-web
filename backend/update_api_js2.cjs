const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/utils/api.js', 'utf8');

if (!code.includes('getTcgPhysicalProducts:')) {
  code = code.replace(/getTcgGroups: \(categoryId\) => apiFetch\('\/tcg\/' \+ categoryId \+ '\/groups'\),/, `getTcgGroups: (categoryId) => apiFetch('/tcg/' + categoryId + '/groups'),
    getTcgPhysicalProducts: () => apiFetch('/tcg/physical-products'),`);
  fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/utils/api.js', code);
  console.log("Updated api.js!");
}
