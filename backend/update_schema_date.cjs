const fs = require('fs');
let schema = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/prisma/schema.prisma', 'utf8');

if (!schema.includes('releaseDate DateTime?')) {
  schema = schema.replace(
    'model TcgPhysicalProduct {\n  id          Int       @id @default(autoincrement())\n  name        String\n  products    TcgProduct[]\n}',
    'model TcgPhysicalProduct {\n  id          Int       @id @default(autoincrement())\n  name        String\n  releaseDate DateTime?\n  products    TcgProduct[]\n}'
  );
  fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/prisma/schema.prisma', schema);
  console.log("Updated schema.prisma with releaseDate");
} else {
  console.log("releaseDate already exists");
}
