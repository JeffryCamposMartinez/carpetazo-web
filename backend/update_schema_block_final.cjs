const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/prisma/schema.prisma', 'utf8');

const target = `model TcgPhysicalProduct {
  id          Int       @id @default(autoincrement())
  name        String
  releaseDate DateTime?
  products    TcgProduct[]
}`;

const replace = `model TcgPhysicalProduct {
  id          Int       @id @default(autoincrement())
  name        String
  releaseDate DateTime?
  blockId     Int?
  products    TcgProduct[]
}`;

if (code.includes(target)) {
    code = code.replace(target, replace);
    fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/prisma/schema.prisma', code);
    console.log("Updated schema correctly");
} else {
    console.log("Could not find the target text.");
}
