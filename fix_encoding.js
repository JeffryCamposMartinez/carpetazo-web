const fs = require('fs');

function fixEncoding(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

fixEncoding('backend/prisma/schema.prisma');
fixEncoding('backend/server.js');
