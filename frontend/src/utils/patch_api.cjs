const fs = require('fs');
const path = 'C:/Users/Jeffry/Desktop/Publicar mis cartas/frontend/src/utils/api.js';
let content = fs.readFileSync(path, 'utf8');

const injection = `
  // TCG Proxy
  getTcgCategories: () => apiFetch('/tcg/categories'),
  getTcgGroups: (categoryId) => apiFetch('/tcg/' + categoryId + '/groups'),
  getTcgProducts: (categoryId, groupId) => apiFetch('/tcg/' + categoryId + '/' + groupId + '/products'),
`;

if (!content.includes('getTcgCategories')) {
  content = content.replace('// Orders', injection + '\n  // Orders');
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully added TCG endpoints to api.js');
} else {
  console.log('Endpoints already exist');
}
