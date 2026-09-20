const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

const target = `          <div
            className="relative w-[95%] max-w-[450px] xl:max-w-[500px] 2xl:max-w-[600px] mt-2 md:mt-4 touch-pan-y"
            style={{ perspective: '3500px', aspectRatio: '7.5/10.5' }}`;

const replacement = `          <div
            className="relative max-w-[95vw] mt-2 md:mt-4 touch-pan-y"
            style={{ 
              perspective: '3500px', 
              aspectRatio: '7.5/10.5',
              height: isDesktop ? 'min(65vh, 650px)' : 'auto',
              width: isDesktop ? 'auto' : '95%'
            }}`;

code = code.replace(target, replacement);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Updated height logic to shrink the binder");
