const fs=require('fs'); 
const file1 = 'C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/index.html'; 
const file2 = 'C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/nginx.conf'; 
const patch = (f) => { 
    let content = fs.readFileSync(f, 'utf8'); 
    content = content.replace("img-src 'self' data:", "img-src 'self' data: https://pub-1ba0fdf5c93c4412abbc2b234780b3c6.r2.dev"); 
    fs.writeFileSync(f, content); 
}; 
patch(file1); 
patch(file2); 
console.log('Patched CSP in frontend');
