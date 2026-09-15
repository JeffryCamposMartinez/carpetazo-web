const fs = require('fs');
const path = 'C:/Users/Jeffry/Desktop/Publicar mis cartas/backend/prisma/schema.prisma';
let content = fs.readFileSync(path, 'utf8');
if (content.charCodeAt(0) === 0xFEFF) {
  content = content.slice(1);
  fs.writeFileSync(path, content, 'utf8');
  console.log('BOM removed');
} else {
  console.log('No BOM found');
}
