const fs=require('fs'); 
let c = fs.readFileSync('server.js', 'utf8'); 
c = c.replace("const categories = await prisma.tcgCategory.findMany({ orderBy: [ { releaseDate: 'desc' }, { name: 'asc' } ] });", "const categories = await prisma.tcgCategory.findMany({ orderBy: { name: 'asc' } });"); 
fs.writeFileSync('server.js', c); 
console.log('Patched server.js cleanly');
