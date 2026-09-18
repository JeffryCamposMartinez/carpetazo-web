const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src');

function findCorrupted(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findCorrupted(fullPath);
    } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.html')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('Ã')) {
        console.log(`\nFound in ${fullPath}:`);
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (line.includes('Ã')) {
            console.log(`Line ${i+1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

findCorrupted(dir);
