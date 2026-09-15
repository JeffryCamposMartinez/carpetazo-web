const fs = require('fs');
const path = 'C:/Users/Jeffry/Desktop/Publicar mis cartas/backend/sync_tcgcsv.cjs';
if (fs.existsSync(path)) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(
    /const recentGroups = groupData\.results\s*\.sort\(\(a,b\) => new Date\(b\.publishedOn\) - new Date\(a\.publishedOn\)\)\s*\.slice\(0, 15\); \/\/ limit to 15 newest sets for now/,
    `const recentGroups = groupData.results.sort((a,b) => new Date(b.publishedOn) - new Date(a.publishedOn));`
  );
  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed sync_tcgcsv.cjs limit.');
}
