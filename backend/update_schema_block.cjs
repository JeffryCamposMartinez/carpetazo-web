const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/prisma/schema.prisma', 'utf8');

if (!code.includes('blockId     Int?')) {
    code = code.replace(
      /model TcgPhysicalProduct \{\s*id          Int       @id @default\(autoincrement\(\)\)\s*name        String\s*releaseDate DateTime\?\s*products    TcgProduct\[\]\s*\}/,
      "model TcgPhysicalProduct {\n  id          Int       @id @default(autoincrement())\n  name        String\n  releaseDate DateTime?\n  blockId     Int?\n  products    TcgProduct[]\n}"
    );
    fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/prisma/schema.prisma', code);
    console.log("Updated schema.prisma with blockId");
} else {
    console.log("blockId already exists");
}
