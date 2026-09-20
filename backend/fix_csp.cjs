const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/index.html', 'utf8');

code = code.replace(
  /img-src 'self' data: https:\/\/\*\.pokemontcg\.io https:\/\/\*\.tcgcsv\.com https:\/\/tcgcsv\.com https:\/\/lh3\.googleusercontent\.com https:\/\/firebasestorage\.googleapis\.com https:\/\/www\.gstatic\.com https:\/\/tcgplayer-cdn\.tcgplayer\.com https:\/\/api\.carpetazo\.cl https:\/\/\*\.alphacoders\.com;/g,
  "img-src 'self' data: https://*.pokemontcg.io https://*.tcgcsv.com https://tcgcsv.com https://lh3.googleusercontent.com https://firebasestorage.googleapis.com https://www.gstatic.com https://tcgplayer-cdn.tcgplayer.com https://api.carpetazo.cl https://*.alphacoders.com https://www.transparenttextures.com;"
);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/index.html', code);
console.log("Updated CSP in index.html");
