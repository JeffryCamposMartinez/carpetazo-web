const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src');

const replacements = {
  'Ã¡': 'á',
  'Ã©': 'é',
  'Ã\xAD': 'í',
  'Ã³': 'ó',
  'Ãº': 'ú',
  'Ã±': 'ñ',
  'Ã\x81': 'Á',
  'Ã\x89': 'É',
  'Ã\x8D': 'Í',
  'Ã\x93': 'Ó',
  'Ã\x9A': 'Ú',
  'Ã\x91': 'Ñ',
  'Ã¼': 'ü',
  'Ã\x9C': 'Ü',
  'Âº': 'º',
  'Â¿': '¿',
  'Â¡': '¡',
  'catÃ¡logo': 'catálogo',
  'nÃºmero': 'número',
  'dÃ­a': 'día',
  'ediciÃ³n': 'edición',
  'mÃ¡s': 'más',
  'aÃ±adir': 'añadir',
  'DiseÃ±o': 'Diseño'
};

function fixCorrupted(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fixCorrupted(fullPath);
    } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let original = content;
      
      for (const [bad, good] of Object.entries(replacements)) {
        content = content.split(bad).join(good);
      }
      
      // Also catch anything else with Ã
      content = content.replace(/Ã¡/g, 'á');
      content = content.replace(/Ã©/g, 'é');
      content = content.replace(/Ã­/g, 'í'); // with invisible char sometimes
      content = content.replace(/Ã³/g, 'ó');
      content = content.replace(/Ãº/g, 'ú');
      content = content.replace(/Ã±/g, 'ñ');

      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Fixed corrupted characters in ${file}`);
      }
    }
  }
}

fixCorrupted(dir);
