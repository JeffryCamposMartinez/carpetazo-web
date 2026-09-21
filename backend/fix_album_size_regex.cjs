const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

const target = /className="relative w-\[95%\] max-w-\[450px\] xl:max-w-\[500px\] 2xl:max-w-\[600px\] mt-2 md:mt-4 touch-pan-y"/;
const replacement = 'className="relative w-[95%] max-w-[360px] xl:max-w-[400px] 2xl:max-w-[460px] mt-2 md:mt-4 touch-pan-y"';

code = code.replace(target, replacement);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Successfully shrank the album dimensions");
