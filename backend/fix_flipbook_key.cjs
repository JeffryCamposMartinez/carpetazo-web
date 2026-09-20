const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

code = code.replace(
  /<HTMLFlipBook/g,
  "<HTMLFlipBook key={pages.length + (isDesktop ? 'd' : 'm')}"
);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Added key to HTMLFlipBook");
