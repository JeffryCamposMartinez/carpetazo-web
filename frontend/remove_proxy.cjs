const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function removeProxy(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      removeProxy(fullPath);
    } else if (file.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let original = content;
      
      content = content.replace(/getProxyImageUrl\([^,]+,\s*(item\.imageUrl|card\.imageUrl)\)/g, '$1');
      content = content.replace(/import \{.*?getProxyImageUrl.*?\} from '\.\.\/utils\/api';\r?\n?/g, '');
      content = content.replace(/import \{.*?getProxyImageUrl.*?\} from '\.\.\/\.\.\/utils\/api';\r?\n?/g, '');
      
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Removed proxy from ${file}`);
      }
    }
  }
}
removeProxy(srcDir);

// Update api.js
const apiPath = path.join(srcDir, 'utils/api.js');
let apiContent = fs.readFileSync(apiPath, 'utf8');
apiContent = apiContent.replace(/export const getProxyImageUrl[\s\S]*?\};/m, '');
fs.writeFileSync(apiPath, apiContent, 'utf8');
console.log('Removed proxy from api.js');

// Update index.html CSP
const htmlPath = path.join(__dirname, 'index.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');
htmlContent = htmlContent.replace("https://tcgcsv.com;", "https://tcgcsv.com https://tcgplayer-cdn.tcgplayer.com;");
fs.writeFileSync(htmlPath, htmlContent, 'utf8');
console.log('Updated CSP in index.html');

