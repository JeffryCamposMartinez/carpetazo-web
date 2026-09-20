const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/server.js', 'utf8');

const targetStr = `const products = await prisma.tcgProduct.findMany({
      where: whereClause,
      take: 2000,
      orderBy: { name: 'asc' }
    });`;

const replaceStr = `const products = await prisma.tcgProduct.findMany({
      where: whereClause,
      take: 2000,
      orderBy: [
        { physicalProduct: { releaseDate: 'desc' } },
        { name: 'asc' }
      ]
    });`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/server.js', code);
console.log("Updated server.js search sorting logic");
