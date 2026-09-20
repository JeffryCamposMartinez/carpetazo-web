const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

code = code.replace(
  'className="mt-4 w-full [&>button]:w-full [&>button]:py-4 [&>button]:text-xl [&>button]:rounded-xl"',
  'className="mt-6 w-[80%] md:w-[66%] scale-125 md:scale-150 origin-top-left"'
);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Updated modal button scaling");
