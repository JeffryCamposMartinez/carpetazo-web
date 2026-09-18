const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src');

function findWeird(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findWeird(fullPath);
    } else if (file.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      const words = content.match(/[a-zA-Z]*[^\x00-\x7F]+[a-zA-Z]*/g);
      if (words) {
         // Filter out valid spanish accents
         const weirdWords = words.filter(w => !/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ¿¡]+$/.test(w));
         if (weirdWords.length > 0) {
             console.log(`\nIn ${file}:`);
             const unique = [...new Set(weirdWords)];
             console.log(unique.join(', '));
         }
      }
    }
  }
}
findWeird(dir);
